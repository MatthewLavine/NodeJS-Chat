var express = require('express');
var app = express();
var server = app.listen(3000);
var io = require('socket.io').listen(server);


app.set("view options", {layout: false});
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
    res.render('index.html');
    console.log("Page sent");
});

var users = [];



io.sockets.on('connection', function (socket) {
  function broadcast(data) {
    io.sockets.emit('annouce', {message : data});
  }

  function parseServerCommand(data) {
    res = data.message.split(" ");
    
    if(res[0] == "/nick" && res.length == 2){
      updateName(res[1]);
      return;
    }

    if(res[0] == "/disconnect"){
      disconnect();
    }

    if(res[0] == "/help"){
      sendHelp();
      return;
    }

    unrecognized(res[0]);
    sendHelp();
  }

  function updateName(data){
    oldName = name;
    name = data;
    users.pop(oldName);
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
    var help = "<span class='serverMessage'>HardOrange IRC Help - Commands:<br>/nick {nick}<br>/clear<br>/disconnect<br>/help</span>";
    socket.emit('annouce', {message : help});
  }

  //Set name and notify clients
  var name = 'Guest' + Math.floor(100 + Math.random() * 900);
  broadcast('<span class="serverMessage">' + name + ' has entered chat.</span>');
  users.push(name);
  io.sockets.emit('users', users);
  socket.emit('name', {name : name});
  sendHelp();

  //Begin Handlers
  socket.on('broadcast', function (data) {
    if(data.message[0] == "/") {
      parseServerCommand(data);
    } else {
      io.sockets.emit('broadcast', {client : name, message : data.message});
    }
  });

  socket.on('disconnect', function (data) {
    users.pop(name);
    io.sockets.emit('users', users);
    broadcast('<span class="serverMessage">' + name + ' has exited chat.</span>');
  });
});

