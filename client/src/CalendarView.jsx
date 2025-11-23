import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, Views, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import itLocale from 'date-fns/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { fetchIcs } from './icsService';

const locales = {
  'it': itLocale
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: itLocale }),
  getDay,
  locales
});

export default function CalendarView({ icsUrl }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(Views.MONTH);
  const [printRange, setPrintRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(new Date().getTime() + 7*24*3600*1000), 'yyyy-MM-dd')
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        // Assumi server su stessa origine (proxy) /api/ics
        const data = await fetchIcs(icsUrl);
        // react-big-calendar vuole Date oggetti su start/end
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

  const handlePrint = () => {
    // filtra eventi nel range
    const from = new Date(printRange.from);
    const to = new Date(printRange.to);
    // include tutto il giorno di 'to'
    to.setHours(23,59,59,999);

    const eventsToPrint = events.filter(ev => {
      return ev.start <= to && ev.end >= from;
    }).sort((a,b)=>a.start-b.start);

    // Costruisci html stampabile e apri nuova finestra
    const win = window.open('', '_blank');
    const style = `
      <style>
        @page { size: A4 portrait; margin: 20mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; }
        h1 { font-size: 18px; margin-bottom: 8px; }
        .event { margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        .meta { color: #555; font-size: 0.95rem; }
        .title { font-weight: bold; font-size: 1.05rem; }
        .day { margin-top: 12px; margin-bottom: 6px; font-weight: bold; font-size: 1.05rem; }
        table { width: 100%; border-collapse: collapse; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    `;
    let html = `<!doctype html><html><head><meta charset="utf-8">${style}</head><body>`;
    html += `<h1>Calendario: ${eventsToPrint.length} eventi (${formatDate(from)} → ${formatDate(to)})</h1>`;

    if (eventsToPrint.length === 0) {
      html += '<p>Nessun evento nel range selezionato.</p>';
    } else {
      // raggruppa per giorno
      const groups = {};
      eventsToPrint.forEach(ev => {
        const dayKey = ev.start.toISOString().slice(0,10);
        if (!groups[dayKey]) groups[dayKey] = [];
        groups[dayKey].push(ev);
      });
      for (const day of Object.keys(groups).sort()) {
        html += `<div class="day">${day}</div>`;
        groups[day].forEach(ev => {
          html += `<div class="event">
            <div class="title">${escapeHtml(ev.title)}</div>
            <div class="meta">${formatDateTime(ev.start)} — ${formatDateTime(ev.end)}${ev.location ? ' • ' + escapeHtml(ev.location) : ''}</div>
            ${ev.description ? `<div class="desc">${escapeHtml(ev.description)}</div>` : ''}
          </div>`;
        });
      }
    }

    html += `<script>setTimeout(()=>window.print(),300);</script></body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

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
          <div>
            <label>Da: <input type="date" value={printRange.from} onChange={e => setPrintRange({...printRange, from: e.target.value})} /></label>
          </div>
          <div>
            <label>A: <input type="date" value={printRange.to} onChange={e => setPrintRange({...printRange, to: e.target.value})} /></label>
          </div>
          <button onClick={handlePrint}>Stampa (A4)</button>
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
            // puoi aggiungere override (opzionale)
          }}
          style={{ height: '100%' }}
          formats={{
            weekdayFormat: (date, culture, localizer) => format(date, 'iiii', { locale: itLocale })
          }}
        />
      </section>
    </main>
  );
}

// Helpers
function formatDate(d) {
  return d.toLocaleDateString();
}
function formatDateTime(d) {
  return d.toLocaleString();
}
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}
