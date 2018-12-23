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
	
var path = require('path');
var url = require('url');
var express = require('express');
var forceSSL = require('express-force-ssl');
var minimist = require('minimist');
var ws = require('ws');
var kurento = require('kurento-client');
var fs    = require('fs');
var https = require('https');
var translate = require('./translate');

var argv = minimist(process.argv.slice(2), {
    default: {
        as_uri: 'https://localhost:443/',
        ws_uri: 'ws://localhost:8888/kurento'
    }
});

var options =
{
  key:  fs.readFileSync('keys/server.key'),
  cert: fs.readFileSync('keys/server.crt')
};

var app = express();
app.use(forceSSL);
/*
 * Definition of global variables.
 */
var idCounter = 0;
var candidatesQueue = {};
var kurentoClient = null;
//var presenter = null;
var presenters = {};
var viewers = [];
var presentersTranscription = {};
var viewersTranscription = [];
var noPresenterMessage = 'No active presenter. Try again later...';
var noPresenterPipelineMessage = 'PROBABLY KURENTO SERVER IS STOPPED';

/*
 * Server startup
 */
var asUrl = url.parse(argv.as_uri);
var port = asUrl.port;
var server = https.createServer(options, app).listen(port, function() {
    console.log('Kurento Tutorial started');
    console.log('Open ' + url.format(asUrl) + ' with a WebRTC capable browser');
});

require('events').EventEmitter.defaultMaxListeners = 0;
require('events').EventEmitter.setMaxListeners = 0;

var wss = new ws.Server({
    server : server,
    path : '/one2many'
});


function nextUniqueId() {
	idCounter++;
	return idCounter.toString();
}

/*
 * Management of WebSocket messages
 */
wss.on('connection', function(ws) {		
	console.log("******************* INIT CONNECTION *******************");
	var sessionId = nextUniqueId();
	console.log('Connection received with sessionId ' + sessionId);

    ws.on('error', function(error) {
        console.log('Connection ' + sessionId + ' error');
        stop(sessionId);
    });

    ws.on('close', function() {
        console.log('Connection ' + sessionId + ' closed');
        stop(sessionId);
    });

    ws.on('message', function(_message) {
		try {
			var message = JSON.parse(_message);
			//console.log('Connection ' + sessionId + ' received message ', message);
			///console.log('messageid= '  + message.id);				
			
			switch (message.id) {
			case 'presenter':
			
				console.log("******************* INIT PRESENTER ID=" + sessionId  + " *******************");
				console.log("Solicitud de presenter desde cliente con sessionId = " +sessionId  + " y roomId=" + message.idRoom);
				startPresenter(message.idRoom, sessionId, ws, message.sdpOffer, function(error, sdpAnswer) {
					
					if (error) {
						if (isWsOn(ws)){
							ws.send(JSON.stringify({
								id : 'presenterResponse',
								response : 'rejected',
								message : error
							}));
						}
					} else if (isWsOn(ws)){
						ws.send(JSON.stringify({
							id : 'presenterResponse',
							response : 'accepted',
							sdpAnswer : sdpAnswer
						}));
					}
					
				});
				break;
			case 'presenterTranscription':			
				console.log("******************* INIT PRESENTER TRANSCRIPTION ID=" + sessionId  + " *******************");
				console.log("Solicitud de presenter Transcription desde cliente con sessionId = " +sessionId  + " y roomId=" + message.idRoom);
				startPresenterTranscription(message.idRoom, sessionId, ws);
				break;
			case 'viewer':
				console.log("******************* INIT VIEWER ID=" + sessionId  + " *******************");
				console.log("Solicitud de viewer desde cliente con sessionId = " +sessionId  + " y roomId=" + message.idRoom);
				startViewer(message.idRoom, sessionId, ws, message.sdpOffer, function(error, sdpAnswer) {
					if (error) {
						if (isWsOn(ws)){
							ws.send(JSON.stringify({
								id : 'viewerResponse',
								response : 'rejected',
								message : error
							}));
						}
					} else if (isWsOn(ws)){
						ws.send(JSON.stringify({
							id : 'viewerResponse',
							response : 'accepted',
							sdpAnswer : sdpAnswer
						}));
					}
					
				});
				break;
			case 'viewerTranscription':
				console.log("******************* INIT VIEWER TRANSCRIPTION ID=" + sessionId  + " *******************");
				console.log("Solicitud de viewerTranscription desde cliente con sessionId = " +sessionId  + " y roomId=" + message.idRoom);
				startViewerTranscription(message.idRoom, sessionId,message.translate, ws);
				break;

			case 'stop':
				console.log("******************* INIT STOP ID=" + sessionId  + " *******************");
				console.log("Solicitud de stop desde cliente con sessionId = " +sessionId);
				stop(sessionId);
				break;

			case 'onIceCandidate':
				// console.log("Solicitud de iceCandidate desde cliente con sessionId = " +sessionId);
				onIceCandidate(sessionId, message.candidate);
				break;
			case 'speech':
				if (message.state=="it"){
					sendToClients(sessionId,message);
				}
				else 
				{
					sendToClients(sessionId,message);
					console.log("Enviando traduccion de -->" + message.message);
					serverTranslate(message.message,sessionId);
					
				}			
				//ws.send(_message);
				break;

			default:
				if (isWsOn(ws)){
					ws.send(JSON.stringify({
						id : 'error',
						message : 'Invalid message ' + message
					}));
				}
				break;
			}
		} catch(err) {
			console.log("Error sen d message on ws " + err);
		}
	});
});

