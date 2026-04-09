let peer = null;
let localStream = null;
let dataConn = null;
let myName = "Anonymous";

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
    joinBtn.innerHTML = "Join"; // Reset button text if it was loading
    joinBtn.disabled = false;
}

/** * INITIALIZE APP 
 * @param {string} targetId - If provided, we are creating a meeting with this ID.
 * @param {boolean} isJoining - If true, we are looking for an existing ID.
 **/
async function startFlux(targetId, isJoining = false) {
    errorContainer.classList.add('hidden');
    const inputName = document.getElementById('user-name').value.trim();
    if (inputName) myName = inputName; // Preserves Capitals

    try {
        // 1. Get Camera
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('local-display-name').innerText = myName;

        // 2. Initialize Peer
        // If joining, we get a random ID. If creating, we use the 6-digit code.
        peer = isJoining ? new Peer() : new Peer(targetId);

        peer.on('open', (id) => {
            if (isJoining) {
                // If we are joining, attempt to connect to the target
                attemptConnection(targetId);
            } else {
                // If we are creating, just wait for others
                document.getElementById('display-code').innerText = id;
                showCallUI();
            }
        });

        // 3. Listen for Incoming (For the Host)
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
            console.error("Peer Error:", err.type);
            if (err.type === 'peer-not-found') showError("Wrong code. Meeting not found.");
            else if (err.type === 'unavailable-id') showError("Code in use. Try again.");
            else showError("Connection error. Try again.");
        });

    } catch (err) {
        showError("Camera/Mic access denied.");
    }
}

/** * TRY TO CONNECT (For the Guest)
 **/
function attemptConnection(code) {
    // Attempt Data Connection first to verify peer exists
    const conn = peer.connect(code);
    
    conn.on('open', () => {
        dataConn = conn;
        setupDataHandlers();
        
        // If data opens, start the video call
        const call = peer.call(code, localStream);
        call.on('stream', (remoteStream) => {
            document.getElementById('remote-video').srcObject = remoteStream;
            document.getElementById('waiting-overlay').classList.add('hidden');
        });

        document.getElementById('display-code').innerText = code;
        showCallUI();
    });

    // Timeout if peer doesn't respond
    setTimeout(() => {
        if (!dataConn) showError("Wrong code or meeting ended.");
    }, 5000);
}

/** * CHAT & IDENTITY LOGIC 
 **/
function setupDataHandlers() {
    // Send our name to the other person immediately
    dataConn.on('open', () => {
        dataConn.send({ type: 'identity', name: myName });
    });

    dataConn.on('data', (data) => {
        if (data.type === 'identity') {
            document.getElementById('remote-display-name').innerText = data.name;
            document.getElementById('remote-status-dot').classList.replace('bg-zinc-500', 'bg-blue-500');
            document.getElementById('waiting-overlay').classList.add('hidden');
        } else if (data.type === 'chat') {
            appendMessage(data.name, data.text, false);
        }
    });
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

// Button Events
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

// Controls
document.getElementById('toggle-mic').onclick = function() {
    const audio = localStream.getAudioTracks()[0];
    audio.enabled = !audio.enabled;
    this.classList.toggle('active-off', !audio.enabled);
    this.innerHTML = `<i data-lucide="${audio.enabled ? 'mic' : 'mic-off'}"></i>`;
    lucide.createIcons();
};

document.getElementById('toggle-video').onclick = function() {
    const video = localStream.getVideoTracks()[0];
    video.enabled = !video.enabled;
    this.classList.toggle('active-off', !video.enabled);
    this.innerHTML = `<i data-lucide="${video.enabled ? 'video' : 'video-off'}"></i>`;
    lucide.createIcons();
};
