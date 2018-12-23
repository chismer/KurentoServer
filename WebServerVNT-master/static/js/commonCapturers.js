/*
 * (C) Copyright 2014-2015 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
 
var ws = new WebSocket('wss://' + location.host + '/one2many');
var webRtcPeer;
var video;
var initiated = false;

var contourn = new Image();

var displayingVideo = false;

var lienzo = document.getElementById('lienzo');
var context = lienzo.getContext('2d');
var canvasToBase64 =document.getElementById('canvasToBase64');
var datos;
var matriz;
var dataURL;

var temporizador;

(function() {
    var params = {},
        r = /([^&=]+)=?([^&]*)/g;

    function d(s) {
        return decodeURIComponent(s.replace(/\+/g, ' '));
    }
    var match, search = window.location.search;
    while (match = r.exec(search.substring(1)))
        params[d(match[1])] = d(match[2]);
    window.params = params;
})();

window.onload = function() {
	//console = new Console();
	video = document.getElementById('video');
	reviewingConnetionWebSocket();
	lienzo.height = videoHeight;
	lienzo.width = videoWidth;

	if(canvasHeight !="100%")
	{
		canvasToBase64.height = canvasHeight;
	}
	if(canvasWidth!="100%")
	{
		canvasToBase64.width = canvasWidth;
	}	
	if(nameFileContourn!="")
	{
		contourn.src="img/" + nameFileContourn;
	}
	
	console.log('wss://' + location.host + '/one2many');
	
	
	
	/*document.getElementById('call').addEventListener('click', function() { presenter(); } );
	document.getElementById('viewer').addEventListener('click', function() { viewer(); } );
	document.getElementById('terminate').addEventListener('click', function() { stop(); } );*/
	/*context.translate(video.videoWidth, 0);
	context.scale(-1, 1);*/
}

window.onbeforeunload = function() {
	ws.close();
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
	case 'presenterResponse':
		presenterResponse(parsedMessage);
		break;
	case 'viewerResponse':
		viewerResponse(parsedMessage);
		break;
	case 'stopCommunication':
		dispose();
		initiated  = false;
		break;
	case 'iceCandidate':
		webRtcPeer.addIceCandidate(parsedMessage.candidate)
		break;
	default:
		console.error('Unrecognized message', parsedMessage);
	}
}

function presenterResponse(message) {
		
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
		
	} else {
		initiated = true;
		presenter();
		webRtcPeer.processAnswer(message.sdpAnswer);				
		temporizador = setTimeout("loop()",1);		
	}
}

function viewerResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
		
	} else {
		
		initiated = true;
		viewer();
		webRtcPeer.processAnswer(message.sdpAnswer);
		temporizador = setTimeout("loop()",1);
	}
}

function viewer() {
	if (!webRtcPeer) {
		//showSpinner(video);

		var options = {
			remoteVideo: video,
			onicecandidate : onIceCandidate
		}	
		var constraints={
			audio: true,
			video: {
			  width : videoWidth,
			  height : videoHeight
			  //deviceId: "9a84883e0a4bcc0f7c53b5d97e1ed8caf7baca7789018b1d3a61efd772e3f726"
				}
		   };;	
		if (params.sound !==undefined && params.sound=="off"){			 
			constraints.audio = false;			
		}		
		if (params.video !==undefined && params.video=="off"){			
		   constraints.video = false;			
	    }		
		options = {
				remoteVideo: video,
				onicecandidate : onIceCandidate,
				mediaConstraints : constraints 
		}
		/*console.log(typeof constraints.audio);
		console.log("constraints.audio =>" + constraints.audio);
		console.log(typeof constraints.video);
		console.log("constraints.video =>" + constraints.video);*/
		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function(error) {
			if(error) return onError(error);

			this.generateOffer(onOfferViewer);
		});
	}
}

function onOfferPresenter(error, offerSdp) {
    if (error) return onError(error);

	var message = {
		id : 'presenter',
		sdpOffer : offerSdp, 
		idRoom:params.idRoomPresenter
	};
	sendMessage(message);
}

function onOfferViewer(error, offerSdp) {
	if (error) return onError(error)

	var message = {
		id : 'viewer',
		sdpOffer : offerSdp, 
		idRoom:params.idRoomViewer
	}
	sendMessage(message);
}

function onIceCandidate(candidate) {
	   console.log('Local candidate' + JSON.stringify(candidate));

	   var message = {
	      id : 'onIceCandidate',
	      candidate : candidate
	   }
	   sendMessage(message);
}

function stop() {
	if (webRtcPeer) {
		var message = {
				id : 'stop'
		}
		sendMessage(message);
		dispose();
	}
}

function dispose() {
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;
	}
	//hideSpinner(video);
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Senging message: ' + jsonMessage);
	ws.send(jsonMessage);
}

function loop(){
    context.clearRect(0,0,videoWidth,videoHeight);
    context.drawImage(video, 0, 0,videoWidth,videoHeight);					
	if(pRed!=-1 || pGreen!=-1 || pBlue!=-1 || pAlpha!=-1)
	{
		datos = context.getImageData(0,0,videoWidth,videoHeight);	
		matriz = datos.data;
		for (var i = 0; i < matriz.length / 4; i++) {
			var pos = i*4;
			var r = matriz[pos + 0];
			var g = matriz[pos + 1];
			var b = matriz[pos + 2];
		
			//Azul
			
			/*if (b>r && b>g && (b>r*2.5 || b>g*2.5) && b > 40){
				matriz[pos + 0] = 0;
				matriz[pos + 1] = 0;
				matriz[pos + 2] = 0;
				matriz[pos + 3] = 0;
			}*/
			
			//Verde
			
			if (g>r && g>b && (g>r*1.5 || g>b*1.5) && g > 40){
				matriz[pos + 0] = pRed;
				matriz[pos + 1] = pGreen;
				matriz[pos + 2] = pBlue;
				matriz[pos + 3] = pAlpha;
			}
		}		
		context.putImageData(datos,0,0);
	}	
	
	
	if(nameFileContourn!="")
	{
		if (params.idRoomPresenter!==undefined)
		{
			context.drawImage(contourn,0,0);
		};
	}
	dataURL = lienzo.toDataURL("image/png");
	
	$("#canvasToBase64").attr("src",dataURL);
	clearTimeout(temporizador);
	temporizador = setTimeout("loop()", timeLoop);
    
}