/*
 * Definition of functions
 */

 function isWsOn(ws) {
	 if (ws === null) {
		 console.log("Websocket used is null");
		 return false ;
	 }
	 
	 if (ws.readyState!=1) {
		 console.log("Websocket used is not opened");
		 return false ;
	 }
	 return true;
 }
// Recover kurentoClient for the first time.
function getKurentoClient(callback) {
    if (kurentoClient !== null) {
        return callback(null, kurentoClient);
    }

    kurento(argv.ws_uri, function(error, _kurentoClient) {
        if (error) {
            console.log("Could not find media server at address " + argv.ws_uri);
            return callback("Could not find media server at address" + argv.ws_uri
                    + ". Exiting with error " + error);
        }

	console.log('Starting kurento client');

        kurentoClient = _kurentoClient;
        callback(null, kurentoClient);
    });
}

// Recover Presenter
function getPresenterByIdRoom(idRoom) {
	if (presenters[idRoom]!== undefined && presenters[idRoom]!== null)
	{
		return presenters[idRoom];
	}
	else 
	{
		return null;
	}
}

// Recover Presenter
function getPresenterByIdSession(idSession) {
	//console.log("Buscando presenter con idSession " + idSession);
	for (var presenterName in presenters) {
		var presenterReview =  presenters[presenterName];
		if (idSession===presenterReview.id)
		{	
			return presenterReview;
		}
	}
	return null;
}


function startPresenter(idRoom , sessionId, ws, sdpOffer, callback) {
	clearCandidatesQueue(sessionId);
	var presenter = getPresenterByIdRoom(idRoom );
	if (presenter !== null) {
		stop(sessionId);
		return callback("Another user is currently acting as presenter. Try again later ...");
	}

	presenter = {
		id : sessionId,
		pipeline : null,
		webRtcEndpoint : null,
		idRoom : idRoom 
	}
	presenters[idRoom] = presenter ;
	getKurentoClient(function(error, kurentoClient) {
		if (error) {
			stop(sessionId);
			return callback(error);
		}

		if (presenter === null) {
			stop(sessionId);
			return callback(noPresenterMessage);
		}

		kurentoClient.create('MediaPipeline', function(error, pipeline) {
			if (error) {
				stop(sessionId);
				return callback(error);
			}

			if (presenter === null) {
				stop(sessionId);
				return callback(noPresenterMessage);
			}

			presenter.pipeline = pipeline;
			if(pipeline == null)
			{
				console.log("ERROR pileline DETECTADO en el create");
				return callback(noPresenterMessage);
			}
			pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
				if (error) {
					stop(sessionId);
					return callback(error);
				}

				if (presenter === null) {
					stop(sessionId);
					return callback(noPresenterMessage);
				}

				presenter.webRtcEndpoint = webRtcEndpoint;

                if (candidatesQueue[sessionId]) {
		    console.log("StartPresenter - sessionId=" + sessionId + ", cantidad de candidatos en la session es =" + candidatesQueue[sessionId].length );
                    while(candidatesQueue[sessionId].length) {
                        var candidate = candidatesQueue[sessionId].shift();
                        webRtcEndpoint.addIceCandidate(candidate);
                    }
                }

                webRtcEndpoint.on('OnIceCandidate', function(event) {
                    var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
					if (isWsOn(ws)) {
						ws.send(JSON.stringify({
							id : 'iceCandidate',
							candidate : candidate
						}));
					}
					
                });

				webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
					if (error) {
						stop(sessionId);
						return callback(error);
					}

					if (presenter === null) {
						stop(sessionId);
						return callback(noPresenterMessage);
					}

					callback(null, sdpAnswer);
				});

                webRtcEndpoint.gatherCandidates(function(error) {
                    if (error) {
                        stop(sessionId);
                        return callback(error);
                    }
                });
            });
        });
	});
}

