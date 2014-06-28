var PeerServer = require('peer').PeerServer;
var server = new PeerServer({
  port: 9000,
  path: '/tanks',
  allow_discovery: true
});

var root;

server.on('connection', function(id) {
  console.log('client connected! ' + id);
  // first person to connect becomes game server
  if (!root) {
    root = id;
  }

});

server.on('disconnect', function(id) {
  console.log('client disconnected! ' + id);
});