$(document).foundation();

var users = [];
var socket = io.connect('http://10.200.137.3/');
var isActive = true;

window.onfocus = function () { 
  isActive = true;
  document.title = 'HardOrange IRC';
}; 

window.onblur = function () { 
  isActive = false; 
}; 

function checkInput(){
  var val = document.getElementById("chatBox").value;
  if(val.substr(0,5) == "/nick"){
    document.getElementById("chatBox").value = val.substr(0,20);
  }
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

function makeFancy(str){
  var tempStr = str;
    while(tempStr.indexOf("*") !== -1) {
        var firstPos = tempStr.indexOf("*");
        var nextPos = tempStr.indexOf("*",firstPos + 1);
        if(nextPos !== -1) {
            var innerTxt = tempStr.substring(firstPos + 1,nextPos);
            var strongified = '<strong>' + innerTxt + '</strong>';
            tempStr = tempStr.substring(0,firstPos) + strongified + tempStr.substring(nextPos + 1,tempStr.length);
        } else {
            tempStr = tempStr.replace('*','');
        }
    }
    return tempStr;
}

function chat(data) {
  var data = makeFancy(data);
  $(chatLog).append(data + '<br>');
  $('#chatLog').scrollTop($('#chatLog')[0].scrollHeight);
  if(!isActive){
    var alert = new Audio('sounds/alert.mp3');
    alert.play();
    document.title = 'New Message!';
  }
}

function clearLog(){
  $('#chatLog').html('');
}

function updateUsers(data) {
  var list = "";
  list += '<li><label>Users</label></li>';
  for(i in data) {
    list += '<li><a href="#">' + data[i] + '</a></li>';
  }
  document.getElementById("usersList").innerHTML = list;  
}

function sendMessage(){
  if(!socket.socket.connected && document.getElementById("chatBox").value.trim() == "/connect"){
    socket.socket.connect();
  }

  if(document.getElementById("chatBox").value.trim() != ""){
    if(!$(alertZone).hasClass("hide")){
      $(alertZone).addClass("hide");
    }

    if(document.getElementById("chatBox").value.trim() == "/clear") {
      clearLog();
    } else {
      socket.emit('broadcast', {message: '' + document.getElementById("chatBox").value});
    }
    document.getElementById("chatBox").value = "";
  } else {
    $(alertZone).removeClass("hide");
  }        
}

function updateName(data){
  $(nickname).html(data.name);
}

socket.on('broadcast', function (data) {
  chat(data.client + ": " + escapeHtml(data.message));
});

socket.on('annouce', function (data) {
  chat(data.message);
});

socket.on('users', function (data) {
  updateUsers(data);
});

socket.on('name', function (data) {
  updateName(data);
});

socket.on('disconnect', function (data) {
  chat('<span class="serverMessage">You have disconnected.\nType /connect to reconnect.</span>');
  updateUsers([]);
})

$(document).keydown(function(e) {
  if(e.which == 13) { //Enter Key
    sendMessage();
  }
});