function startViewer(idRoom , sessionId, ws, sdpOffer, callback) {
	clearCandidatesQueue(sessionId);

	var presenter = getPresenterByIdRoom(idRoom );
	if (presenter === null) {
		stop(sessionId);
		return callback(noPresenterMessage);
	}
	if (presenter.pipeline === null) {
		stop(sessionId);
		console.log(noPresenterPipelineMessage);
		return callback(noPresenterPipelineMessage);
	}

	presenter.pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
		if (error) {
			stop(sessionId);
			return callback(error);
		}
		viewers[sessionId] = {
			"webRtcEndpoint" : webRtcEndpoint,
			"ws" : ws, 
			"idRoom" : idRoom 
		}

		if (presenter === null) {
			stop(sessionId);
			return callback(noPresenterMessage);
		}

		if (candidatesQueue[sessionId]) {
			while(candidatesQueue[sessionId].length) {
				var candidate = candidatesQueue[sessionId].shift();
				webRtcEndpoint.addIceCandidate(candidate);
			}
		}

        webRtcEndpoint.on('OnIceCandidate', function(event) {
            var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
			if (isWsOn(ws)){
				ws.send(JSON.stringify({
					id : 'iceCandidate',
					candidate : candidate
				}));
			}
			
        });

		webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
			if (error) {
				stop(sessionId);
				return callback(error);
			}
			if (presenter === null) {
				stop(sessionId);
				return callback(noPresenterMessage);
			}

			presenter.webRtcEndpoint.connect(webRtcEndpoint, function(error) {
				if (error) {
					stop(sessionId);
					return callback(error);
				}
				if (presenter === null) {
					stop(sessionId);
					return callback(noPresenterMessage);
				}

				callback(null, sdpAnswer);
		        webRtcEndpoint.gatherCandidates(function(error) {
		            if (error) {
			            stop(sessionId);
			            return callback(error);
		            }
		        });
		    });
	    });
	});
}

function clearCandidatesQueue(sessionId) {
	if (candidatesQueue[sessionId]) {
		delete candidatesQueue[sessionId];
	}
}

