var config = require('./config.js');
var port = config.port;
var express = require('express');
var app = express();
var server = app.listen(port);
var moment = require('moment');
var url = require('url');
var util = require('util');
var crypto = require('crypto');
var bbcode = require('bbcode');
var _ = require('underscore');
var io = require('socket.io').listen(server);
io.set('log level', 1);
var sys = require('sys');
var exec = require('child_process').exec;

app.set("view options", {layout: false});
app.use(express.json());

var oneWeek = 604800;
app.use(express.compress());
app.use(express.static(__dirname + '/public', { maxAge: oneWeek }));

process.on('SIGINT', function() {
  util.log( "\nShutting down from manual SIGINT (Ctrl-C), NOW." );
  io.sockets.emit('annouce', {message : '<span class="adminMessage">SHUTTING DOWN, NOW!</span>'});
  process.exit();
});

process.once('SIGUSR2', function () {
  gracefulShutdown(function () {
    process.kill(process.pid, 'SIGUSR2');
  });
});

function gracefulShutdown(kill){
  util.log( "\nShutting down from nodemon SIGUSR2 (RESTART) in 10 seconds..." );
  io.sockets.emit('annouce', {message : '<span class="adminMessage">RESTARTING IN 10 SECONDS!</span>'});
  setTimeout(function(){
    io.sockets.emit('annouce', {message : '<span class="adminMessage">RESTARTING IN 5 SECONDS!</span>'});
  }, 5000);
  setTimeout(function(){kill()}, 10000);
}

app.post('/gitpull', function(req, res) {
  var parsedUrl = url.parse(req.url, true);
  if(parsedUrl.query['secret_key'] != config.secret_key) {
      util.log("[warning] Unauthorized request " + req.url);
      res.writeHead(401, "Not Authorized", {'Content-Type': 'text/html'});
      res.end('401 - Not Authorized');
      return;
  }
  res.end();
  io.sockets.emit('annouce', {message : '<span class="adminMessage">SYSTEM UPDATE INITIATED...</span>'});
  function puts(error, stdout, stderr) {sys.puts(stdout)}
  exec("git reset --hard HEAD", puts);
  exec("git pull", puts);
  var arr = req.body.commits[0].modified;
  if((arr.join(',').indexOf("app.min.js") > -1) || (arr.join(',').indexOf("app.min.css") > -1) || (arr.join(',').indexOf("index.html") > -1)){
    io.sockets.emit('annouce', {message : '<span class="adminMessage">SYSTEM UPDATE COMPLETE, BROWSER RELOAD IS NECCESARY.</span>'});
  } else {
    io.sockets.emit('annouce', {message : '<span class="adminMessage">SYSTEM UPDATE COMPLETE, BROWSER RELOAD IS NOT NECCESARY.</span>'});
  }
});

app.get('/', function(req, res) {
  res.render('index.html');
});

app.get('*', function(req, res) {
  res.redirect('/');
});

var users = [];
var registered_users = [];

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function (chunk) {
  chunk = chomp(chunk)
  if(chunk[0] == "/") {
    parseAdminCommand(chunk);
  } else {
    io.sockets.emit('annouce', {message : '<span class="adminMessage">' + chunk.toUpperCase() + '</span>'});
  }
});

function chomp(raw_text) {
  return raw_text.replace(/(\n|\r)+$/, '');
}

function findSocket(user) {
  for(var i = users.length; i--;) {
    if(users[i][0] == user) {
      return users[i][1];
    }
  }
  return 0;
}

function parseAdminCommand(data) {
    var res = data.trim().split(" ");

    if(res[0].toLowerCase() == "/kick" && res.length >= 2){
      kick(res[1], res.slice(2,res.length).join(' '));
      return;
    }

    if(res[0].toLowerCase() == "/restart" && res.length == 1){
      process.kill(process.pid, 'SIGUSR2');
      return;
    }

    if(res[0].toLowerCase() == "/shutdown" && res.length == 1){
      util.log( "\nShutting down from manual SIGINT (/shutdown), NOW." );
      io.sockets.emit('annouce', {message : '<span class="adminMessage">SHUTTING DOWN, NOW!</span>'});
      process.exit();
      return;
    }

    util.log('Unknown command \'' + data + '\'');
    util.log('Available commands are: \n  /kick user reason\n  message\n  /restart\n  /shutdown\n');
}

