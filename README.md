# GenAI Primitives Workshop Board

Web app collaborativa per costruire schemi di processo a partire dalle primitive GenAI mostrate in slide. Ogni partecipante può trascinare i blocchi sul canvas, collegarli, prendere appunti e lavorare in tempo reale con il proprio team.

## Funzionalità principali

- Palette di primitive completa, suddivisa per categoria con ricerca istantanea.
- Canvas interattivo con snap-to-grid, collegamenti drag-and-drop e minimappa.
- Nota testuale su ciascun blocco per annotazioni di workshop.
- Sincronizzazione in tempo reale tramite Yjs + WebSocket (multi-utente).
- Gestione multi-board con switch rapido e salvataggio locale automatico delle bozze.
- Esportazione rapida della board in PNG o JSON per documentazione post-workshop.
- Gestione multi-board: l'ID della board è condiviso nell'URL e può essere rigenerato al volo.

## Prerequisiti

- Node.js 18+ (testato con Node 22.17.0)

## Installazione

```bash
npm install
```

## Avvio in locale

In due terminal diversi:

```bash
# 1. Avvia il server di collaborazione Yjs
npm run collab:server

# 2. Avvia l'interfaccia Vite
npm run dev
```

La UI è disponibile su `http://localhost:5173`. Il server WebSocket è in ascolto su `ws://localhost:1234` (configurabile con `VITE_COLLAB_ENDPOINT`).

## Variabili d'ambiente

- `VITE_COLLAB_ENDPOINT`: URL del server WebSocket per la collaborazione (default `ws://localhost:1234`). Impostala prima del build/deploy per puntare al server pubblico.

## Build di produzione

```bash
npm run build
```

L'output viene generato in `dist/`. Per servire la build localmente:

```bash
npm run preview
```

## Struttura principale

- `src/data/primitives.ts`: catalogo delle primitive con metadati.
- `src/hooks/useCollaborativeFlow.ts`: logica di sincronizzazione Yjs + React Flow.
- `scripts/collab-server.mjs`: server WebSocket minimale basato su `y-websocket`.

## Deployment in produzione

L'app è composta da due componenti separati che devono essere deployati su servizi diversi:

### 1. Frontend (Vercel) ✅

Il frontend React può essere deployato su Vercel con questi passi:

1. Installa Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Dalla directory `app`, esegui:
   ```bash
   vercel
   ```

3. Segui le istruzioni interattive per collegare il progetto.

4. Configura la variabile d'ambiente `VITE_COLLAB_ENDPOINT` nelle impostazioni Vercel (es. `wss://your-websocket-server.railway.app`).

### 2. WebSocket Server (Railway/Render) ✅

Il server WebSocket NON può girare su Vercel. Usa Railway o Render (gratuiti):

#### Opzione A: Railway

1. Crea un account su [railway.app](https://railway.app)
2. Clicca su "New Project" → "Deploy from GitHub repo"
3. Seleziona questa repo
4. Railway rileverà automaticamente `railway.json` e `package.json`
5. Imposta la variabile `PORT` se necessario (default 1234)
6. Copia l'URL pubblico generato (es. `your-app.railway.app`)
7. Usa `wss://your-app.railway.app` come `VITE_COLLAB_ENDPOINT`

#### Opzione B: Render

1. Crea un account su [render.com](https://render.com)
2. Clicca su "New" → "Web Service"
3. Connetti la repo GitHub
4. Imposta:
   - **Build Command**: `npm install`
   - **Start Command**: `node scripts/collab-server.mjs`
   - **Environment**: Node
5. Copia l'URL pubblico generato
6. Usa `wss://your-app.onrender.com` come `VITE_COLLAB_ENDPOINT`

### Flusso completo

```
Frontend (Vercel) → WebSocket Server (Railway/Render)
     ↓                        ↓
  Utenti                  Y.js sync
```

## Prossimi miglioramenti suggeriti

1. Aggiungere autenticazione leggera o token room-based per workshop esterni.
2. Implementare cronologia/undo condiviso tramite `yjs` UndoManager.
3. Integrare preset precompilati (template di processi) caricabili dalla palette.
