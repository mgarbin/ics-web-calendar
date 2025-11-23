import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, Views, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
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
          {/* Nota: la funzionalità di stampa è stata rimossa per rispettare la richiesta */}
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
    </main>
  );
}

// Helpers
function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}