var restify = require('restify');
var PeerServer = require('peer').PeerServer;
var server = new PeerServer({
  port: process.env.PORT || 9000,
  path: '/tanks',
  allow_discovery: true
});

server.on('connection', function(id) {
  console.log('client connected! ' + id);

});

server.on('disconnect', function(id) {
  console.log('client disconnected! ' + id);
});

server._app.get(/^\/?.*/, restify.serveStatic({
  directory: __dirname,
  default: 'index.html'
}));