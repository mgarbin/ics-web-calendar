import React, { useState, useEffect } from 'react';
import CalendarView from './CalendarView';
import './print.css';

/**
 * Client-side URL validation:
 * - must be a valid URL with http/https
 * - simple check for .ics extension (heuristic; server further validates)
 */
function clientValidateUrl(url) {
  if (!url || typeof url !== 'string') return { ok: false, reason: 'Inserisci un URL' };
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return { ok: false, reason: 'URL non valido' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: 'Usa http o https' };
  }
  // opzionale: incoraggiare .ics
  if (!/\.ics(\?.*)?$/i.test(parsed.pathname)) {
    return { ok: true, reason: 'L\\'URL non termina con .ics; il server verificherà comunque il file' };
  }
  return { ok: true };
}

export default function App() {
  const [icsUrl, setIcsUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState(null);

  // Legge il parametro ?url=... all'avvio e lo carica automaticamente
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('url');
      if (urlParam) {
        setIcsUrl(urlParam);
        setLoadedUrl(urlParam);
      }
    } catch (err) {
      console.warn('Errore parsing query string', err);
    }
  }, []);

  const handleLoad = (e) => {
    e && e.preventDefault();
    const validation = clientValidateUrl(icsUrl);
    if (!validation.ok) {
      alert(validation.reason || 'URL non valido');
      return;
    }
    // Aggiorna la query string per poter condividere il link
    try {
      const newUrl = `${window.location.pathname}?url=${encodeURIComponent(icsUrl)}`;
      window.history.replaceState(null, '', newUrl);
    } catch (err) {
      console.warn('history.replaceState non disponibile', err);
    }
    setLoadedUrl(icsUrl);
  };

  return (
    <div className="app">
      <header>
        <h1>Visualizzatore Calendario .ics</h1>
        <form onSubmit={handleLoad} className="url-form">
          <input
            type="url"
            placeholder="Inserisci URL del file .ics"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            style={{ width: '60%' }}
          />
          <button type="submit">Carica</button>
        </form>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          Puoi aprire direttamente l'app con ?url=URL_DEL_FILE_ICS per caricare il calendario all'avvio.
        </p>
      </header>

      {loadedUrl ? (
        <CalendarView icsUrl={loadedUrl} />
      ) : (
        <main>
          <p>Incolla una URL .ics e premi "Carica" per visualizzare il calendario.</p>
        </main>
      )}
    </div>
  );
}
