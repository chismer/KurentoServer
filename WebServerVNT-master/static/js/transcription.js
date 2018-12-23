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
var initiated = false;
var initiatedSpeechEnviroment = false;
var exitsClientsToTranscript = false;
var beforeTranscription = "";
var globalFinalScript = "";
var recognition ;
var recognizing = false;
var stateRecognizinByServer = false ;
var lastInterim = 0;
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

function initEnviromentSpeechRecognition(){
			console.log("initEnviromentSpeechRecognition");
			recognition = new webkitSpeechRecognition();

			  recognition.continuous = true;
			  recognition.interimResults = true;

			  recognition.onstart = function() {
				recognizing = true;
				console.log("Inicio reconocimiento");
			  };
			  
			  recognition.onsoundstart = function() {
				console.log("Inicio sonido");
			  };
			  recognition.onsoundend = function() {
				console.log("Final sonido");
			  };
			  
			  recognition.onboundary= function() {
				console.log("Boundary");
			  };

			  recognition.onerror = function(event) {
				console.log(event.error);
			  };

			  recognition.onend = function() {
				recognizing = false;
				console.log("Final recognition");
				if (stateRecognizinByServer){
					startDictation("es-ES");
				}
			  };

			  recognition.onresult = function(event) {
				  if (recognizing)
				  {
						var interim_transcript = '';
						for (var i = event.resultIndex; i < event.results.length; ++i) {
							if (event.results[i].isFinal) {
								final_transcript += event.results[i][0].transcript;
								globalFinalScript = final_transcript;
								console.log("********************");
								console.log(new Date().toISOString());
								
								console.log("Dictado con finalizacion " + final_transcript );
								
								var messageTotal = beforeTranscription + final_transcript;
								var messageToSend = new Object();
								messageToSend.id= "speech";
								messageToSend.message =  messageTotal ;
								messageToSend.state = "ft";
								sendMessage(messageToSend);	
								
								
								$('#textTranscription').css("color", "black");
								$('#textTranscription').text(messageTotal);
								
								console.log("actuALtRANSCRIPTION= " + messageTotal);
								console.log("********************");
								
							} else {
								interim_transcript += event.results[i][0].transcript;
								var messageTotal = beforeTranscription + final_transcript + interim_transcript;
								var messageToSend = new Object();
								messageToSend.id= "speech";
								messageToSend.message =  messageTotal ;
								messageToSend.state = "it";
								sendMessage(messageToSend);
								
								$('#textTranscription').css("color", "black");
								$('#textTranscription').text(messageTotal);
								lastInterim = performance.now();
							}
						}
				  }
			  };
			  
			  initiatedSpeechEnviroment = true;
}

function startDictation(pLang) {
			console.log(new Date().toISOString() +  "Llamada a start Dictation");
			
			lastInterim = performance.now();
			if (globalFinalScript.length != 0){
				beforeTranscription += " " + globalFinalScript;
				globalFinalScript = "";
				console.log("--------------------");
				console.log("beforeTranscription");
				console.log(beforeTranscription);
				console.log("--------------------");
				
			}
			  if (recognizing) {
				recognition.stop();
				return;
			  }
			  final_transcript = '';
			  recognition.lang = pLang;
			  recognition.start();
			}
			
function stopDictation() {
			  if (recognizing) {
				recognition.stop();
				return;
			  }
			}
			
function reviewingConnetionWebSocket()
{	
	if (ws.readyState!=1)
	{	
		if (initiated === true)
		{
			
			console.log("Se ha detectado corte, se vuelve a reiniciar");
			location.reload(true);
			
		}
		console.log("Waiting in reviewingConnetionWebSocket 2000 ms");
		
	}
	else 
	{
		if (initiated ===false)
		{
			if (params.idRoomPresenter!==undefined)
			{
				presenterTranscription();
			}
			else if (params.idRoomViewer!==undefined)
			{
				viewerTranscription();
			}
			
		}
	}
	setTimeout(reviewingConnetionWebSocket,2000);
}

function reviewInterim(){
	if (stateRecognizinByServer) {
		
		
		var millisecosnWithoutInterim = ((performance.now() - lastInterim) );

		console.log("Revisando para reiniciar millisecosnWithoutInterim " +millisecosnWithoutInterim);
		if ( millisecosnWithoutInterim > 10*1000){
			if (initiatedSpeechEnviroment){
				startDictation("es-ES");
			}
		}
	}
	setTimeout(reviewInterim,1*1000);
}



