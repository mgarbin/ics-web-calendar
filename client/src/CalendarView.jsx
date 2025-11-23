import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, Views, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import startOfMonth from 'date-fns/startOfMonth';
import endOfMonth from 'date-fns/endOfMonth';
import endOfWeek from 'date-fns/endOfWeek';
import addDays from 'date-fns/addDays';
import getDay from 'date-fns/getDay';
import isSameMonth from 'date-fns/isSameMonth';
import isSameDay from 'date-fns/isSameDay';
import itLocale from 'date-fns/locale/it';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { fetchIcs } from './icsService';
import './calendar-modals.css';

const userLang = (typeof navigator !== 'undefined' ? (navigator.language || navigator.userLanguage || 'en') : 'en').split('-')[0];

const locales = {
  it: itLocale,
  en: enUS
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: locales[userLang] || enUS }),
  getDay,
  locales
});

export default function CalendarView({ icsUrl }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(Views.MONTH);

  // UI state per modal e selezione evento
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showMoreModal, setShowMoreModal] = useState({ open: false, date: null, events: [] });

  // Stampa
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printView, setPrintView] = useState('month'); // month | week | day | list
  const [printFontSize, setPrintFontSize] = useState('12'); // in px
  const [printDate, setPrintDate] = useState(format(new Date(), 'yyyy-MM-dd')); // date for month/week/day
  const [printFrom, setPrintFrom] = useState(format(new Date(), 'yyyy-MM-dd')); // for list
  const [printTo, setPrintTo] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchIcs(icsUrl);
        const mapped = data.events.map(ev => ({
          id: ev.id,
          title: ev.title,
          start: ev.start ? new Date(ev.start) : new Date(),
          end: ev.end ? new Date(ev.end) : (ev.start ? new Date(ev.start) : new Date()),
          allDay: !!ev.allDay,
          description: ev.description,
          location: ev.location
        }));
        if (mounted) setEvents(mapped);
      } catch (err) {
        console.error(err);
        alert('Errore caricamento ICS: ' + (err?.response?.data?.error || err.message || err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [icsUrl]);

  // Lista di viste abilitare incl. work_week
  const allViews = useMemo(() => [Views.MONTH, Views.WEEK, 'work_week', Views.DAY, Views.AGENDA], []);

  // Helpers per stampa
  function filterEventsRange(fromDate, toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23,59,59,999);
    return events.filter(ev => (ev.start <= to && ev.end >= from)).sort((a,b)=>a.start-b.start);
  }

  function buildBaseStyle(fontSize) {
    return `
      <style>
        @page { size: A4 portrait; margin: 18mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: ${fontSize}px; }
        h1 { font-size: ${Math.round(fontSize * 1.5)}px; margin-bottom: 8px; }
        .calendar-wrap { width: 100%; }
        .month-grid { width: 100%; border-collapse: collapse; }
        .month-grid td, .month-grid th { border: 1px solid #ddd; vertical-align: top; padding: 6px; height: 110px; }
        .month-grid th { background: #f3f3f3; text-align: center; font-weight: 600; }
        .day-number { font-weight: 700; margin-bottom: 6px; display:block; }
        .event { margin-bottom: 4px; padding: 2px 4px; background: #f1f8ff; border-radius: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .week-grid { width: 100%; border-collapse: collapse; }
        .week-grid th, .week-grid td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
        .list-item { margin-bottom: 10px; border-bottom: 1px dashed #ccc; padding-bottom: 6px; }
        .meta { color: #555; font-size: 0.95em; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    `;
  }

  function buildMonthHtml(monthDate, fontSize) {
    const date = new Date(monthDate);
    const start = startOfWeek(startOfMonth(date), { locale: locales[userLang] || enUS });
    const end = endOfWeek(endOfMonth(date), { locale: locales[userLang] || enUS });

    let html = '<div class="calendar-wrap">';
    html += `<table class="month-grid" role="table"><thead><tr>`;
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      weekDays.push(format(d, 'EEEEEE', { locale: locales[userLang] || enUS }));
      html += `<th>${format(d, 'iiii', { locale: locales[userLang] || enUS })}</th>`;
    }
    html += '</tr></thead><tbody>';

    let curr = start;
    while (curr <= end) {
      html += '<tr>';
      for (let i = 0; i < 7; i++) {
        const day = addDays(curr, i);
        const dayKey = day.toISOString().slice(0,10);
        const dayEvents = events.filter(ev => format(new Date(ev.start), 'yyyy-MM-dd') === dayKey);
        const muted = isSameMonth(day, date) ? '' : 'style="background:#fafafa;color:#888"';
        html += `<td ${muted}><span class="day-number">${format(day, 'd', { locale: locales[userLang] || enUS })}</span>`;
        dayEvents.forEach(ev => {
          html += `<div class="event">${escapeHtml(ev.title || '(senza titolo)')}</div>`;
        });
        html += '</td>';
      }
      html += '</tr>';
      curr = addDays(curr, 7);
    }

    html += '</tbody></table></div>';
    return html;
  }

  function buildWeekHtml(weekDate, fontSize) {
    const date = new Date(weekDate);
    const start = startOfWeek(date, { locale: locales[userLang] || enUS });
    const end = endOfWeek(date, { locale: locales[userLang] || enUS });
    let html = '<div class="calendar-wrap">';
    html += `<table class="week-grid"><thead><tr>`;
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      html += `<th>${format(d, 'iiii d MMM', { locale: locales[userLang] || enUS })}</th>`;
    }
    html += `</tr></thead><tbody><tr>`;
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const dayKey = d.toISOString().slice(0,10);
      const dayEvents = events.filter(ev => format(new Date(ev.start), 'yyyy-MM-dd') === dayKey);
      html += `<td>`;
      dayEvents.forEach(ev => {
        html += `<div class="event"><div class="title">${escapeHtml(ev.title || '(senza titolo)')}</div><div class="meta">${format(new Date(ev.start), 'HH:mm', { locale: locales[userLang] || enUS })} - ${format(new Date(ev.end), 'HH:mm', { locale: locales[userLang] || enUS })}</div></div>`;
      });
      html += `</td>`;
    }
    html += `</tr></tbody></table></div>`;
    return html;
  }

  function buildDayHtml(dayDate, fontSize) {
    const d = new Date(dayDate);
    const dayKey = d.toISOString().slice(0,10);
    const dayEvents = events.filter(ev => format(new Date(ev.start), 'yyyy-MM-dd') === dayKey).sort((a,b)=>a.start-b.start);
    let html = `<div class="calendar-wrap"><h2>${format(d, 'EEEE, d MMMM yyyy', { locale: locales[userLang] || enUS })}</h2>`;
    if (dayEvents.length === 0) {
      html += '<p>Nessun evento.</p>';
    } else {
      dayEvents.forEach(ev => {
        html += `<div class="list-item"><div class="title">${escapeHtml(ev.title || '(senza titolo)')}</div><div class="meta">${format(new Date(ev.start), 'HH:mm', { locale: locales[userLang] || enUS })} - ${format(new Date(ev.end), 'HH:mm', { locale: locales[userLang] || enUS })}${ev.location ? ' • ' + escapeHtml(ev.location) : ''}</div>${ev.description ? '<div class="desc">'+escapeHtml(ev.description)+'</div>' : ''}</div>`;
      });
    }
    html += `</div>`;
    return html;
  }

  function buildListHtml(fromDate, toDate, fontSize) {
    const list = filterEventsRange(fromDate, toDate);
    let html = '<div class="calendar-wrap">';
    if (list.length === 0) {
      html += '<p>Nessun evento nel range selezionato.</p>';
    } else {
      let lastDay = '';
      list.forEach(ev => {
        const dayKey = format(new Date(ev.start), 'yyyy-MM-dd');
        if (dayKey !== lastDay) {
          html += `<h3 style="margin-top:14px">${format(new Date(ev.start), 'EEEE, d MMMM yyyy', { locale: locales[userLang] || enUS })}</h3>`;
          lastDay = dayKey;
        }
        html += `<div class="list-item"><div class="title">${escapeHtml(ev.title || '(senza titolo)')}</div><div class="meta">${format(new Date(ev.start), 'HH:mm', { locale: locales[userLang] || enUS })} - ${format(new Date(ev.end), 'HH:mm', { locale: locales[userLang] || enUS })}${ev.location ? ' • ' + escapeHtml(ev.location) : ''}</div>${ev.description ? '<div class="desc">'+escapeHtml(ev.description)+'</div>' : ''}</div>`;
      });
    }
    html += '</div>';
    return html;
  }

  function doPrint() {
    const fontSize = Number(printFontSize) || 12;
    let html = '<!doctype html><html><head><meta charset="utf-8">';
    html += buildBaseStyle(fontSize);
    html += '</head><body>';
    html += `<h1>Stampa calendario - ${printView}</h1>`;
    if (printView === 'month') {
      html += buildMonthHtml(printDate, fontSize);
    } else if (printView === 'week') {
      html += buildWeekHtml(printDate, fontSize);
    } else if (printView === 'day') {
      html += buildDayHtml(printDate, fontSize);
    } else {
      html += buildListHtml(printFrom, printTo, fontSize);
    }
    html += `<script>setTimeout(()=>window.print(),200);</script></body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      alert('Popup bloccati: abilita i popup per poter stampare.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setPrintModalOpen(false);
  }

  return (
    <main>
      <section style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Vista:
            <select value={view} onChange={e => setView(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="month">Mese</option>
              <option value="week">Settimana</option>
              <option value="work_week">Settimana lavorativa (lun‑ven)</option>
              <option value="day">Giorno</option>
              <option value="agenda">Elenco (Agenda)</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={() => setPrintModalOpen(true)}>Stampa (A4)</button>
          {loading && <span style={{ marginLeft: 8 }}>Caricamento...</span>}
        </div>
      </section>

      <section style={{ height: '75vh' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={allViews}
          defaultView={view === 'work_week' ? Views.WEEK : view}
          onView={(v) => {
            // mappa work_week a week per il controllo interno della libreria
            if (v === 'work_week') {
              setView('work_week');
            } else {
              setView(v);
            }
          }}
          components={{
            // possibile override futuro
          }}
          style={{ height: '100%' }}
          formats={{
            weekdayFormat: (date, culture, localizer) => format(date, 'iiii', { locale: locales[userLang] || enUS })
          }}
          // mostra al massimo 3 eventi e poi il link "+X"
          dayMaxEvents={3}
          onSelectEvent={(event) => {
            setSelectedEvent(event);
          }}
          onShowMore={(eventsList, date) => {
            // eventsList è l'array di eventi non mostrati; apri modal con gli eventi completi del giorno
            setShowMoreModal({ open: true, date, events: eventsList });
          }}
        />
      </section>

      {/* Modal singolo evento */}
      {selectedEvent && (
        <div className="rbc-modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="rbc-modal" onClick={e => e.stopPropagation()}>
            <div className="rbc-modal-header">
              <h3>{selectedEvent.title || 'Evento'}</h3>
              <button onClick={() => setSelectedEvent(null)}>×</button>
            </div>
            <div className="rbc-modal-body">
              <p><strong>Inizio:</strong> {selectedEvent.start ? new Date(selectedEvent.start).toLocaleString() : '-'}</p>
              <p><strong>Fine:</strong> {selectedEvent.end ? new Date(selectedEvent.end).toLocaleString() : '-'}</p>
              {selectedEvent.location && <p><strong>Luogo:</strong> {selectedEvent.location}</p>}
              {selectedEvent.description && (
                <div className="rbc-event-description" dangerouslySetInnerHTML={{ __html: escapeHtml(selectedEvent.description) }} />
              )}
              {selectedEvent.url && <p><a href={selectedEvent.url} target="_blank" rel="noreferrer">Apri link evento</a></p>}
            </div>
            <div className="rbc-modal-footer">
              <button onClick={() => setSelectedEvent(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lista eventi (quando +X) */}
      {showMoreModal.open && (
        <div className="rbc-modal-backdrop" onClick={() => setShowMoreModal({ open: false, date: null, events: [] })}>
          <div className="rbc-modal large" onClick={e => e.stopPropagation()}>
            <div className="rbc-modal-header">
              <h3>Eventi del {showMoreModal.date instanceof Date ? showMoreModal.date.toLocaleDateString() : String(showMoreModal.date)}</h3>
              <button onClick={() => setShowMoreModal({ open: false, date: null, events: [] })}>×</button>
            </div>
            <div className="rbc-modal-body">
              {(!showMoreModal.events || showMoreModal.events.length === 0) && <p>Nessun evento</p>}
              {showMoreModal.events.map((ev, idx) => (
                <div key={idx} className="event-item">
                  <h4>{ev.title || '(senza titolo)'}</h4>
                  <div className="muted">{ev.start ? new Date(ev.start).toLocaleString() : ''} - {ev.end ? new Date(ev.end).toLocaleString() : ''}</div>
                  {ev.description && <div dangerouslySetInnerHTML={{ __html: escapeHtml(ev.description) }} />}
                </div>
              ))}
            </div>
            <div className="rbc-modal-footer">
              <button onClick={() => setShowMoreModal({ open: false, date: null, events: [] })}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal di configurazione stampa */}
      {printModalOpen && (
        <div className="rbc-modal-backdrop" onClick={() => setPrintModalOpen(false)}>
          <div className="rbc-modal" onClick={e => e.stopPropagation()}>
            <div className="rbc-modal-header">
              <h3>Impostazioni stampa A4</h3>
              <button onClick={() => setPrintModalOpen(false)}>×</button>
            </div>
            <div className="rbc-modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>
                  Tipo stampa:
                  <select value={printView} onChange={e => setPrintView(e.target.value)} style={{ marginLeft: 8 }}>
                    <option value="month">Mese</option>
                    <option value="week">Settimana</option>
                    <option value="day">Giorno</option>
                    <option value="list">Lista</option>
                  </select>
                </label>

                <label>
                  Dimensione font (px):
                  <select value={printFontSize} onChange={e => setPrintFontSize(e.target.value)} style={{ marginLeft: 8 }}>
                    <option value="10">10</option>
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                  </select>
                </label>
              </div>

              <div style={{ marginTop: 12 }}>
                {printView === 'list' ? (
                  <>
                    <label>Da: <input type="date" value={printFrom} onChange={e => setPrintFrom(e.target.value)} /></label>
                    <label style={{ marginLeft: 12 }}>A: <input type="date" value={printTo} onChange={e => setPrintTo(e.target.value)} /></label>
                  </>
                ) : (
                  <>
                    <label>Data di riferimento: <input type="date" value={printDate} onChange={e => setPrintDate(e.target.value)} /></label>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 6 }}>
                      (Per Mese: verrà stampato il mese della data selezionata. Per Settimana: la settimana contenente la data. Per Giorno: il giorno selezionato.)
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="rbc-modal-footer">
              <button onClick={() => setPrintModalOpen(false)} style={{ marginRight: 8 }}>Annulla</button>
              <button onClick={doPrint}>Stampa</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Helpers
function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}