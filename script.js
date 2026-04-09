let peer = null;
let localStream = null;
let dataConn = null;
let myProfile = { name: "Anonymous", color: "#3b82f6" };

const entryScreen = document.getElementById('entry-screen');
const callInterface = document.getElementById('call-interface');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const joinInput = document.getElementById('join-id');
const joinBtn = document.getElementById('btn-join');

// Initialize Lucide Icons
lucide.createIcons();

// Join button validation logic
joinInput.addEventListener('input', () => {
    if (joinInput.value.length === 6) {
        joinBtn.disabled = false;
        joinBtn.classList.remove('bg-zinc-700', 'text-zinc-500');
        joinBtn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'active:scale-95');
    } else {
        joinBtn.disabled = true;
        joinBtn.classList.add('bg-zinc-700', 'text-zinc-500');
        joinBtn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'active:scale-95');
    }
});

/**
 * Initialize Media and Peer Connection
 */
async function startApp(peerId) {
    const nameInput = document.getElementById('user-name').value.trim();
    if (nameInput) myProfile.name = nameInput;
    
    document.getElementById('local-display-name').innerText = myProfile.name;
    document.getElementById('local-avatar').innerText = myProfile.name.charAt(0).toUpperCase();

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        
        peer = peerId ? new Peer(peerId) : new Peer();
        
        peer.on('open', (id) => {
            document.getElementById('display-code').innerText = id;
            if (!peerId) connectToPeer(joinInput.value.toUpperCase());
            showCallUI();
        });

        peer.on('call', call => {
            call.answer(localStream);
            call.on('stream', stream => document.getElementById('remote-video').srcObject = stream);
        });

        peer.on('connection', conn => setupDataConnection(conn));

    } catch (err) { 
        console.error(err);
        alert("Camera and microphone access are required for Flux."); 
    }
}

/**
 * Setup Data Connection for Chat and Identity
 */
function setupDataConnection(conn) {
    dataConn = conn;
    dataConn.on('open', () => {
        dataConn.send({ type: 'identity', name: myProfile.name, color: myProfile.color });
    });

    dataConn.on('data', data => {
        if (data.type === 'identity') {
            document.getElementById('remote-display-name').innerText = data.name;
            document.getElementById('remote-status-dot').style.backgroundColor = data.color;
            document.getElementById('waiting-overlay').classList.add('hidden');
        } else if (data.type === 'chat') {
            appendMessage(data.name, data.text, false);
        }
    });
}

/**
 * Initiate call and data connection to a peer
 */
function connectToPeer(id) {
    const call = peer.call(id, localStream);
    call.on('stream', stream => document.getElementById('remote-video').srcObject = stream);
    setupDataConnection(peer.connect(id));
}

/**
 * Update Chat UI
 */
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

// Chat Form Submission
chatForm.onsubmit = (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text && dataConn) {
        dataConn.send({ type: 'chat', name: myProfile.name, text: text });
        appendMessage("You", text, true);
        chatInput.value = '';
    }
};

/**
 * Switch from setup screen to call interface
 */
function showCallUI() {
    entryScreen.classList.add('hidden');
    callInterface.classList.remove('hidden');
    document.getElementById('controls-bar').classList.remove('hidden');
    lucide.createIcons();
}

// Button Listeners
document.getElementById('btn-create').onclick = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    startApp(code);
};

document.getElementById('btn-join').onclick = () => startApp();

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
    document.getElementById('local-muted-overlay').classList.toggle('hidden', video.enabled);
    lucide.createIcons();
};
