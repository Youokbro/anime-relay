import express from 'express'
var app = express()
var PORT = process.env.PORT || 3000
var TMP = '/tmp/anime-relay'
var client = null

import { existsSync, mkdirSync } from 'fs'
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true })

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

async function getClient() {
  if (client) return client
  try {
    var m = await import('webtorrent')
    var WebTorrent = m.default || m
    client = new WebTorrent()
    console.log('webtorrent ready')
  } catch(e) {
    console.error('webtorrent init failed:', e.message)
  }
  return client
}

app.get('/magnet', async function(req, res) {
  var magnet = req.query.magnet || req.query.m
  if (!magnet) return res.status(400).json({ error: 'missing magnet' })
  if (!magnet.startsWith('magnet:')) return res.status(400).json({ error: 'invalid magnet' })

  var wt = await getClient()
  if (!wt) return res.status(500).json({ error: 'webtorrent not available' })

  var existing = wt.torrents.find(function(t) {
    var m = t.magnetURI || ''
    return m.indexOf(magnet.match(/btih:([a-f0-9]+)/i)?.[1] || '') > -1
  })
  if (existing) return streamTorrent(existing, req, res)

  try {
    wt.add(magnet, { path: TMP }, function(torrent) {
      streamTorrent(torrent, req, res)
    })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

function streamTorrent(torrent, req, res) {
  var file = torrent.files.find(function(f) {
    return f.name.match(/\.(mp4|mkv|avi|mov|webm)$/i)
  })
  if (!file) file = torrent.files[0]
  if (!file) return res.status(404).json({ error: 'no video file' })

  var range = req.headers.range
  var size = file.length

  if (range) {
    var parts = range.replace(/bytes=/, '').split('-')
    var start = parseInt(parts[0], 10)
    var end = parts[1] ? parseInt(parts[1], 10) : size - 1
    if (start >= size) { res.status(416).end(); return }
    res.writeHead(206, {
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': file.name.match(/\.mp4$/i) ? 'video/mp4' : 'video/webm'
    })
    file.createReadStream({ start: start, end: end }).pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type': file.name.match(/\.mp4$/i) ? 'video/mp4' : 'video/webm',
      'Accept-Ranges': 'bytes'
    })
    file.createReadStream().pipe(res)
  }
}

app.get('/status', function(req, res) {
  if (!client) return res.json({ torrents: [] })
  var list = client.torrents.map(function(t) {
    var file = t.files[0]
    return {
      infoHash: t.infoHash, name: t.name,
      progress: Math.round(t.progress * 100),
      downloadSpeed: t.downloadSpeed,
      peers: t.numPeers, done: t.done,
      size: file ? file.length : 0
    }
  })
  res.json({ torrents: list })
})

app.get('/', function(req, res) {
  res.json({ ok: true, alive: true, wt: !!client })
})

app.listen(PORT, function() {
  console.log('relay on :' + PORT)
})

function cleanup() {
  if (client) try { client.destroy() } catch(e) {}
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
