#!/usr/bin/env node

/**
 * Script di verifica del deployment
 * Testa che il server WebSocket sia raggiungibile
 */

import https from 'https'

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

function log(color, symbol, message) {
  console.log(`${color}${symbol}${COLORS.reset} ${message}`)
}

function testWebSocketServer(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('wss://') ? 'https://' : 'http://'
    const testUrl = url.replace('wss://', protocol).replace('ws://', protocol)
    
    log(COLORS.cyan, '🔍', `Testing WebSocket server: ${testUrl}`)
    
    https.get(testUrl, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (data.includes('y-websocket running')) {
          log(COLORS.green, '✅', 'WebSocket server is running correctly!')
          resolve(true)
        } else {
          log(COLORS.red, '❌', `Unexpected response: ${data}`)
          resolve(false)
        }
      })
    }).on('error', (err) => {
      log(COLORS.red, '❌', `Connection failed: ${err.message}`)
      resolve(false)
    })
  })
}

async function main() {
  console.log('\n' + '='.repeat(60))
  log(COLORS.cyan, '🚀', 'C-Level Primitives Deployment Verification')
  console.log('='.repeat(60) + '\n')
  
  const wsUrl = process.env.VITE_COLLAB_ENDPOINT
  
  if (!wsUrl) {
    log(COLORS.yellow, '⚠️', 'VITE_COLLAB_ENDPOINT not set')
    log(COLORS.yellow, 'ℹ️', 'Testing with localhost...')
    await testWebSocketServer('ws://localhost:1234')
  } else {
    log(COLORS.cyan, 'ℹ️', `VITE_COLLAB_ENDPOINT: ${wsUrl}`)
    await testWebSocketServer(wsUrl)
  }
  
  console.log('\n' + '='.repeat(60))
  log(COLORS.cyan, '📝', 'Next Steps:')
  console.log('='.repeat(60))
  console.log('1. Deploy WebSocket server to Railway/Render')
  console.log('2. Get the public URL (e.g., wss://your-app.railway.app)')
  console.log('3. Set VITE_COLLAB_ENDPOINT in Vercel environment variables')
  console.log('4. Deploy frontend to Vercel with: vercel --prod')
  console.log('5. Test the app with multiple browser windows\n')
}

main()


