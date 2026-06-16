import express from 'express'
var app = express()
var PORT = process.env.PORT || 8080

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/', function(req, res) {
  res.json({ ok: true, message: 'relay alive' })
})

app.get('/magnet', function(req, res) {
  var magnet = req.query.magnet || req.query.m
  if (!magnet) return res.status(400).json({ error: 'missing magnet' })
  res.json({ received: magnet.slice(0, 60) + '...', note: 'webtorrent coming soon' })
})

app.listen(PORT, function() {
  console.log('relay on :' + PORT)
})
