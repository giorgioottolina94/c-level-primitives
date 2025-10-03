#!/usr/bin/env node

import { spawn, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

console.log('🔄 RESTART COLLAB SERVER - Avvio procedura reset completo...')

async function restartCollabServer() {
  try {
    console.log('📡 1. Ricerca processi collab-server attivi...')
    
    // 1. Trova tutti i processi collab-server attivi
    const { stdout: psOutput } = await execAsync('ps aux | grep collab-server | grep -v grep')
    const processes = psOutput.trim().split('\n').filter(line => line.includes('collab-server.mjs'))
    
    if (processes.length === 0) {
      console.log('ℹ️ Nessun processo collab-server trovato')
    } else {
      console.log(`💀 2. Termino ${processes.length} processi collab-server...`)
      
      // 2. Killa tutti i processi collab-server
      for (const process of processes) {
        const pid = process.split(/\s+/)[1]
        try {
          await execAsync(`kill -9 ${pid}`)
          console.log(`   ✅ Terminato processo PID ${pid}`)
        } catch (error) {
          console.log(`   ⚠️ Impossibile terminare PID ${pid}: ${error.message}`)
        }
      }
    }

    // 3. Aspetta un momento per la pulizia
    console.log('⏳ 3. Attesa pulizia memoria...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 4. Riavvia il collab-server
    console.log('🚀 4. Riavvio collab-server...')
    
    const newProcess = spawn('node', ['scripts/collab-server.mjs'], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    })
    
    // Detach il processo in modo che continui anche se questo script termina
    newProcess.unref()
    
    console.log(`✅ 5. Collab-server riavviato con PID ${newProcess.pid}`)
    console.log('🎉 RESET COMPLETO COMPLETATO!')
    console.log('   - Tutte le board Y.js sono state cancellate dalla memoria')
    console.log('   - Il server è pronto per nuove connessioni')
    
    return { success: true, pid: newProcess.pid }
    
  } catch (error) {
    console.error('❌ Errore durante il restart:', error.message)
    return { success: false, error: error.message }
  }
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  restartCollabServer()
    .then(result => {
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Errore fatale:', error)
      process.exit(1)
    })
}

export { restartCollabServer }
