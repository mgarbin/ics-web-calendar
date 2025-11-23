# ics-web-calendar

Applicazione web che scarica un file .ics da una URL pubblica, lo converte in eventi e li mostra in un'interfaccia React con react-big-calendar.

Caratteristiche:
- Server Express che scarica e valida file .ics (proxy per evitare CORS)
- Client React (Vite) con react-big-calendar
- Viste: mese / settimana / settimana lavorativa (lun‑ven) / giorno / elenco (agenda)
- Stampa su A4 di un intervallo selezionato
- Validazione URL client-side e server-side (semplice protezione SSRF e content-type check)

Struttura progetto:
- server/: server Node/Express
- client/: client React (Vite)

Quickstart (sviluppo):
1. Avvia il server
   cd server
   npm install
   npm start

2. Avvia il client
   cd client
   npm install
   npm run dev

Server predefinito: http://localhost:4000
Client predefinito: http://localhost:5173

Uso:
- Incolla una URL .ics nella UI e premi "Carica" oppure apri direttamente con:
  http://localhost:5173/?url=https%3A%2F%2Fexample.com%2Fcalendar.ics

Note di sicurezza:
- Il server effettua controlli base per evitare richieste a host locali o range privati. Non è una protezione completa contro SSRF; per scenari di produzione valutare hardening aggiuntivo (risoluzione DNS, proxy con whitelist, VPC, ecc.).

License: MIT
