import express from 'express'
import http from 'http'

var app = express()
var PORT = process.env.PORT || 8080
var TMP = '/tmp/anime-relay'
var client = null
var torrents = {}

import { existsSync, mkdirSync } from 'fs'
if (!existsSync(TMP)) mkdirSync(TMP)

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/', function(req, res) {
  res.json({ ok: true })
})

async function getClient() {
  if (client) return client
  var m = await import('webtorrent')
  var WebTorrent = m.default || m
  client = new WebTorrent({ utp: false })
  client.on('error', function() {})
  return client
}

app.get('/add', async function(req, res) {
  var magnet = req.query.magnet || req.query.m
  if (!magnet) return res.status(400).json({ error: 'missing magnet' })
  var hash = (magnet.match(/btih:([a-f0-9]+)/i) || [])[1] || ''
  if (!hash) return res.status(400).json({ error: 'invalid magnet' })

  if (torrents[hash]) return res.json({ hash: hash, status: 'exists' })

  var wt = await getClient()
  var t = wt.add(magnet, { path: TMP })
  torrents[hash] = { torrent: t, hash: hash, added: Date.now() }

  t.on('error', function() {})
  t.on('metadata', function() {
    if (t.files.length > 0) torrents[hash].name = t.name
  })

  res.json({ hash: hash, status: 'adding' })
})

app.get('/status', function(req, res) {
  var hash = req.query.hash || ''
  var t = torrents[hash]
  if (!t) return res.json({ exists: false })

  var tr = t.torrent
  var file = tr.files && tr.files[0]
  res.json({
    exists: true,
    name: tr.name || '',
    progress: Math.round((tr.progress || 0) * 100),
    speed: tr.downloadSpeed || 0,
    peers: tr.numPeers || 0,
    done: tr.done || false,
    size: file ? file.length : 0,
    files: tr.files ? tr.files.map(function(f) { return { name: f.name, length: f.length } }) : []
  })
})

app.get('/stream', function(req, res) {
  var hash = req.query.hash || ''
  var t = torrents[hash]
  if (!t) return res.status(404).json({ error: 'not found' })
  var tr = t.torrent
  var file = tr.files && tr.files.find(function(f) {
    return f.name.match(/\.(mp4|mkv|avi|mov|webm)$/i)
  })
  if (!file) file = tr.files && tr.files[0]
  if (!file) return res.status(404).json({ error: 'no video file' })

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

var srv = http.createServer(app)
srv.listen(PORT, function() {
  console.log('on ' + PORT)
})