function stop(sessionId) {
	var presenter = getPresenterByIdSession(sessionId);
	if (presenter != null)
	{
		console.log("STOP - Encontrado presenter en session=" +sessionId );
		stopWebRTC(sessionId);
		return;
	}
	var presenterTranscription = getPresenterTranscriptionByIdSession(sessionId);
	if (presenterTranscription != null)
	{
		console.log("STOP - Encontrado presenter transcription en session=" +sessionId );
		stopTranscription(sessionId);
		return;
	}
	var viewerTranscription = getViewerTranscriptionByIdSession(sessionId);
	if (viewerTranscription != null){
		console.log("STOP - Encontrado viewer Transcription  en session=" +sessionId );
		stopTranscription(sessionId);
		return;
	}
	
	//Viewer
	stopWebRTC(sessionId);
	
}
function stopWebRTC(sessionId) {
	console.log("******************* INIT STOP *******************");
	var presenter = getPresenterByIdSession(sessionId);
	console.log("Parando session con sessionId " + sessionId);
	if (presenter !== null && presenter.id == sessionId) {
		var listToDelete=[];
		for (var i in viewers) {
			var viewer = viewers[i];
			if (viewer.ws && viewer.idRoom == presenter.idRoom) {
				if (isWsOn(viewer.ws)){
					viewer.ws.send(JSON.stringify({
						id : 'stopCommunication'
					}));
				}
				else 
				{
					console.log("*******************************************************************************");
					console.log("No se ha podido enviar stopCommunication asl viewer con sessionID=" + sessionId);
					console.log("*******************************************************************************");

				}
				listToDelete[listToDelete["length"]] = i;
			}
		}		
		console.log("Borrando lista de Viewers asoicados al presenter con idRoom = " + presenter.idRoom);
		for (var i in listToDelete) {
			console.log("Borrando Viewer con sesion = " + listToDelete[i]);
			delete viewers[listToDelete[i]];
		}

		console.log("Borrando Presenter");		
		if(presenter != null)
		{
			console.log("Borrando Presenter con IdRoom = " + presenter.idRoom + " y sesion = " + presenter.id );		
			delete presenters[presenter.idRoom];
			console.log("presenter delete ok de presenters");
			if(presenter.pipeline!=null)
			{
				presenter.pipeline.release();		
				console.log("presenter.pipeline release ok");
			}
			else
			{
				console.log("NO se hace release del pipeline por ser igual a null");
			}
		}
		else
		{
			console.log("NO se Borra por Presenter = null");
		}
		presenter = null;	

	} else if (viewers[sessionId]) {
		viewers[sessionId].webRtcEndpoint.release();
		delete viewers[sessionId];
	}

	clearCandidatesQueue(sessionId);

	if (viewers.length < 1 && !presenters.leghth < 1 ) {
        	console.log('Closing kurento client');	
       		kurentoClient.close();		
        	kurentoClient = null;
    	}	
}

function onIceCandidate(sessionId, _candidate) {
    var candidate = kurento.getComplexType('IceCandidate')(_candidate);
    var presenter = getPresenterByIdSession(sessionId);
	
    if (presenter && presenter.id === sessionId && presenter.webRtcEndpoint) {
       // console.info('Sending presenter candidate');
        presenter.webRtcEndpoint.addIceCandidate(candidate);
    }
    else if (viewers[sessionId] && viewers[sessionId].webRtcEndpoint) {
        //console.info('Sending viewer candidate');
        viewers[sessionId].webRtcEndpoint.addIceCandidate(candidate);
    }
    else {
        //console.info('Queueing candidate');
        if (!candidatesQueue[sessionId]) {
            candidatesQueue[sessionId] = [];
        }
        candidatesQueue[sessionId].push(candidate);
    }
}


// ******************** TRANSCRIPTION ***********************************

function getPresenterTranscriptionByIdRoom(idRoom) {
	if (presentersTranscription[idRoom]!== undefined && presentersTranscription[idRoom]!== null)
	{
		return presentersTranscription[idRoom];
	}
	else 
	{
		return null;
	}
}

function getPresenterTranscriptionByIdSession(idSession) {
	//console.log("Buscando presenter Transcription con idSession " + idSession);
	for (var presenterName in presentersTranscription) {
		console.log("PresenterName = " + presenterName);
		var presentersTranscriptionReview =  presentersTranscription[presenterName];
		console.log("presentersTranscriptionReview.id = " + presentersTranscriptionReview.id);
		if (idSession===presentersTranscriptionReview.id)
		{	
			console.log("Retornando Presenter con IdSession " + presentersTranscriptionReview.id);
			return presentersTranscriptionReview;
		}
	}
	return null;
}

function getViewerTranscriptionByIdSession(idSession) {
	//console.log("Buscando viewer Transcription  con idSession " + idSession);
	for (var i in viewersTranscription) {
			var viewerTranscription = viewersTranscription[i];
			console.log("getViewerTranscriptionByIdSession (viewerTranscription.id) - " + viewerTranscription.id);
			
			if (viewerTranscription.id == idSession) {
				return viewerTranscription;
			}
	}
	return null;
}

