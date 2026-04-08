let peer = null;
let localStream = null;
let currentCall = null;

// UI Elements
const entryScreen = document.getElementById('entry-screen');
const callInterface = document.getElementById('call-interface');
const controlsBar = document.getElementById('controls-bar');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const displayCode = document.getElementById('display-code');
const joinInput = document.getElementById('join-id');
const errorMsg = document.getElementById('error-msg');

// Buttons
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const btnHangup = document.getElementById('btn-hangup');
const toggleMic = document.getElementById('toggle-mic');
const toggleVideo = document.getElementById('toggle-video');

// Initialize Lucide icons
lucide.createIcons();

/**
 * Generate a random 6-digit numeric code
 */
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Setup Local Media (Camera/Mic)
 */
async function setupLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        localVideo.srcObject = localStream;
        return true;
    } catch (err) {
        console.error("Failed to get local stream", err);
        alert("Could not access camera/microphone. Please check permissions.");
        return false;
    }
}

/**
 * Initialize Peer Connection
 */
function initPeer(id) {
    // We use the ID passed in (the 6-digit code)
    peer = new Peer(id, {
        debug: 2,
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        console.log('Peer connected with ID:', id);
        displayCode.innerText = id;
        showCallInterface();
    });

    peer.on('call', (call) => {
        // Answer incoming call
        currentCall = call;
        call.answer(localStream);
        handleCall(call);
    });

    peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            errorMsg.innerText = "Meeting code already in use. Try again.";
        } else if (err.type === 'peer-not-found') {
            errorMsg.innerText = "Meeting code not found.";
        } else {
            errorMsg.innerText = "An error occurred.";
        }
        errorMsg.classList.remove('hidden');
    });
}

/**
 * Handle Remote Stream Logic
 */
function handleCall(call) {
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        document.getElementById('waiting-overlay').classList.add('hidden');
        document.getElementById('remote-name').innerText = "Guest Participant";
    });

    call.on('close', () => {
        window.location.reload();
    });
}

/**
 * Switch UI from Landing to Call
 */
function showCallInterface() {
    entryScreen.classList.add('hidden');
    callInterface.classList.remove('hidden');
    controlsBar.classList.remove('hidden');
    lucide.createIcons(); // Refresh icons for new visible elements
}

// --- Event Listeners ---

// Create Meeting
btnCreate.onclick = async () => {
    const mediaReady = await setupLocalMedia();
    if (mediaReady) {
        const code = generateCode();
        initPeer(code);
    }
};

// Join Meeting
btnJoin.onclick = async () => {
    const code = joinInput.value.trim();
    if (code.length !== 6) {
        errorMsg.innerText = "Please enter a valid 6-digit code.";
        errorMsg.classList.remove('hidden');
        return;
    }

    const mediaReady = await setupLocalMedia();
    if (mediaReady) {
        // For joining, we use a random ID for ourselves and then call the code
        peer = new Peer();
        peer.on('open', () => {
            const call = peer.call(code, localStream);
            currentCall = call;
            handleCall(call);
            displayCode.innerText = code;
            showCallInterface();
        });
        
        peer.on('error', (err) => {
            errorMsg.innerText = "Meeting not found.";
            errorMsg.classList.remove('hidden');
        });
    }
};

// Mute/Unmute Mic
toggleMic.onclick = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        toggleMic.classList.add('active-off');
        toggleMic.innerHTML = '<i data-lucide="mic-off"></i>';
    } else {
        audioTrack.enabled = true;
        toggleMic.classList.remove('active-off');
        toggleMic.innerHTML = '<i data-lucide="mic"></i>';
    }
    lucide.createIcons();
};

// Toggle Video
toggleVideo.onclick = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    const overlay = document.getElementById('local-muted-overlay');
    
    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        toggleVideo.classList.add('active-off');
        toggleVideo.innerHTML = '<i data-lucide="video-off"></i>';
        overlay.classList.remove('hidden');
    } else {
        videoTrack.enabled = true;
        toggleVideo.classList.remove('active-off');
        toggleVideo.innerHTML = '<i data-lucide="video"></i>';
        overlay.classList.add('hidden');
    }
    lucide.createIcons();
};

// Hang up
btnHangup.onclick = () => {
    if (currentCall) currentCall.close();
    window.location.reload();
};
