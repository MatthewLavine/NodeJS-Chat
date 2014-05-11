var config = require('./config.js');
var ip = config.ip;
var port = config.port;
var express = require('express');
var app = express();
var server = app.listen(port);
var moment = require('moment');
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
  res.end();
  var parsedUrl = url.parse(req.url, true);
  console.log(parsedUrl.query['secret_key']);
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

    if(res[0].toLowerCase() == "/kick" && res.length == 2){
      kick(res[1]);
      return;
    }

    if(res[0].toLowerCase() == "/restart" && res.length == 1){
      process.kill(process.pid, 'SIGUSR2');
      return;
    }

    if(res[0].toLowerCase() == "/shutdown" && res.length == 1){
      console.log( "\nShutting down from manual SIGINT (/shutdown), NOW." );
      io.sockets.emit('annouce', {message : '<span class="adminMessage">SHUTTING DOWN, NOW!</span>'});
      process.exit();
      return;
    }

    console.log('Unknown command \'' + data + '\'');
    console.log('Available commands are: \n  /kick user\n  message\n  /restart\n  /shutdown\n');
}

function kick(data) {
  if(!findUser(data)) {
    console.log('No such user \'' + data + '\'');
    return;
  }
  var victim = io.sockets.socket(findSocket(data));
  victim.emit('annouce', {message : '<span class="adminMessage">YOU HAVE BEEN KICKED BY THE ADMIN.</span>'});
  removeItem(users, [data]);
  victim.disconnect();
  console.log('\'' + data + '\' has been kicked.');
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

io.sockets.on('connection', function (socket) {
  var name = 'Guest' + Math.floor(100 + Math.random() * 900);
  var lastMessage = moment();
  var rateLimitWarns = 0;
  var banFrom = moment();

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

  function pm(dest, data){
    if(dest == name){
      var help = "<span class='serverMessage'>You cannot PM yourself.</span>";
      socket.emit('annouce', {message : help});
      return;
    }
    data = '<span class="pm">&lt;to ' + dest + '&gt; ' + data + '</span';
    io.sockets.socket(findSocket(dest)).emit('broadcast', {client : name, message : data});
    socket.emit('pm', {client : name, message : data});
  }

  function updateName(data){
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
      console.log('Malformed Config Packet');
      return;
    }
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
    broadcast('<span class="serverMessage">' + name + ' has entered chat.</span>');
    users.push([name, socket.id, true]);
    io.sockets.emit('users', users);
    socket.emit('name', {name : name});

    //All Other Handlers

    socket.on('broadcast', function (data) {
      if(data === undefined || data === null || data.message === undefined || data.message === null || typeof data.message != 'string'){
        console.log('Malformed Broadcast Packet');
        return;
      }
      if(data.message.length > 500) {
        var help = "<span class='serverMessage'>Your message was too long (500 character limit).</span>";
        socket.emit('annouce', {message : help});
        return;
      }
      if(moment().diff(banFrom, 'seconds') <= 30 && rateLimitWarns == 3){
        var help = "<span class='serverMessage'>You are sending too many messages, 30 second ban!</span>";
        socket.emit('annouce', {message : help});
        return;
      }
      if(moment().diff(lastMessage, 'seconds') < 0.5) {
        var help = "<span class='serverMessage'>You are sending too many messages!</span>";
        socket.emit('annouce', {message : help});
        rateLimitWarns++;
        if(rateLimitWarns == 3){
          banFrom = moment();
        }
        return;
      }
      lastMessage = moment();
      rateLimitWarns=0;
      if(data.message[0] == "/") {
        parseServerCommand(data);
      } else {
        bbcode.parse(escapeHtml(data.message), function(content){
          io.sockets.emit('broadcast', {client : name, message : content});
        });
      }
    });

    socket.on('status', function (data) {
      if(data === undefined || data === null || data.status === undefined || data.status === null){
        console.log('Malformed Status Packet');
        return;
      }
      var index = multiArrayIndex(users, [name, socket.id, !data.status]);
      if(index == -1){console.log('missing user: ' + name);return;}
      users[index][2] = data.status;
      io.sockets.emit('users', users);
    });

    socket.on('disconnect', function (data) {
      removeItem(users, [name, socket.id]);
      io.sockets.emit('users', users);
      broadcast('<span class="serverMessage">' + name + ' has exited chat.</span>');
    });
  });
});
