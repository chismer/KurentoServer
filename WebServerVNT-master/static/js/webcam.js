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

var videoWidth = 320;
var videoHeight = 240;;

var canvasWidth = "320";
var canvasHeight = "240";

var pRed=0;
var pGreen=0;
var pBlue=0;
var pAlpha=0;

var timeLoop =67;
var maxFrameRate  = 15;

if (params.backgroundGreen !==undefined && params.backgroundGreen=="on"){
    pRed=0;
    pGreen=255;
    pBlue=0;
    pAlpha=255;
    document.body.style.backgroundColor = "#00FF00";
    
    videoWidth = 320;
    videoHeight = 240;
}

var nameFileContourn ="Contorno.png";

var idVideoDevice="";

navigator.mediaDevices.enumerateDevices()
.then(function(devices) {
  devices.forEach(function(device) {
    console.log(device.kind + ": " + device.label +
                " id = " + device.deviceId);
	if(device.label.indexOf("ChromaCam")!=-1)
	{		
		idVideoDevice=device.deviceId;
	}
  });
  console.log("idVideoDevice SELECCIONADO= " + idVideoDevice);
})
.catch(function(err) {
  console.log(err.name + ": " + err.message);
});