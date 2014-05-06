$(document).foundation();

var users = [];
var socket = io.connect('http://' + ip);
var isActive = true;
var modalOpen = false;
var sounds = false;

$(document).ready(function () {
    updateContainer();
    $(window).resize(function() {
        updateContainer();
    });
});
function updateContainer() {
    var $containerHeight = $(window).height();
    $('.chatLog').animate({
        height: $(window).height() - 125
    }, 1000);
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

$(document).on('opened', '[data-reveal]', function () {
  document.getElementById("newNick").focus();
  modalOpen = true;
});

$(document).on('closed', '[data-reveal]', function () {
  modalOpen = false;
});

function saveNick(){
  document.getElementById("chatBox").value = '/nick ' + document.getElementById("newNick").value;
  sendMessage();
  $('#changeNick').foundation('reveal', 'close');
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
  notify(source + ': ' + data.replace(/(<([^>]+)>)/ig,"", false));
  var height = $('.chatMessage').last().height();
  $('.chatName').last().css( {"height" : height});
  $('.chatTime').last().css( {"height" : height});
  $('#chatLog').scrollTop($('#chatLog')[0].scrollHeight);
  if(!isActive){
    var alert = new Audio('sounds/alert.mp3');
    playSound(alert);
    document.title = 'New Message!';
    if(data.toLowerCase().indexOf(' ' + $(nickname).html().toLowerCase()) > -1){
      setTimeout(function(){playSound(alert);}, 6);
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
    if(modalOpen){
      saveNick();
    } else {
      sendMessage();
    }
  }
});

function notify(data, force){
  if((force || !isActive) && !Notify.needsPermission()){
    new Notify('Incoming Message!', {
        body: data,
        timeout: 30,
        permissionGranted: noNeedPermission,
        permissionDenied: needPermission
    }).show();
  }
}

if(Notify.needsPermission()){
  needPermission();
} else {
  noNeedPermission();
}

function testNotify(){
  setTimeout(function(){
    notify('Notifications enabled.',true);
  }, 5000);
}

function needPermission(){
  $('#enableNotifications').html('Enable Desktop Notifications');
  $('#enableNotifications').click(function(){
    Notify.requestPermission();
    testNotify();
  });
}

function noNeedPermission(){
    $('#enableNotifications').html('Desktop Notifications Enabled');
    $('#enableNotifications').click(function(){
      notify('Notifications can be disabled in your browser\'s settings.',true);
    });
}

function playSound(sound){
  if(sounds){
    sound.play();
  }
}

$('#toggleSounds').click(function(){
  if(sounds){
    sounds = false;
    $('#toggleSounds').html('Enable Message Sounds');
  } else {
    sounds = true;
    $('#toggleSounds').html('Disable Message Sounds');
    var alert = new Audio('sounds/alert.mp3');
    playSound(alert);
  }
});
