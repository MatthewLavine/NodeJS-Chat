var config = require('./config.js');
var ip = config.ip;
var port = config.port;
var express = require('express');
var app = express();
var server = app.listen(port);
var ejs = require('ejs');
var bbcode = require('bbcode');
var io = require('socket.io').listen(server);
io.set('log level', 1);
var sys = require('sys')
var exec = require('child_process').exec;

app.set("view options", {layout: false});
app.use(express.json());
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
  console.log( "\nShutting down from nodemon SIGUSR2 (RESTART) in 10 seconds..." );
  io.sockets.emit('annouce', {message : '<span class="adminMessage">RESTARTING IN 10 SECONDS!</span>'});
  setTimeout(function(){kill()}, 10000);
}

app.post('/gitpull', function(req, res) {
  //GitHub push hook
  res.end();
  io.sockets.emit('annouce', {message : '<span class="adminMessage">SYSTEM UPDATE INITIATED...</span>'});
  function puts(error, stdout, stderr) {sys.puts(stdout)}
  exec("git reset --hard HEAD", puts);
  exec("git pull", puts);
  var arr = req.body.commits[0].modified;
  if((arr.join(',').indexOf("app.min.js") > -1) || (arr.join(',').indexOf("app.min.css") > -1) || (arr.join(',').indexOf("index.ejs") > -1)){
    io.sockets.emit('annouce', {message : '<span class="adminMessage">SYSTEM UPDATE COMPLETE, BROWSER RELOAD IS NECCESARY.</span>'});
  } else {
    io.sockets.emit('annouce', {message : '<span class="adminMessage">SYSTEM UPDATE COMPLETE, BROWSER RELOAD IS NOT NECCESARY.</span>'});
  }
});

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
  var name = '';

  function broadcast(data) {
    io.sockets.emit('annouce', {message : data});
  }

  function parseServerCommand(data) {
    var res = data.message.trim().split(" ");

    if(res[0].toLowerCase() == "/nick"){
      updateName(res.slice(1,res.length).join(' '));
      return;
    }

    if(res[0].toLowerCase() == "/pm"){
      if(res.length >= 3){
        if(res[1] == 'SERVER'){
          var help = "<span class='serverMessage'>You cannot PM the server.</span>";
          socket.emit('annouce', {message : help});
          return;
        }
        if(findUser(res[1])){
          pm(res[1], res.slice(2, res.length).join(' '));
          return;
        } else if (findUser(res.slice(1 ,3).join(' '))){
          pm(res.slice(1 ,3).join(' '), res.slice(3, res.length).join(' '));
          return;
        } else {
          var help = "<span class='serverMessage'>User not found for command '" + res.join(' ') + "'</span>";
          socket.emit('annouce', {message : help});
        }
      } else {
          var help = "<span class='serverMessage'>You must add a PM message.</span>";
          socket.emit('annouce', {message : help});
      }
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
      if(arr[i][0].toString() === item[0].toString()) {
        arr.splice(i, 1);
      }
    }
  }

  function findUser(user) {
    for(var i = users.length; i--;) {
      if(users[i][0] == user) {
        return true;
      }
    }
    return false;
  }

  function findSocket(user) {
    for(var i = users.length; i--;) {
      if(users[i][0] == user) {
        return users[i][1];
      }
    }
    return 0;
  }

  function pm(dest, data){
    if(dest == name){
      var help = "<span class='serverMessage'>You cannot PM yourself.</span>";
      socket.emit('annouce', {message : help});
      return;
    }
    data = '<span class="pm">&lt;to ' + dest + '&gt; ' + data + '</span';
    io.sockets.socket(findSocket(dest)).emit('broadcast', {client : name, message : data});
    socket.emit('broadcast', {client : name, message : data});
  }

  function updateName(data){
    if(findUser(data)){
      socket.emit('annouce', {message : "<span class='serverMessage'>The nick '" + data + "' is taken!</span>"});
      return;
    }
    if(data.toLowerCase() == "admin" || data.toLowerCase() == "server"){
      socket.emit('annouce', {message : "<span class='serverMessage'>That nick is reserved!</span>"});
      return;
    }
    oldName = name;
    name = data;
    removeItem(users, [oldName, socket.id]);
    users.push([name, socket.id, true]);
    io.sockets.emit('users', users);
    socket.emit('name', {name : name});
    broadcast('<span class="serverMessage">' + oldName + ' has changed name to ' + data + '.</span>');
  }

  function disconnect(data){
    socket.disconnect();
  }

  function unrecognized(data){
    var help = "<span class='serverMessage'>Unknown command '" + data + "'.</span>";
    socket.emit('annouce', {message : help});
  }

  function sendHelp(){
    var help = "<span class='serverMessage'>HardOrange IRC Help - Commands:<br>/nick nick<br>/pm nick message<br>/clear<br>/disconnect<br>/help</span>";
    socket.emit('annouce', {message : help});
  }

  function multiArrayIndex(arr, item){
    for(var i = 0; i < arr.length; i++) {
      if(arr[i][0].toString() == item[0].toString()) {
          return i;
       }
     }
  }

  //Begin Handlers
  socket.on('config', function (data){
    sendHelp();
    if(data.name == ''){
      name = 'Guest' + Math.floor(100 + Math.random() * 900);
    } else {
      name = data.name;
    }
    broadcast('<span class="serverMessage">' + name + ' has entered chat.</span>');
    users.push([name, socket.id, true]);
    io.sockets.emit('users', users);
    socket.emit('name', {name : name});
  });

  socket.on('broadcast', function (data) {
    if(data.message[0] == "/") {
      parseServerCommand(data);
    } else {
      bbcode.parse(escapeHtml(data.message), function(content){
        io.sockets.emit('broadcast', {client : name, message : content});
      });
    }
  });

  socket.on('status', function (data) {
    var index = multiArrayIndex(users, [name, socket.id, !data.status]);
    users[index][2] = data.status;
    io.sockets.emit('users', users);
  });

  socket.on('disconnect', function (data) {
    removeItem(users, [name, socket.id]);
    io.sockets.emit('users', users);
    broadcast('<span class="serverMessage">' + name + ' has exited chat.</span>');
  });
});
