/*global rtc:true, alert:true, pin:true, get:true, game:true, $:true, utils:true*/
"use strict";

(function () {

var videos = [];
var PeerConnection = window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection || window.RTCPeerConnection;

var video = null;

var websocket = {
  send: function(message) {
    rtc._socket.send(message);
  },
  recv: function(message) {
    return message;
  },
  event: 'receive_chat_msg'
};

var dataChannel = {
  send: function(message) {
    for (var connection in rtc.dataChannels) {
      var channel = rtc.dataChannels[connection];
      channel.send(message);
    }
  },
  recv: function(channel, message) {
    return JSON.parse(message).data;
  },
  event: 'data stream data'
};

function setupSocket() {
  var socket;

  if(rtc.dataChannelSupport) {
    console.log('initializing data channel');
    socket = dataChannel;
  } else {
    console.log('initializing websocket');
    socket = websocket;
  }

  window.addEventListener('deviceorientation', utils.throttle(function (event) {
    var g = utils.map(event.gamma, -50, 50, -1, 1) | 0;
    // var g = event.gamma | 0;
    socket.send(JSON.stringify({
      eventName: 'orientation',
      data: {
        // type: 'orientation',
        gamma: g,
        raw: event.gamma,
        pin: pin
      }
    }));
  }, 100), false);

  var eventIfTurn = function (event) {
    if (game.turn === true) {
      socket.send(JSON.stringify({
        eventName: event.type,
        data: event.data
      }));
    }
  };

  $.on('pause', function () {
    socket.send(JSON.stringify({eventName: 'pause'}));
  }).on('resume', function () {
    socket.send(JSON.stringify({eventName: 'resume'}));
  });

  $.on('throw', eventIfTurn).on('hit', eventIfTurn);

  // when receiving events, convert them to remote{EventName} to distinguish in our code
  var re = /(^.)/;
  rtc.on(socket.event, function(rtc, msg) {
    msg = JSON.parse(msg);
    var type = 'remote' + msg.eventName.replace(re, function (all, m) { return m.toUpperCase() + all.substr(1); });
    $.trigger(type, msg.data);
  });
}

function connectVideo() {
  console.log('connection established');
  if (PeerConnection) {
    rtc.createStream({
      'video': {'mandatory': {
        // **attempt** to get the video nice and small (noticing this totally doesn't work)
        minAspectRatio: 1.333,
        maxAspectRatio: 1.334,
        maxWidth: 320,
        maxHeight: 180
      }, 'optional': [
        {maxFrameRate: 30},
        {maxWidth: 320},
        {maxHeight: 180}
      ]},
      'audio': false
    }, function(stream) {
      console.log('local video streaming');
      // rtc.attachStream(stream, 'local');
    });
  } else {
    // TODO grab pic from the camera
    alert('Your browser is not supported or you have to turn on flags. In chrome you go to chrome://flags and turn on Enable PeerConnection remember to restart chrome');
  }
}

window.initConnection = function () {
  rtc.on('add remote stream', function(stream, socketId) {
    console.log('adding remote stream');
    rtc.attachStream(stream, 'remote');
  });
  rtc.on('disconnect stream', function(socketId) {
    console.log('remove stream ' + socketId);
    var video = document.getElementById('remote' + socketId);
    if (video) { video.parentNode.removeChild(video); }
  });

  setupSocket();
};

rtc.on('connect', connectVideo);

$.on('pinchange', function () {
  var proto = window.location.protocol,
      href = window.location.href;

  try {
    rtc._socket.close();
  } catch (e) {}

  rtc.connect((proto.indexOf('https') !== -1 ? 'wss:' : 'ws:') + href.substring(proto.length).split('#')[0], pin);
});

})();