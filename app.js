var ip = "127.0.0.1";
var port = "3000";

var express = require('express');
var app = express();
var server = app.listen(port);
var ejs = require('ejs');
var bbcode = require('bbcode');
var io = require('socket.io').listen(server);
io.set('log level', 1);

app.set("view options", {layout: false});
app.use(express.static(__dirname + '/public'));

process.on('SIGINT', function() {
  console.log( "\nShutting down from manual SIGINT (Ctrl-C), NOW." );
  io.sockets.emit('annouce', {message : '<span class="adminMessage">SHUTTING DOWN, NOW!</span>'});
  process.exit();
});

process.once('SIGUSR2', function () {
  gracefulShutdown(function () {
    process.kill(process.pid, 'SIGUSR2');
  });
});

function gracefulShutdown(kill){
  console.log( "\nShutting down from nodemon SUGUSR2 (RESTART) in 10 seconds..." );
  io.sockets.emit('annouce', {message : '<span class="adminMessage">RESTARTING IN 10 SECONDS!</span>'});
  setTimeout(function(){kill()}, 10000);
}

app.get('*', function(req, res) {
    res.render('index.ejs', {
    	ip: ip
        });
});

var users = [];

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function (chunk) {
 io.sockets.emit('annouce', {message : '<span class="adminMessage">' + chunk.toUpperCase() + '</span>'});
});

io.sockets.on('connection', function (socket) {
  function broadcast(data) {
    io.sockets.emit('annouce', {message : data});
  }

  function parseServerCommand(data) {
    var res = data.message.split(" ");

    if(res[0].toLowerCase() == "/nick"){
      removeItem(res, res[0]);
      updateName(res.join(' '));
      return;
    }

    if(res[0].toLowerCase() == "/disconnect"){
      socket.disconnect();
    }

    if(res[0].toLowerCase() == "/help"){
      sendHelp();
      return;
    }

    unrecognized(res[0]);
    sendHelp();
  }

  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };

  function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  }

  function removeItem(arr, item) {
      for(var i = arr.length; i--;) {
          if(arr[i] === item) {
              arr.splice(i, 1);
          }
      }
  }

  function updateName(data){
    if(users.indexOf(data) != -1){
      socket.emit('annouce', {message : "<span class='serverMessage'>The nick '" + data + "' is taken!</span>"});
      return;
    }
    if(data.toLowerCase() == "admin" || data.toLowerCase() == "server"){
      socket.emit('annouce', {message : "<span class='serverMessage'>That nick is reserved!</span>"});
      return;
    }
    oldName = name;
    name = data;
    removeItem(users, oldName);
    users.push(name);
    io.sockets.emit('users', users);
    socket.emit('name', {name : name});
    broadcast('<span class="serverMessage">' + oldName + ' has changed name to ' + data + '.</span>');
  }

  function disconnect(data){
    socket.disconnect();
  }

  function unrecognized(data){
    var help = "<span class='serverMessage'>Unknown command '" + data + "'</span>";
    socket.emit('annouce', {message : help});
  }

  function sendHelp(){
    var help = "<span class='serverMessage'>HardOrange IRC Help - Commands:<br>/nick #nick<br>/clear<br>/disconnect<br>/help</span>";
    socket.emit('annouce', {message : help});
  }

  //Set name and notify clients
  sendHelp();
  var name = 'Guest' + Math.floor(100 + Math.random() * 900);
  broadcast('<span class="serverMessage">' + name + ' has entered chat.</span>');
  users.push(name);
  io.sockets.emit('users', users);
  socket.emit('name', {name : name});

  //Begin Handlers
  socket.on('broadcast', function (data) {
    if(data.message[0] == "/") {
      parseServerCommand(data);
    } else {
      bbcode.parse(escapeHtml(data.message), function(content){
        io.sockets.emit('broadcast', {client : name, message : content});
      });
    }
  });

  socket.on('disconnect', function (data) {
    removeItem(users, name);
    io.sockets.emit('users', users);
    broadcast('<span class="serverMessage">' + name + ' has exited chat.</span>');
  });
});
