import express from 'express'
import http from 'http'

var app = express()
var PORT = process.env.PORT || 8080
var client = null

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/', function(req, res) {
  res.json({ ok: true })
})

async function getClient() {
  if (client) return client
  try {
    var m = await import('webtorrent')
    var WebTorrent = m.default || m
    client = new WebTorrent({ utp: false })
  } catch(e) {
    console.error('wt err:', e.message)
  }
  return client
}

app.get('/magnet', async function(req, res) {
  var magnet = req.query.magnet || req.query.m
  if (!magnet) return res.status(400).json({ error: 'missing magnet' })
  var wt = await getClient()
  if (!wt) return res.status(500).json({ error: 'wt unavailable' })
  wt.add(magnet, function(torrent) {
    var file = torrent.files[0]
    if (!file) return res.status(404).json({ error: 'no file' })
    var range = req.headers.range
    if (range) {
      var p = range.replace(/bytes=/, '').split('-')
      var s = parseInt(p[0]), e = p[1] ? parseInt(p[1]) : file.length - 1
      res.writeHead(206, {
        'Content-Range': 'bytes ' + s + '-' + e + '/' + file.length,
        'Accept-Ranges': 'bytes',
        'Content-Length': e - s + 1,
        'Content-Type': 'video/mp4'
      })
      file.createReadStream({ start: s, end: e }).pipe(res)
    } else {
      res.writeHead(200, {
        'Content-Length': file.length,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes'
      })
      file.createReadStream().pipe(res)
    }
  })
})

var srv = http.createServer(app)
srv.listen(PORT, function() {
  console.log('on ' + PORT)
})
