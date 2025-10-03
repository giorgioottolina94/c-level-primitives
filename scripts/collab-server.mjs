import http from 'http'
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'

const port = Number(process.env.PORT ?? 1234)
const host = process.env.HOST ?? '0.0.0.0'

const server = http.createServer((_req, res) => {
  res.writeHead(200)
  res.end('y-websocket running')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (socket, request) => {
  const url = request.url || ''
  const docName = url.slice(1).split('?')[0]
  setupWSConnection(socket, request, { docName })
})

server.listen(port, host, () => {
  console.log(`Collaboration server ready at ws://${host}:${port}`)
})
