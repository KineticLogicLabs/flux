let peer = null;
let localStream = null;
let dataConn = null;
let myName = "User";
let remoteName = "User 2";

const entryScreen = document.getElementById('entry-screen');
const callInterface = document.getElementById('call-interface');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const joinInput = document.getElementById('join-id');
const joinBtn = document.getElementById('btn-join');
const errorContainer = document.getElementById('error-container');
const errorMsg = document.getElementById('error-msg');

lucide.createIcons();

// Join button activation
joinInput.addEventListener('input', () => {
    const val = joinInput.value.trim();
    if (val.length === 6) {
        joinBtn.disabled = false;
        joinBtn.classList.add('bg-blue-600', 'text-white');
    } else {
        joinBtn.disabled = true;
        joinBtn.classList.remove('bg-blue-600', 'text-white');
    }
});

function showError(text) {
    errorMsg.innerText = text;
    errorContainer.classList.remove('hidden');
    joinBtn.innerHTML = "Join";
    joinBtn.disabled = false;
}

/** * INITIALIZE APP 
 **/
async function startFlux(targetId, isJoining = false) {
    errorContainer.classList.add('hidden');
    const inputName = document.getElementById('user-name').value.trim();
    
    // Naming Logic: Default to User or User 2
    if (isJoining) {
        myName = inputName || "User 2";
        remoteName = "User";
    } else {
        myName = inputName || "User";
        remoteName = "User 2";
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('local-display-name').innerText = myName;

        // Peer initialization
        peer = isJoining ? new Peer() : new Peer(targetId);

        peer.on('open', (id) => {
            if (isJoining) {
                attemptConnection(targetId);
            } else {
                document.getElementById('display-code').innerText = id;
                showCallUI();
            }
        });

        peer.on('call', (call) => {
            call.answer(localStream);
            call.on('stream', (remoteStream) => {
                document.getElementById('remote-video').srcObject = remoteStream;
                document.getElementById('waiting-overlay').classList.add('hidden');
            });
        });

        peer.on('connection', (conn) => {
            dataConn = conn;
            setupDataHandlers();
        });

        peer.on('error', (err) => {
            if (err.type === 'peer-not-found') showError("Wrong code. Meeting not found.");
            else if (err.type === 'unavailable-id') showError("Code in use. Try again.");
            else showError("Connection error.");
        });

    } catch (err) {
        showError("Camera/Mic access denied.");
    }
}

/** * CONNECT LOGIC (Guest)
 **/
function attemptConnection(code) {
    const conn = peer.connect(code);
    
    conn.on('open', () => {
        dataConn = conn;
        setupDataHandlers();
        
        const call = peer.call(code, localStream);
        call.on('stream', (remoteStream) => {
            document.getElementById('remote-video').srcObject = remoteStream;
            document.getElementById('waiting-overlay').classList.add('hidden');
        });

        // Ensure guest sees the 6-digit code, not their own Peer ID
        document.getElementById('display-code').innerText = code;
        showCallUI();
    });

    setTimeout(() => {
        if (!dataConn) showError("Wrong code or meeting ended.");
    }, 5000);
}

/** * DATA & STATUS LOGIC
 **/
function setupDataHandlers() {
    dataConn.on('open', () => {
        sendStatusUpdate();
    });

    dataConn.on('data', (data) => {
        if (data.type === 'status') {
            // Update remote name and icons
            document.getElementById('remote-display-name').innerText = data.name;
            updateStatusIcons('remote', data.mic, data.vid);
            document.getElementById('waiting-overlay').classList.add('hidden');
        } else if (data.type === 'chat') {
            appendMessage(data.name, data.text, false);
        }
    });
}

function sendStatusUpdate() {
    if (!dataConn || !dataConn.open) return;
    const micActive = localStream.getAudioTracks()[0].enabled;
    const vidActive = localStream.getVideoTracks()[0].enabled;
    
    // Update local icons immediately
    updateStatusIcons('local', micActive, vidActive);

    // Send to peer
    dataConn.send({
        type: 'status',
        name: myName,
        mic: micActive,
        vid: vidActive
    });
}

function updateStatusIcons(prefix, micActive, vidActive) {
    const micIcon = document.getElementById(`status-mic-${prefix}`);
    const vidIcon = document.getElementById(`status-vid-${prefix}`);
    
    // Toggle Mic Icon
    micIcon.setAttribute('data-lucide', micActive ? 'mic' : 'mic-off');
    micIcon.style.color = micActive ? 'white' : '#ef4444'; // white or red

    // Toggle Vid Icon
    vidIcon.setAttribute('data-lucide', vidActive ? 'video' : 'video-off');
    vidIcon.style.color = vidActive ? 'white' : '#ef4444';

    lucide.createIcons();
}

function appendMessage(sender, text, isMine) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col ${isMine ? 'items-end' : 'items-start'}`;
    msgDiv.innerHTML = `
        <span class="text-[10px] text-zinc-500 mb-1 px-1">${sender}</span>
        <div class="chat-bubble ${isMine ? 'chat-mine' : 'chat-theirs'}">${text}</div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.onsubmit = (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text && dataConn) {
        dataConn.send({ type: 'chat', name: myName, text: text });
        appendMessage("You", text, true);
        chatInput.value = '';
    }
};

function showCallUI() {
    entryScreen.classList.add('hidden');
    callInterface.classList.remove('hidden');
    document.getElementById('controls-bar').classList.remove('hidden');
    lucide.createIcons();
}

// Event Listeners
document.getElementById('btn-create').onclick = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    startFlux(code, false);
};

document.getElementById('btn-join').onclick = () => {
    const code = joinInput.value.trim().toUpperCase();
    joinBtn.innerHTML = "Connecting...";
    joinBtn.disabled = true;
    startFlux(code, true);
};

document.getElementById('btn-hangup').onclick = () => window.location.reload();

document.getElementById('toggle-mic').onclick = function() {
    const track = localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    this.classList.toggle('active-off', !track.enabled);
    this.innerHTML = `<i data-lucide="${track.enabled ? 'mic' : 'mic-off'}"></i>`;
    sendStatusUpdate();
};

document.getElementById('toggle-video').onclick = function() {
    const track = localStream.getVideoTracks()[0];
    track.enabled = !track.enabled;
    this.classList.toggle('active-off', !track.enabled);
    this.innerHTML = `<i data-lucide="${track.enabled ? 'video' : 'video-off'}"></i>`;
    sendStatusUpdate();
};
