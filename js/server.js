var PeerServer = require('peer').PeerServer;
var server = new PeerServer({
  port: 9000,
  path: '/tanks',
  allow_discovery: true
});

server.on('connection', function(id) {
  console.log('client connected! ' + id);

});

server.on('disconnect', function(id) {
  console.log('client disconnected! ' + id);
});