window.onload = function() {
	//console = new Console();
	reviewingConnetionWebSocket();
	console.log('wss://' + location.host + '/one2many');
	
	
	
	/*document.getElementById('call').addEventListener('click', function() { presenter(); } );
	document.getElementById('viewer').addEventListener('click', function() { viewer(); } );
	document.getElementById('terminate').addEventListener('click', function() { stop(); } );*/
	/*context.translate(video.videoWidth, 0);
	context.scale(-1, 1);*/
	if (params.idRoomPresenter!==undefined){
		$('#stateTranscription').text("Estado: No hay personas recibiendo transcripcion");
		reviewInterim();
	}
	else {
		$('#stateTranscription').text("Estado:Esperando a la conexión del emisor de transcripcion");
	}
}



window.onbeforeunload = function() {
	ws.close();
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
	case 'presenterTranscriptionResponse':
		presenterTranscriptionResponse(parsedMessage);
		break;
	case 'viewerTranscriptionResponse':
		viewerTranscriptionResponse(parsedMessage);
		break;
	case 'speech':
		speech(parsedMessage);
		break;
	case 'speechTranslated':
	console.log("Recibido SpeechTranslated -->" +parsedMessage )
		speechTranslated(parsedMessage);
		break;
		
	case 'initTranscription':
		stateRecognizinByServer =true;
		console.log("message of initi transcription");
		$('#stateTranscription').text("Estado:Transcribiendo Texto");
		if (initiatedSpeechEnviroment){
			startDictation("es-ES");
		}
		break;
	case 'stopTranscription':
		stateRecognizinByServer =false;
		console.log("message of Stop transcription");
		$('#stateTranscription').text("Estado: No hay persona recibiendo transcripcion");
		if (initiatedSpeechEnviroment){
			stopDictation();
		}
		beforeTranscription = "";
		globalFinalScript = "";
		$('#textTranscription').text(beforeTranscription);
		break;
	case 'stopCommunication':
		initiated = false;
		dispose();
		initiated  = false;
		break;
	default:
		console.error('Unrecognized message', parsedMessage);
	}
}

function speech(pMessage)
{
	console.info(pMessage);
	
	if (pMessage.message.state=="it")
	{
		$('#textTranscription').css('color', 'black');
		$('#textTranscription').text(pMessage.message.message);
	}
	else 
	{
		
		$('#textTranscription').css('color', 'black');
		$('#textTranscription').text(pMessage.message.message);
	}
	
	//translate(pMessage.message.message,"es","en",responseTraduction);
}
function speechTranslated(pMessage)
{
	console.info(pMessage);
	
	$('#textTranslated').css('color', 'black');
	$('#textTranslated').text(pMessage.message.translation);
	//translate(pMessage.message.message,"es","en",responseTraduction);
}

function responseTraduction(jsonResponse){
	console.log("Respuesta" + jsonResponse);
	$('#textTranscription').css('color', 'black');
	$('#textTranscription').text(jsonResponse);
}

function presenterTranscriptionResponse(message) {
		
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
		//presenterTranscription();
	} else {
		initiated = true;
		
	}
}

function viewerTranscriptionResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
		//viewerTranscription();
	} else {
		initiated = true;
	}
}

function presenterTranscription() {
	if (!initiated) {
		this.generateOfferPresenterTranscription();
	}
}

function generateOfferPresenterTranscription() {
  
	var message = {
		id : 'presenterTranscription',
		idRoom:params.idRoomPresenter
	};
	sendMessage(message);
}

function viewerTranscription() {
	if (!initiated) {

			this.generateOfferViewerTranscription();
	}
}

function generateOfferViewerTranscription()
{
	var message;	
	if (params.translate!=undefined){
		message = {
			id : 'viewerTranscription',
			idRoom:params.idRoomViewer,
			translate:params.translate
		}
	}
	else{
		message = {
			id : 'viewerTranscription',
			idRoom:params.idRoomViewer,
			translate:""
		}
	}
	
	sendMessage(message);
}


function stop() {
	if (initiated) {
		var message = {
				id : 'stop'
		}
		sendMessage(message);
		dispose();
	}
}

function dispose() {
	if (initiated) {
	}
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	//console.log('Senging message: ' + jsonMessage);
	ws.send(jsonMessage);
}