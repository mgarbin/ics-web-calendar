const express = require('express');
const axios = require('axios');
const ical = require('node-ical');
const cors = require('cors');
const { URL } = require('url');

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Basic hostname check to avoid obvious SSRF to localhost / private ranges.
 * Note: this is a best-effort check — full protection requires more advanced checks (DNS resolution, network policies).
 */
function isPrivateHost(host) {
  if (!host) return false;
  const h = host.split(':')[0].toLowerCase();
  if (h === 'localhost' || h === 'loopback') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if (h === '::1') return true;
  return false;
}

/**
 * Validate URL: protocol, hostname not private, basic length
 */
function validateUrlString(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return { ok: false, reason: 'Missing or invalid URL' };
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch (err) {
    return { ok: false, reason: 'URL non valida' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: 'Solo protocolli http(s) sono permessi' };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, reason: 'Hostname non valido (localhost o indirizzo privato non consentito)' };
  }
  if (urlStr.length > 2000) {
    return { ok: false, reason: 'URL troppo lungo' };
  }
  return { ok: true, parsed };
}

app.get('/api/ics', async (req, res) => {
  const { url } = req.query;
  const v = validateUrlString(url);
  if (!v.ok) return res.status(400).json({ error: v.reason });

  try {
    // Try HEAD first to validate content-type when available
    let contentType;
    try {
      const headResp = await axios.head(url, { timeout: 5000, maxRedirects: 5, validateStatus: null });
      contentType = headResp.headers['content-type'];
    } catch (err) {
      contentType = undefined;
    }

    const urlLooksLikeIcs = /\.ics(\?.*)?$/i.test(url);
    if (contentType && !/text\/calendar|application\/calendar|text\/vcalendar/i.test(contentType) && !urlLooksLikeIcs) {
      return res.status(400).json({ error: `Content-Type non sembra un ICS: ${contentType}` });
    }

    const response = await axios.get(url, {
      responseType: 'text',
      timeout: 15000,
      maxRedirects: 5,
      maxContentLength: 10 * 1024 * 1024,
      validateStatus: status => status >= 200 && status < 400
    });

    const data = response.data;
    const parsed = ical.parseICS(data);

    const events = Object.values(parsed)
      .filter(item => item && item.type === 'VEVENT')
      .map(item => ({
        id: item.uid || item.seq || Math.random().toString(36).slice(2),
        title: item.summary || '(no title)',
        start: item.start ? new Date(item.start) : null,
        end: item.end ? new Date(item.end) : null,
        allDay: !!(item.datetype && item.datetype === 'date'),
        description: item.description || '',
        location: item.location || ''
      }));

    res.json({ events });
  } catch (err) {
    console.error('Error fetching/parsing ics:', err.message || err);
    if (err.response && err.response.status) {
      return res.status(502).json({ error: 'Failed fetching remote ICS', status: err.response.status });
    }
    res.status(500).json({ error: 'Failed to fetch or parse ICS', details: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ICS proxy server listening on http://localhost:${PORT}`);
});