function startPresenterTranscription(idRoom , sessionId, ws) {
	var presenterTranscription = getPresenterTranscriptionByIdRoom(idRoom );
	if (presenterTranscription !== null) {
		stopTranscription(sessionId);
		//return callback("Another user is currently acting as presenterTranscription. Try again later ...");
		if (isWsOn(ws)){
			ws.send(JSON.stringify({
				id : 'presenterTranscriptionResponse',
				response : 'rejected',
			}));
		}
		return;
	}

	presenterTranscription = {
		id : sessionId,
		idRoom : idRoom ,
		ws:ws
	}
	presentersTranscription[idRoom] = presenterTranscription;
	
	if (isWsOn(ws)) {
		ws.send(JSON.stringify({
			id : 'presenterTranscriptionResponse',
			response : 'accepted',
		}));
	}
				
	
	
	//callback(null, null);
}

function startViewerTranscription(idRoom , sessionId, translate, ws) {

	var presenterTranscription = getPresenterTranscriptionByIdRoom(idRoom );
	if (presenterTranscription === null) {
		stopTranscription(sessionId);
		if (isWsOn(ws)) {
			ws.send(JSON.stringify({
				id : 'viewerTranscriptionResponse',
				response : 'rejected',
			}));
		}
		return;
	}

	if (existsViewersTranscription(idRoom)==false){
		if (isWsOn(presenterTranscription.ws)){
			presenterTranscription.ws.send(
				JSON.stringify({
						id : 'initTranscription',
				}));
		}
		
	}
	viewersTranscription[sessionId] = {
			ws : ws, 
			idRoom : idRoom ,
			id : sessionId,
			translate:translate
	}
	if (isWsOn(ws)){
		ws.send(JSON.stringify({
			id : 'viewerTranscriptionResponse',
			response : 'accepted',
		}));
	}
				
}

function existsViewersTranscription(idRoom){
	for (var i in viewersTranscription) {
			var viewerTranscription = viewersTranscription[i];
			if (viewerTranscription.ws && viewerTranscription.idRoom ==idRoom) {
				return true;
			}
	}
	return false;
}

function stopTranscription(sessionId) {
	var presenterTranscription = getPresenterTranscriptionByIdSession(sessionId);
	if (presenterTranscription !== null && presenterTranscription.id == sessionId) {
		var listToDelete=[];
		for (var i in viewersTranscription) {
			var viewerTranscription = viewersTranscription[i];
			if (viewerTranscription.ws && viewerTranscription.idRoom == presenterTranscription.idRoom) {
				if(isWsOn(viewerTranscription.ws))
				{
					viewerTranscription.ws.send(JSON.stringify({
						id : 'stopCommunication'
					}));
				}
				else 
				{
					console.log("*******************************************************************************");
					console.log("No se ha podido enviar stopCommunication asl viewer con sessionID=" + sessionId);
					console.log("*******************************************************************************");

				}
				listToDelete[listToDelete["length"]] = i;
			}
		}		
		console.log("Borrando lista de Viewers asoicados al presenterTranscription con idRoom = " + presenterTranscription.idRoom);
		for (var i in listToDelete) {
			console.log("Borrando Viewer con sesion = " + listToDelete[i]);
			delete viewersTranscription[listToDelete[i]];
		}

		console.log("Borrando presenterTranscription con IdRoom = " + presenterTranscription.idRoom + " y sesion = " + presenterTranscription.id );		
		delete presentersTranscription[presenterTranscription.idRoom];

	} else if (viewersTranscription[sessionId]) {
		// Search idRoom
		console.log("Borrando viewer con session id = " + sessionId );
		var idRoomViewerTranscription = viewersTranscription[sessionId].idRoom;
		delete viewersTranscription[sessionId];
		console.log("Comprobando Viewers de presenter Transcription  = " + idRoomViewerTranscription );
		var presenterTranscriptionOfViewer = getPresenterTranscriptionByIdRoom(idRoomViewerTranscription);
		if (presenterTranscriptionOfViewer!=null)
		{
			if (existsViewersTranscription(idRoomViewerTranscription)==false){
				if (isWsOn(presenterTranscriptionOfViewer.ws)){
					presenterTranscriptionOfViewer.ws.send(
						JSON.stringify({
								id : 'stopTranscription',
					}));
				}
			}
		}
		else {
			console.log("No se ha encontrado el presenterTranscription con idRoom=" +idRoomViewerTranscription )
		}
		
	}
}

