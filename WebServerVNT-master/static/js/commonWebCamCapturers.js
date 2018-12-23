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

function reviewingConnetionWebSocket()
{	
	if (ws.readyState!=1)
	{	
		if (initiated === true)
		{
			
			console.log("Se ha detectado corte, se vuelve a reiniciar");
			location.reload(true);
			
		}
		console.log("Waiting in reviewingConnetionWebSocket 500 ms");
		
	}
	else 
	{
		if (initiated ===false)
		{
			if (params.idRoomPresenter!==undefined)
			{
				presenter();
			}
			else if (params.idRoomViewer!==undefined)
			{
				viewer();
			}
			
		}
	}
	setTimeout(reviewingConnetionWebSocket,2000);
}

function presenter() {
	if (!webRtcPeer) {
		/*var supports = navigator.mediaDevices.getSupportedConstraints();
		console.log(" Supports Constraints --> ");
		console.log(supports);*/

		//showSpinner(video);
		var constraints;		
		if(idVideoDevice=="")
		{
			constraints = {
				audio: true,
				video: {
					width : videoWidth,
					height : videoHeight,		
					maxFrameRate  : maxFrameRate
     		     }
			};
		}	
		else
		{
			console.log("DETECTADO EL ID DEL DISPOSITIVO->>> " + idVideoDevice );
			constraints = {
				audio: true,
				video: {
					width : videoWidth,
					height : videoHeight,
					deviceId: idVideoDevice,
					maxFrameRate  : maxFrameRate
					//deviceId: "9a84883e0a4bcc0f7c53b5d97e1ed8caf7baca7789018b1d3a61efd772e3f726"
     		     }
			};			
		}
		/*var constraints = { 
			video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 10,
            chromeMediaSourceId: sourceId         
          }
	  	}};*/
	  	if (params.sound !==undefined && params.sound=="off"){			 
			constraints.audio = false;			
		}		
		if (params.video !==undefined && params.video=="off"){			
			constraints.video = false;					
		}	
		/*console.log(typeof constraints.audio);
		console.log("constraints.audio =>" + constraints.audio);
		console.log(typeof constraints.video);
		console.log("constraints.video =>" + constraints.video);*/
		var options = {
			localVideo: video ,
			onicecandidate : onIceCandidate,
			mediaConstraints : constraints 
     	        }
		console.log("Options Kurento presenter " + options);
		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(error) {
			if(error) return onError(error);

			this.generateOffer(onOfferPresenter);
		});
	}
}

