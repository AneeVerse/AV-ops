import net from 'node:net'

const listenHost = '172.20.0.1'
const listenPort = 8765
const targetHost = '127.0.0.1'
const targetPort = 8765

function allowed (address) {
  const value = String(address || '')
  return value === '172.20.0.1' || value.startsWith('172.20.') || value.startsWith('::ffff:172.20.')
}

const server = net.createServer((socket) => {
  if (!allowed(socket.remoteAddress)) {
    socket.destroy()
    return
  }
  const upstream = net.connect(targetPort, targetHost)
  const closeBoth = () => {
    socket.destroy()
    upstream.destroy()
  }
  socket.on('error', closeBoth)
  upstream.on('error', closeBoth)
  socket.pipe(upstream)
  upstream.pipe(socket)
})

server.listen(listenPort, listenHost, () => {
  console.log(JSON.stringify({ ok: true, listen: `${listenHost}:${listenPort}`, target: `${targetHost}:${targetPort}` }))
})