function sendToClients(sessionId,pMessage){
	var presenterTranscription = getPresenterTranscriptionByIdSession(sessionId);
	if (presenterTranscription !== null && presenterTranscription.id == sessionId) {
		var listToDelete=[];
		for (var i in viewersTranscription) {
			var viewerTranscription = viewersTranscription[i];
			if (viewerTranscription.ws && viewerTranscription.idRoom == presenterTranscription.idRoom) {
				if(isWsOn(viewerTranscription.ws))
				{
						viewerTranscription.ws.send(JSON.stringify({
							id : 'speech',
							message:pMessage
						}));
				}
				else 
				{
					console.log("*******************************************************************************");
					console.log("No se ha podido enviar stopCommunication asl viewer con sessionID=" + sessionId);
					console.log("*******************************************************************************");

				}
				listToDelete[listToDelete["length"]] = i;
			}
		}		
	}
}

function sendToClientsTranslated(jsonResponse){
	console.log("Recibida traduccion en server --> " + jsonResponse.translation + " para la sesion " + jsonResponse.sessionId);
	console.log(jsonResponse);
	var presenterTranscription = getPresenterTranscriptionByIdSession(jsonResponse.sessionId);
	if (presenterTranscription !== null && presenterTranscription.id == jsonResponse.sessionId) {
		var listToDelete=[];
		console.log("Buscando los Viewers de session" + jsonResponse.sessionId + " con idRoom" +  presenterTranscription.idRoom);
		for (var i in viewersTranscription) {
			var viewerTranscription = viewersTranscription[i];
			if (jsonResponse.language!= undefined){
				console.log("Viewer idRoom " + viewerTranscription.idRoom + ",sessionID = " +  viewerTranscription.id);
				if (viewerTranscription.ws && viewerTranscription.idRoom == presenterTranscription.idRoom && viewerTranscription.translate==jsonResponse.language) {
					if(isWsOn(viewerTranscription.ws))
					{
						
							console.log("Enviando a session" + jsonResponse.sessionId + " la traduccion: " +  jsonResponse.translation);
							viewerTranscription.ws.send(JSON.stringify({
								id : 'speechTranslated',
								message:jsonResponse.translation
							}));

					}
					else 
					{
						console.log("*******************************************************************************");
						console.log("No se ha podido enviar stopCommunication asl viewer con sessionID=" + sessionId);
						console.log("*******************************************************************************");

					}
				}
				else {
					console.log("Viewer no esta preparado");
					console.log("viewerTranscription.ws" + viewerTranscription.ws);
					console.log("viewerTranscription.translate" +viewerTranscription.translate);
					console.log("viewerTranscription.idRoom" + viewerTranscription.idRoom);
					console.log("presenterTranscription.idRoom" + presenterTranscription.idRoom);
					console.log("viewerTranscription.ws.readyState" + viewerTranscription.ws.readyState);
				}
			}
		}		
	}
}

function serverTranslate(pText,pSessionId){
	// Search if is active translation to almost one client
	console.log("Iniciacnpd busqueda de Viewers con traduccion");
	var presenterTranscription = getPresenterTranscriptionByIdSession(pSessionId);
	if (presenterTranscription !== null && presenterTranscription.id == pSessionId) {
			for (var i in viewersTranscription) {
			var viewerTranscription = viewersTranscription[i];
			console.log("Viewer idRoom " + viewerTranscription.idRoom + ",sessionID = " +  viewerTranscription.id);
			if (viewerTranscription.ws && viewerTranscription.idRoom == presenterTranscription.idRoom && viewerTranscription.translate!="") {
				console.log("Se ha encontrado un viewer con traduccion --> " + viewerTranscription.id );
				translate(pText,"es",viewerTranscription.translate,pSessionId, sendToClientsTranslated);
			}
			else {
				console.log("El viewer con IdSession = " + viewerTranscription.id + " no tiene traduccion");

			}
		}		
	}
	
	
}
/*function sendToClientsTranslated(jsonResponse){
	console.log("sendToClientsTranslated-->" +jsonResponse );
}*/

app.use(express.static(path.join(__dirname, 'static')));
