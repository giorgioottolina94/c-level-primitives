# Guida al Deployment - C-Level Primitives

Questa guida ti accompagna passo-passo nel deployment dell'applicazione C-Level Primitives in produzione.

## 📋 Prerequisiti

- Account GitHub (per connettere le repo)
- Account Vercel (gratuito)
- Account Railway o Render (gratuiti)

## 🏗️ Architettura

L'app è divisa in **due componenti separati**:

```
┌─────────────┐         ┌──────────────────┐
│   Frontend  │ ───────>│  WebSocket       │
│   (Vercel)  │  WSS    │  Server          │
│             │ <───────│  (Railway/Render)│
└─────────────┘         └──────────────────┘
```

## 🚀 Parte 1: Deploy del WebSocket Server

**⚠️ IMPORTANTE**: Deploya PRIMA il WebSocket server, perché ti serve l'URL per configurare il frontend.

### Opzione A: Railway (Consigliata)

1. **Crea un account** su [railway.app](https://railway.app)

2. **Pusca il codice su GitHub** (se non l'hai già fatto):
   ```bash
   cd "/Users/giorgioottolina/Downloads/c-level primitives/app"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

3. **Deploy su Railway**:
   - Clicca su "New Project"
   - Seleziona "Deploy from GitHub repo"
   - Scegli la repository
   - Railway rileverà automaticamente `railway.json` e `package.json`
   - Clicca su "Deploy"

4. **Genera un dominio pubblico**:
   - Vai su "Settings" → "Networking"
   - Clicca su "Generate Domain"
   - Copia l'URL generato (es. `c-level-collab-server.up.railway.app`)

5. **Testa il server**:
   ```bash
   curl https://c-level-collab-server.up.railway.app
   # Dovresti vedere: "y-websocket running"
   ```

6. **Salva l'URL WebSocket**:
   ```
   wss://c-level-collab-server.up.railway.app
   ```
   ⚠️ Nota: usa `wss://` (non `https://`)

### Opzione B: Render

1. **Crea un account** su [render.com](https://render.com)

2. **Pusca il codice su GitHub** (se non l'hai già fatto)

3. **Deploy su Render**:
   - Clicca su "New" → "Web Service"
   - Connetti la repo GitHub
   - Configurazione:
     - **Name**: `c-level-collab-server`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `node scripts/collab-server.mjs`
     - **Plan**: Free
   - Clicca su "Create Web Service"

4. **Copia l'URL generato** (es. `https://c-level-collab-server.onrender.com`)

5. **Testa il server**:
   ```bash
   curl https://c-level-collab-server.onrender.com
   # Dovresti vedere: "y-websocket running"
   ```

6. **Salva l'URL WebSocket**:
   ```
   wss://c-level-collab-server.onrender.com
   ```

## 🎨 Parte 2: Deploy del Frontend su Vercel

1. **Installa Vercel CLI** (se non ce l'hai):
   ```bash
   npm i -g vercel
   ```

2. **Login su Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy dalla directory `app`**:
   ```bash
   cd "/Users/giorgioottolina/Downloads/c-level primitives/app"
   vercel
   ```

4. **Configurazione interattiva**:
   - "Set up and deploy"? → **Yes**
   - "Which scope"? → Seleziona il tuo account
   - "Link to existing project"? → **No**
   - "What's your project's name"? → `c-level-primitives` (o un nome a tua scelta)
   - "In which directory is your code located"? → `./` (conferma)
   - "Want to override the settings"? → **No**

5. **Configura la variabile d'ambiente** (CRUCIALE):
   
   Vai su [vercel.com](https://vercel.com) → Il tuo progetto → Settings → Environment Variables
   
   Aggiungi:
   - **Name**: `VITE_COLLAB_ENDPOINT`
   - **Value**: `wss://c-level-collab-server.up.railway.app` (o l'URL Render)
   - **Environment**: Production, Preview, Development (seleziona tutti)
   
   Clicca su "Save"

6. **Rideploy con la variabile** (importante!):
   ```bash
   vercel --prod
   ```

7. **Testa l'app**:
   - Apri l'URL fornito da Vercel (es. `https://c-level-primitives.vercel.app`)
   - Controlla la console del browser per eventuali errori WebSocket
   - Apri la stessa URL in un'altra finestra per testare la collaborazione real-time

## ✅ Verifica del Deployment

### Frontend (Vercel)
- [ ] L'app si carica correttamente
- [ ] Puoi trascinare blocchi sul canvas
- [ ] La board si salva in localStorage

### WebSocket Server
- [ ] Il server risponde a `curl https://your-server-url`
- [ ] La console del browser non mostra errori WebSocket
- [ ] Aprendo l'app in due finestre diverse, le modifiche si sincronizzano

### Test di Collaborazione
1. Apri l'app in due browser diversi (o finestre incognito)
2. Usa lo stesso URL/board ID
3. Trascina un blocco in una finestra
4. Verifica che appaia immediatamente nell'altra finestra

## 🔧 Troubleshooting

### Errore: "WebSocket connection failed"

**Causa**: Il frontend non riesce a connettersi al server WebSocket.

**Soluzione**:
1. Verifica che `VITE_COLLAB_ENDPOINT` sia configurata correttamente su Vercel
2. Controlla che l'URL usi `wss://` (non `ws://` o `https://`)
3. Testa il server WebSocket con `curl`
4. Assicurati di aver fatto un redeploy dopo aver aggiunto la variabile

### Errore: "Module not found: y-websocket"

**Causa**: Il server non ha installato le dipendenze.

**Soluzione**: Railway/Render dovrebbero installarle automaticamente. Verifica i log di build.

### Le modifiche non si sincronizzano

**Causa**: Problemi di connessione WebSocket o board ID diversi.

**Soluzione**:
1. Verifica che entrambi i client usino lo stesso URL/board ID
2. Controlla la console del browser per errori
3. Ricarica la pagina per forzare una nuova connessione

### Railway: "Service Restarting"

**Causa**: Il processo potrebbe crashare per mancanza di risorse (piano gratuito).

**Soluzione**:
1. Controlla i log su Railway
2. Considera di usare Render se il problema persiste
3. Railway offre $5/mese di credito gratuito

## 🔄 Aggiornamenti Futuri

Per aggiornare l'app dopo modifiche:

### Frontend:
```bash
cd app
vercel --prod
```

### Backend:
- **Railway**: Fai un nuovo commit e push su GitHub → deploy automatico
- **Render**: Vai su Dashboard → Manual Deploy → Deploy latest commit

## 📞 Supporto

Se incontri problemi:
1. Controlla i log di Vercel: `vercel logs`
2. Controlla i log del WebSocket server su Railway/Render
3. Verifica le variabili d'ambiente

## 🎉 Deployment Completato!

Una volta completati tutti i passi, l'app sarà:
- ✅ Pubblica e accessibile via HTTPS
- ✅ Con collaborazione real-time funzionante
- ✅ Scalabile e affidabile
- ✅ Gratuita (per volumi moderati)

Condividi l'URL Vercel con i partecipanti del workshop e inizia a collaborare! 🚀


