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


var showingSelectScreenCapturer= false;
var displayingVideo = false;


var videoWidth = 1280;
var videoHeight = 720;

var canvasWidth = "1280";
var canvasHeight = "720";

var pRed=-1;
var pGreen=-1;
var pBlue=-1;
var pAlpha=-1;

var timeLoop =1;
var maxFrameRate  = 1;

var nameFileContourn ="";

//var contourn = new Image();
/*navigator.mediaDevices.enumerateDevices()
.then(function(devices) {
  devices.forEach(function(device) {
  //  console.log(device.kind + ": " + device.label +
  //              " id = " + device.deviceId);
  });
})
.catch(function(err) {
  console.log(err.name + ": " + err.message);
});*/

function reviewingConnetionWebSocket()
{	
	if (showingSelectScreenCapturer==false)
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
					
					//screensharing.share();
					//presenter();
					//presenterScreen();
					showingSelectScreenCapturer = true;
					getScreenId(function(error, sourceId, screen_constraints) {
						showingSelectScreenCapturer = false;
						console.log("sourceId=" + sourceId);
						console.log("screen_constraints=" + screen_constraints);
						initiated = true;
						presenter(screen_constraints);
					});
				}
				else if (params.idRoomViewer!==undefined)
				{
					viewer();
					//viewerScreen();
				}
				
			}
		}
	}
	
	setTimeout(reviewingConnetionWebSocket,2000);
}

function presenter(constraints_selected) {
	
	console.log("Options Kurento presenter " + constraints_selected);	
	if (!webRtcPeer) {

		//showSpinner(video);

		/*var constraints = {
		     audio: false,
		     video: {
		       width : 2014,
		       height : 768
		       deviceId: idSourceSelected
     		     }
 		};*/
		
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
	  
	  constraints_selected.video.mandatory.maxWidth = videoWidth;
	  constraints_selected.video.mandatory.maxHeight  = videoHeight;
	  constraints_selected.video.mandatory.maxFrameRate  = maxFrameRate;
	  
		console.log(constraints_selected);

		var options = {
			localVideo: video ,
			onicecandidate : onIceCandidate,
			mediaConstraints : constraints_selected 
     	}

		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(error) {
			if(error) return onError(error);

			this.generateOffer(onOfferPresenter);
		});
	}
}

