// this project connetion workflow
// 1.) peer joins room
// 2) sends message to all other peers indicating its entry
// 3) all other peers get notified of new peer through this message
// 4) each existing peer initiates peer connection with new peer (offer sdp)
// 5) new peer receives each offer sdp
// 6) new peer sends response (answer sdp) for each offer sdp
// 7) other peers receive respective anser sdps
// 8) new peer connected with each existing peer (mesh)



let lableUsername = document.getElementById("label-username")
let usernameInput = document.getElementById("username")
let btnJoin = document.getElementById("btn-join")

let username
let webSocket;
let mapPeers = {}

const WebSocketOnMessage = (event) => {
    let paresedData = JSON.parse(event.data)
    let peerUsername = paresedData['peer'];
    let action = paresedData['action'];

    if (username == peerUsername) {
        return;
    }
    let receiver_channel_name = paresedData['message']['receiver_channel_name'];

    if (action == 'new-peer') {
        createOffer(peerUsername, receiver_channel_name);
        return;
    }

    if (action == 'new-offer') {
        let offer = paresedData['message']['sdp']
        createAnswer(offer, peerUsername, receiver_channel_name)
    }

    if (action == 'new-answer') {
        let answer = paresedData['message']['sdp']
        let peer = mapPeers[peerUsername][0];
        peer.setRemoteDescription(answer)
        return;
    }
}

btnJoin.addEventListener("click", () => {
    username = usernameInput.value;
    if (username == "") {
        // alert("Please Enter username")
        return;
    }
    usernameInput.value = ""
    usernameInput.disabled = true
    usernameInput.style.visibility = "hidden";

    btnJoin.disabled = true
    btnJoin.style.visibility = "hidden"

    lableUsername.innerHTML = username

    // websocket connetion
    let loc = window.location
    let wsStart = 'ws://'

    if (loc.protocol == "https:") {
        wsStart = 'wss://';
    }

    let endPoint = wsStart + loc.host + loc.pathname;
    console.log(endPoint);

    // it will connetc
    webSocket = new WebSocket(endPoint);

    webSocket.addEventListener('open', (e) => {
        console.log("Connetion Open");

        sendSignal('new-peer', {})
    });
    webSocket.addEventListener('message', WebSocketOnMessage);
    webSocket.addEventListener('close', (e) => {
        console.log("Connetion close", e);
    });
    webSocket.addEventListener('error', (error) => {
        console.log("Connetion error", error);
    });
})

var localStream = new MediaStream();
const constraints = {
    "video": true,
    "audio": true
}

const localVideo = document.querySelector("#local-video")

const btnToggleVideo = document.querySelector("#btn-toggle-video");
const btnToggleAudio = document.querySelector("#btn-toggle-audio");

let userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;

        let audioTracks = stream.getAudioTracks();
        let videoTracks = stream.getVideoTracks();

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click', () => {
            audioTracks[0].enabled = !audioTracks[0].enabled
            if (audioTracks[0].enabled) {
                btnToggleAudio.innerHTML = "Audio Mute"
                return;
            }
            btnToggleAudio.innerHTML = "Audio Unmute";
        });

        btnToggleVideo.addEventListener('click', () => {
            videoTracks[0].enabled = !videoTracks[0].enabled
            if (videoTracks[0].enabled) {
                btnToggleVideo.innerHTML = "Video off"
                return;
            }
            btnToggleVideo.innerHTML = "Video on";
        });

    })
    .catch(error => {
        console.log("This error in get media stream dives", error);
    });

let messageList = document.querySelector("#message-list")
let messageInput = document.querySelector("#msg")
console.log(messageInput);

let btnSendMsg = document.querySelector("#btn-send-msg")
btnSendMsg.addEventListener('click', sendMsgOnClick)

function sendMsgOnClick() {
    let message = messageInput.value
    console.log("this is sending messaage",messageInput.value);
    let li = document.createElement('li')
    li.appendChild(document.createTextNode("Me: " + message))
    messageList.appendChild(li)

    let datachannels = dataChannel();

    message = username + ':' + message
    for(index in datachannels){
        datachannels[index].send(message)
    }

    messageInput.value = '';
}

const sendSignal = (action, message) => {
    let jsonStr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    })
    webSocket.send(jsonStr)
}

const createOffer = (peerUsername, receiver_channel_name) => {
    let peer = new RTCPeerConnection(null)
    addLocalTracks(peer);
    let dc = peer.createDataChannel('channel')
    dc.addEventListener("open", () => {
        console.log("data channel connection opend");
    })
    dc.addEventListener('message', dcOnMessage)

    let remoteVideo = createVideo(peerUsername)
    setOnTrack(peer, remoteVideo);

    mapPeers[peerUsername] = [peer, dc]
    peer.addEventListener('iceconnectionstatechange', () => {
        let iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername]

            if (iceConnectionState != 'closed') {
                peer.close();
            }
            removeVideo(remoteVideo)
        }
    });

    peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log("new ice candidate", JSON.stringify(peer.localDescription));
            return;
        }
        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        })
    })

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
            console.log("Local Discripation Set succefully !");
        })
}



const createAnswer = (offer, peerUsername, receiver_channel_name) => {
    let peer = new RTCPeerConnection(null)
    addLocalTracks(peer);

    let remoteVideo = createVideo(peerUsername)
    setOnTrack(peer, remoteVideo);

    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel;
        peer.dc.addEventListener("open", () => {
            console.log("data channel connection opend");
        })
        peer.dc.addEventListener('message', dcOnMessage)
        mapPeers[peerUsername] = [peer, peer.dc]
    })

    mapPeers[peerUsername] = [peer, peer.dc]
    peer.addEventListener('iceconnectionstatechange', () => {
        let iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername]

            if (iceConnectionState != 'closed') {
                peer.close();
            }
            removeVideo(remoteVideo)
        }
    });

    peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log("new ice candidate", JSON.stringify(peer.localDescription));
            return;
        }
        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        })
    });

    peer.setRemoteDescription(offer)
        .then(() => {
            console.log("Remote Discripation set successfully for %s", peerUsername);
            return peer.createAnswer()
        })
        .then(a => {
            console.log('Answer created');
            peer.setLocalDescription(a)
        })
}

const addLocalTracks = (peer) => {
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream)
    });
    return
}

const dcOnMessage = (event) => {
    let message = event.data;
    let li = document.createElement('li')
    li.appendChild(document.createTextNode(message))
    messageList.appendChild(li)
}


const createVideo = (peerUsername) => {
    let videoContainer = document.querySelector("#video-container")
    let remoteVideo = document.createElement('video')

    remoteVideo.id = peerUsername + '-video'
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;

    let videoWrapper = document.createElement('div')
    videoContainer.appendChild(videoWrapper)
    videoWrapper.appendChild(remoteVideo)
    return remoteVideo;
}

function setOnTrack(peer, remoteVideo) {
    let remoteStream = new MediaStream()
    remoteVideo.srcObject = remoteStream
    peer.addEventListener('track', async (event) => {
        remoteStream.addTrack(event.track, remoteStream)
    })
}


const removeVideo = (video) => {
    let videoWrapper = video.parentNode;
    videoWrapper.parentNode.removeChild(videoWrapper)
} 

function dataChannel() {
    let datachannels = [];
    for(peerUsername in mapPeers){
        let dataChannel = mapPeers[peerUsername][1]
        datachannels.push(dataChannel)
    }
    return datachannels;
}