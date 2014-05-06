$(document).foundation();

var users = [];
var socket = io.connect('http://' + ip);
var isActive = true;

$(document).ready(function () {
    updateContainer();
    $(window).resize(function() {
        updateContainer();
    });
});
function updateContainer() {
    var $containerHeight = $(window).height();
    $('.chatLog').css({
        height: $(window).height() - 125
    });
  $('#chatLog').scrollTop($('#chatLog')[0].scrollHeight);
}

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
    document.getElementById("chatBox").value = val.substr(0,25);
  }
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

function chat(source, data) {
  var time = moment().format('HH:mm');
  var data = makeFancy(data);
  $('#chatLog').append(' \
    <div class="row"> \
      <div class="large-1 columns show-for-large-up"> \
        <div class="chatTime full-height">' + '[' + time + ']' + '</div> \
      </div> \
      <div class="small-3 medium-2 large-2 columns right-seperator"> \
         <div class="chatName full-height">' + source + '</div> \
      </div> \
      <div class="small-9 medium-10 large-9 columns"> \
        <div class="chatMessage full-height">' + data + '</div> \
      </div> \
    </div> \
    ');
  var height = $('.chatMessage').last().height();
  $('.chatName').last().css( {"height" : height});
  $('.chatTime').last().css( {"height" : height});
  $('#chatLog').scrollTop($('#chatLog')[0].scrollHeight);
  if(!isActive){
    var alert = new Audio('sounds/alert.mp3');
    alert.play();
    document.title = 'New Message!';
    if(data.toLowerCase().indexOf(' ' + $(nickname).html().toLowerCase()) > -1){
      setTimeout(function(){alert.play();}, 6);
    document.title = 'You have been mentioned!';
    }
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
      $('#chatBox').removeClass("error");

    if(document.getElementById("chatBox").value.trim() == "/clear") {
      clearLog();
    } else {
      socket.emit('broadcast', {message: '' + document.getElementById("chatBox").value});
    }
    document.getElementById("chatBox").value = "";
  } else {
    if(!$('#chatBox').hasClass("error")){
      $('#chatBox').addClass("error");
    }
  }        
}

function updateName(data){
  $(nickname).html(data.name);
}

socket.on('broadcast', function (data) {
  chat(data.client, data.message);
});

socket.on('annouce', function (data) {
  chat('SERVER', data.message);
});

socket.on('users', function (data) {
  updateUsers(data);
});

socket.on('name', function (data) {
  updateName(data);
});

socket.on('disconnect', function (data) {
  chat('SERVER', '<span class="serverMessage">You have disconnected. Type /connect to reconnect.</span>');
  updateUsers([]);
})

$(document).keydown(function(e) {
  if(e.which == 13) { //Enter Key
    sendMessage();
  }
});
