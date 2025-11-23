import axios from 'axios';

/**
 * fetchIcs(url)
 * chiama il server (assunto in http://localhost:4000) per scaricare e parsare l'ICS
 * restituisce { events: [...] }
 */
export async function fetchIcs(url) {
  const apiUrl = 'http://localhost:4000/api/ics?url=' + encodeURIComponent(url);
  const resp = await axios.get(apiUrl);
  return resp.data; // { events: [...] }
}
