import http from 'http'
var PORT = process.env.PORT || 8080

var srv = http.createServer(function(req, res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  })
  res.end(JSON.stringify({ ok: true, url: req.url }))
})

srv.listen(PORT, function() {
  console.log('listening on ' + PORT)
})
