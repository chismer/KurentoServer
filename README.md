# KurentoServer

INSTALL ALL:

-sudo npm install
-sudo npm install lodash
-sudo npm install request-promise

 
STARTKURENTO:

-sudo service kurento-media-server start


START SERVER :

-sudo node server.js


TRANSLATION :

-https://[ip]/translation.html?idRoomPresenter=[name]

-https://[ip]/translation.html?idRoomViewer=[name]&translate=[language]


WEBRTC :

-https://[ip]/webcam.html?idRoomPresenter=[name]

-https://[ip]/webcam.html?idRoomViewer=[name]