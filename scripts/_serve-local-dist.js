#!/usr/bin/env node
// Tiny static+proxy front for local Playwright when webpack-dev-server is too heavy.
const http = require('http')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

process.on('uncaughtException', (err) => {
  console.error('uncaught', err)
})
process.on('unhandledRejection', (err) => {
  console.error('unhandled', err)
})

const repo = path.resolve(__dirname, '..')
const dist = path.join(repo, 'dev', 'prod', 'dist')
const pub = path.join(repo, 'dev', 'prod', 'public')
const port = Number(process.env.PORT || 8080)
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon'
}

const proxies = [
  { prefix: '/account', target: 'http://127.0.0.1:3000', strip: '/account' },
  { prefix: '/files', target: 'http://127.0.0.1:8087' },
  { prefix: '/api/v1', target: 'http://127.0.0.1:8087' },
  { prefix: '/rekoni/recognize', target: 'http://127.0.0.1:4004', rewrite: ['/rekoni/recognize', '/recognize'] }
]

function proxyRequest (req, res, target, urlPath) {
  const dest = new URL(urlPath, target)
  const headers = { ...req.headers, host: dest.host }
  delete headers.connection
  const p = http.request(dest, { method: req.method, headers }, (pr) => {
    if (res.headersSent) return
    res.writeHead(pr.statusCode || 502, pr.headers)
    pr.pipe(res)
  })
  p.on('error', (err) => {
    console.error('proxy error', dest.href, err.message)
    if (!res.headersSent) {
      res.writeHead(502)
      res.end(String(err))
    }
  })
  req.pipe(p)
}

function tryFile (rel) {
  let clean
  try {
    clean = decodeURIComponent(rel.split('?')[0]).replace(/^\/+/, '')
  } catch {
    return null
  }
  const candidates = [path.join(dist, clean), path.join(pub, clean)]
  for (const file of candidates) {
    const resolved = path.resolve(file)
    if (!(resolved.startsWith(dist) || resolved.startsWith(pub))) continue
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved
    } catch {
      // ignore
    }
  }
  return null
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = req.url || '/'
    for (const rule of proxies) {
      if (urlPath === rule.prefix || urlPath.startsWith(rule.prefix + '/') || urlPath.startsWith(rule.prefix + '?')) {
        let forwarded = urlPath
        if (rule.rewrite != null) forwarded = urlPath.replace(rule.rewrite[0], rule.rewrite[1])
        else if (rule.strip != null) forwarded = urlPath.slice(rule.strip.length) || '/'
        proxyRequest(req, res, rule.target, forwarded)
        return
      }
    }
    const file = tryFile(urlPath) ?? tryFile('index.html')
    if (file == null) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).on('error', (err) => {
      console.error('read error', file, err.message)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end(String(err))
      } else {
        res.destroy()
      }
    }).pipe(res)
  } catch (err) {
    console.error('request error', req.url, err)
    if (!res.headersSent) {
      res.writeHead(500)
      res.end(String(err))
    }
  }
})

server.on('error', (err) => {
  console.error('server error', err)
  process.exit(1)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${dist} + ${pub} on http://127.0.0.1:${port}`)
})