function kick(data, reason) {
  if(!findUser(data)) {
    util.log('No such user \'' + data + '\'');
    return;
  }
  var victim = io.sockets.socket(findSocket(data));
  var msg = '<span class="adminMessage">YOU HAVE BEEN KICKED BY THE ADMIN. ';
  if(reason !== undefined && reason != null && reason != ''){
    msg += 'REASON: ' + reason;
  }
  msg += '</span>';
  victim.emit('annouce', {message : msg});
  removeItem(users, [data]);
  victim.disconnect();
  util.log('\'' + data + '\' has been kicked.');
}


var entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, function (s) {
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

io.sockets.on('connection', function (socket) {
  var name = '';
  var lastMessage = moment();
  var rateLimitWarns = 0;
  var floodTimer = moment();
  var floodMessages = 0;
  var baseBan = 30; // seconds
  var banExponent = 0;
  setInterval(function(){
    floodTimer = moment;
    floodMessages = 0;
  },5000);     
  var banFrom = moment();
  var currentRoom = '#chat.hardorange.org';
  socket.join(currentRoom);

  function broadcast(data) {
    io.sockets.emit('annouce', {message : data});
  }

  function parseServerCommand(data) {
    var res = data.message.trim().split(" ");

    if(res[0].toLowerCase() == "/nick"){
      var password = "-1";
      if(!res[1]) {
          var help = "<span class='serverMessage'>Invalid syntax, please use '/nick nick'.</span>";
          socket.emit('annouce', {message : help});
          return;
      }
      if(res[2])
        password = res[2];
      updateName(res[1], password);
      return;
    }

    if(res[0].toLowerCase() == "/register"){
      if(res.length != 2) {
          var help = "<span class='serverMessage'>Invalid syntax, please use '/register password'.</span>";
          socket.emit('annouce', {message : help});
          return;
      } else {
        register(res[1]);
        return;
      }
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
          return;
        }
      } else {
          var help = "<span class='serverMessage'>Invalid syntax, please use '/pm nick message'.</span>";
          socket.emit('annouce', {message : help});
          return;
      }
    }

    if(res[0].toLowerCase() == "/channels"){
      socket.emit('annouce', {message : "<span class='serverMessage'>Active channels:" + Object.keys(io.sockets.manager.rooms).join('<br>').replace(/\//g, '') + "</span>"});
      return;
    }

    if(res[0].toLowerCase() == "/users"){
      getChannelUsers();
      return;
    }

    if(res[0].toLowerCase() == "/join"){
      if(res.length != 2) {
        var help = "<span class='serverMessage'>Improper syntax, please use /join #channel.</span>";
        socket.emit('annouce', {message : help});
        return;
      }
      if(res[1][0] != "#") {
        var help = "<span class='serverMessage'>Improper channel name, please use #channel.</span>";
        socket.emit('annouce', {message : help});
        return;
      }
      joinRoom(res[1]);
      return;
    }

    if(res[0].toLowerCase() == "/leave"){
      leaveRoom();
      return;
    }

    if(res[0].toLowerCase() == "/disconnect"){
      socket.disconnect();
      return;
    }

    if(res[0].toLowerCase() == "/help"){
      sendHelp();
      return;
    }

    unrecognized(res[0]);
  }

  function pm(dest, data){
    if(dest == name){
      var help = "<span class='serverMessage'>You cannot PM yourself.</span>";
      socket.emit('annouce', {message : help});
      return;
    }
    data = '<span class="pm">&lt;to ' + dest + '&gt; ' + data + '</span>';
    io.sockets.socket(findSocket(dest)).emit('broadcast', {client : name, message : data});
    socket.emit('pm', {client : name, message : data});
  }

  function register(password){
    if(_.where(registered_users, {"name" : name}).length > 0) {
      var help = "<span class='serverMessage'>That nick is already registered!</span>";
      socket.emit('annouce', {message : help});
      return;
    } else {
      registered_users.push({"name" : name, "password" : password});
      var help = "<span class='serverMessage'>Your nick has been registered!</span>";
      socket.emit('annouce', {message : help});
      return;
    }
  }

  function parseUser(data) {
    for(user in users) {
      if(users[user][1] == data) {
        return users[user][0];
      }
    }
  }

  function getChannelUsers() {
      var usersInChannel = '';
      var clients = io.sockets.clients(currentRoom);
      for(var client in clients){
        usersInChannel += '<br>' + parseUser(clients[client].id);
      }
      socket.emit('annouce', {message : "<span class='serverMessage'>Users in " + currentRoom + ":" + usersInChannel.replace(/\//g, '') + "</span>"});
  }

  function joinRoom(data) {
    var room = escapeHtml(data);
    if(data.toLowerCase() == currentRoom.toLowerCase()) {
      var help = "<span class='serverMessage'>You are already in " + currentRoom + "</span>";
      socket.emit('annouce', {message : help});
      return;
    }
    socket.leave(currentRoom);
    io.sockets.in(currentRoom).emit('annouce', {message : "<span class='serverMessage'>" + name + " has left " + currentRoom + ".</span>"});
    socket.emit('annouce', {message : "<span class='serverMessage'>" + name + " has left " + currentRoom + ".</span>"});
    socket.join(room);
    currentRoom = room;
    socket.emit('channel', {channel : currentRoom});
    io.sockets.in(currentRoom).emit('annouce', {message : "<span class='serverMessage'>" + name + " has entered " + currentRoom + ".</span>"});
  }

  function leaveRoom(data) {
    if(currentRoom.toLowerCase() == '#chat.hardorange.org') {
      var help = "<span class='serverMessage'>You cannot leave the default room (" + currentRoom + ")</span>";
      socket.emit('annouce', {message : help});
      return;
    }
    socket.leave(currentRoom);
    io.sockets.in(currentRoom).emit('annouce', {message : "<span class='serverMessage'>" + name + " has left " + currentRoom + ".</span>"});
    socket.emit('annouce', {message : "<span class='serverMessage'>" + name + " has left " + currentRoom + ".</span>"});
    socket.join('#chat.hardorange.org');
    currentRoom = '#chat.hardorange.org';
    socket.emit('channel', {channel : currentRoom});
    io.sockets.in(currentRoom).emit('annouce', {message : "<span class='serverMessage'>" + name + " has entered " + currentRoom + ".</span>"});
  }

  function checkRegistered(nick, password) {
    var user = _.where(registered_users, {"name" : nick});
    if(user.length > 0) {
      if(user[0].password == password){
        return false;
      }
      return true;
    }
    return false;
  }

  function updateName(data, password){
    data = escapeHtml(data).trim();
    if(typeof data != 'string') {
      socket.emit('annouce', {message : "<span class='serverMessage'>That nick is not a string!</span>"});
      return;
    }
    if(!isLetter(data)){
      socket.emit('annouce', {message : "<span class='serverMessage'>No special characters or spaces in Nicks!</span>"});
      return;
    }
    if(findUser(data)){
      socket.emit('annouce', {message : "<span class='serverMessage'>The nick '" + data + "' is taken!</span>"});
      return;
    }
    if(data.toLowerCase() == "admin" || data.toLowerCase() == "server"){
      socket.emit('annouce', {message : "<span class='serverMessage'>That nick is reserved!</span>"});
      return;
    }
    if(checkRegistered(data, password)) {
      socket.emit('annouce', {message : "<span class='serverMessage'>That nick is registered by someone else!<br>If you registered this nick, please use '/nick nick password'.</span>"});
      return;
    }
    if(data.toLowerCase().length > 25){
      socket.emit('annouce', {message : "<span class='serverMessage'>That nick is too long!</span>"});
      return;
    }
    if(data.toLowerCase().length == 0){
      socket.emit('annouce', {message : "<span class='serverMessage'>That nick is too short!</span>"});
      return;
    }
    oldName = name;
    name = escapeHtml(data);
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
    var help = "<span class='serverMessage'>Unknown command '" + data + "'.<br>For a complete list of commands, type '/help'.</span>";
    socket.emit('annouce', {message : help});
  }

  function sendHelp(){
    var help = "<span class='serverMessage'>HardOrange Chat Help - Commands:<br>/nick nick<br>/register password<br>/pm nick message<br>/channels<br>/users (in current channel)<br>/join #channel<br>/leave<br>/clear<br>/disconnect<br>/help</span>";
    socket.emit('annouce', {message : help});
  }

  function multiArrayIndex(arr, item){
    for(var i = 0; i < arr.length; i++) {
      if(arr[i][0].toString() == item[0].toString()) {
          return i;
       }
     }
     return -1;
  }

  function isLetter(s)
  {
    return s.match("^[a-zA-Z\(\)]+$");
  }

  //Begin Handlers
  sendHelp();

  var didConfig = false;
  socket.on('config', function (data){
    if(didConfig){
      return;
    } else {
        didConfig = true;
    }
    if(data === undefined || data === null || data.name === undefined || data.name === null){
      util.log('Malformed Config Packet');
      return;
    }
    do {
      name = 'Guest' + Math.floor(1000 + Math.random() * 9000);
    } while (findUser(name));
    var error = false;
    if(data.name != ''){
      if(typeof data.name != 'string') {
        socket.emit('annouce', {message : "<span class='serverMessage'>That nick is not a string!</span>"});
        error = true;
      }
      if(!error && !isLetter(data.name)){
        socket.emit('annouce', {message : "<span class='serverMessage'>No special characters or spaces in Nicks!</span>"});
        error = true;
      }
      if(!error && data.name.toLowerCase() == "admin" || data.name.toLowerCase() == "server"){
        socket.emit('annouce', {message : "<span class='serverMessage'>That nick is reserved!</span>"});
        error = true;
      }
      if(!error && data.password != undefined && checkRegistered(data.name, data.password)) {
        socket.emit('annouce', {message : "<span class='serverMessage'>That nick is registered by someone else!<br>If you registered this nick, please use '/nick nick password'.</span>"});
        error = true;
      }
      if(!error && data.password == undefined && checkRegistered(data.name, data.password = "-1")) {
        socket.emit('annouce', {message : "<span class='serverMessage'>That nick is registered by someone else!<br>If you registered this nick, please use '/nick nick password'.</span>"});
        error = true;
      }
      if(!error && data.name.toLowerCase().length > 25){
        socket.emit('annouce', {message : "<span class='serverMessage'>That nick is too long!</span>"});
        error = true;
      }
      if(!error && data.name.toLowerCase().length == 0){
        socket.emit('annouce', {message : "<span class='serverMessage'>That nick is too short!</span>"});
        error = true;
      }
      if(!error && findUser(data.name)){
        socket.emit('annouce', {message : "<span class='serverMessage'>The nick '" + data.name + "' is taken!</span>"});
        error = true;
      }
      if(!error) {
        name = escapeHtml(data.name);
      }
    }
    io.sockets.in(currentRoom).emit('annouce', {message : "<span class='serverMessage'>" + name + " has entered " + currentRoom + ".</span>"});
    users.push([name, socket.id, true]);
    io.sockets.emit('users', users);
    socket.emit('name', {name : name});

    //All Other Handlers

    socket.on('broadcast', function (data) {
      if(data === undefined || data === null || data.message === undefined || data.message === null || typeof data.message != 'string'){
        util.log('Malformed Broadcast Packet');
        return;
      }
      if(data.message.length > 500) {
        var help = "<span class='serverMessage'>Your message was too long (500 character limit).</span>";
        socket.emit('annouce', {message : help});
        return;
      }
      if(moment().diff(banFrom, 'seconds') <= baseBan*Math.pow(2, banExponent) && rateLimitWarns == 3){
        var help = "<span class='serverMessage'>You are sending too many messages, " + baseBan*Math.pow(2, banExponent) + " second ban!</span>";
        socket.emit('annouce', {message : help});
        return;
      }
      
      function floodGuard() {
        var floodLimit = 7;
        floodMessages++;
        if (floodMessages >= floodLimit) {
          return true;
        }
        return false;
      }

      if(moment().diff(lastMessage) < 400 || floodGuard()) {
        var help = "<span class='serverMessage'>You are sending too many messages!</span>";
        socket.emit('annouce', {message : help});
        rateLimitWarns++;
        if(rateLimitWarns == 3){
          banFrom = moment();
          setTimeout(function(){
            var help = "<span class='serverMessage'>" + baseBan*Math.pow(2, banExponent) + " second ban lifted, please behave.</span>";
            socket.emit('annouce', {message : help});
            banExponent++;
            rateLimitWarns=0;
          }, baseBan*Math.pow(2, banExponent)*1000);
        }
        return;
      }
      lastMessage = moment();
      if(data.message[0] == "/") {
        parseServerCommand(data);
      } else {
        bbcode.parse(escapeHtml(data.message), function(content){
          io.sockets.in(currentRoom).emit('broadcast', {client : name, message : content});
        });
      }
    });

    socket.on('status', function (data) {
      if(data === undefined || data === null || data.status === undefined || data.status === null){
        util.log('Malformed Status Packet');
        return;
      }
      var index = multiArrayIndex(users, [name, socket.id, !data.status]);
      if(index == -1){util.log('missing user: ' + name);return;}
      users[index][2] = data.status;
      io.sockets.emit('users', users);
    });

    socket.on('disconnect', function (data) {
      removeItem(users, [name, socket.id]);
      io.sockets.emit('users', users);
      io.sockets.in(currentRoom).emit('annouce', {message : "<span class='serverMessage'>" + name + " has left " + currentRoom + ".</span>"});
    });
  });
});
