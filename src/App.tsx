/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  MessageSquare, 
  Send,
  Loader2,
  Settings,
  Monitor,
  X,
  Palette,
  User,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  sender: string;
  text: string;
  isMine: boolean;
  timestamp: string;
}

interface StatusData {
  type: 'status';
  name: string;
  mic: boolean;
  vid: boolean;
}

interface ChatData {
  type: 'chat';
  name: string;
  text: string;
}

type PeerData = StatusData | ChatData;

export default function App() {
  const [inCall, setInCall] = useState(false);
  const [userName, setUserName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [meetingId, setMeetingId] = useState('------');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [myName, setMyName] = useState('User');
  const [remoteName, setRemoteName] = useState('Waiting...');
  
  const [micActive, setMicActive] = useState(true);
  const [vidActive, setVidActive] = useState(true);
  const [remoteMicActive, setRemoteMicActive] = useState(true);
  const [remoteVidActive, setRemoteVidActive] = useState(true);
  const [isWaiting, setIsWaiting] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profileColor, setProfileColor] = useState('#2563eb');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Temp settings for modal
  const [tempName, setTempName] = useState(myName);
  const [tempColor, setTempColor] = useState(profileColor);
  const [tempTheme, setTempTheme] = useState(theme);
  const [tempSound, setTempSound] = useState(soundEnabled);

  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const mediaCallRef = useRef<MediaConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio refs
  const audioToggleRef = useRef<HTMLAudioElement | null>(null);
  const audioConnectRef = useRef<HTMLAudioElement | null>(null);
  const audioDisconnectRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio elements with more reliable URLs
    audioToggleRef.current = new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3'); 
    audioConnectRef.current = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3'); 
    audioDisconnectRef.current = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3'); 
    
    // Preload sounds
    [audioToggleRef, audioConnectRef, audioDisconnectRef].forEach(ref => {
      if (ref.current) {
        ref.current.load();
      }
    });
  }, []);

  const playSound = (type: 'toggle' | 'connect' | 'disconnect') => {
    if (!soundEnabled) return;
    const audio = type === 'toggle' ? audioToggleRef.current : type === 'connect' ? audioConnectRef.current : audioDisconnectRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (inCall) {
      timerRef.current = setInterval(() => {
        setMeetingDuration(prev => prev + 1);
      }, 1000);
      playSound('connect');
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setMeetingDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inCall]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendStatusUpdate = (mic: boolean, vid: boolean, nameOverride?: string) => {
    if (dataConnRef.current?.open) {
      dataConnRef.current.send({
        type: 'status',
        name: nameOverride || myName,
        mic,
        vid
      });
    }
  };

  const setupDataHandlers = (conn: DataConnection) => {
    dataConnRef.current = conn;
    
    const onOpen = () => {
      // Send initial status
      conn.send({
        type: 'status',
        name: myName,
        mic: micActive,
        vid: vidActive
      });
    };

    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('data', (data: any) => {
      const peerData = data as PeerData;
      if (peerData.type === 'status') {
        setRemoteName(peerData.name);
        setRemoteMicActive(peerData.mic);
        setRemoteVidActive(peerData.vid);
        setIsWaiting(false);
      } else if (peerData.type === 'chat') {
        setMessages(prev => [...prev, { 
          sender: peerData.name, 
          text: peerData.text, 
          isMine: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    });

    conn.on('close', () => {
      handleHangup();
    });
  };

  const startFlux = async (targetId: string, isJoining: boolean) => {
    setError(null);
    setIsConnecting(true);
    
    const finalMyName = userName.trim() || (isJoining ? "User 2" : "User");
    setMyName(finalMyName);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setMicActive(true);
      setVidActive(true);
    } catch (err) {
      console.warn("Camera/Mic access denied, continuing without media:", err);
      setLocalStream(null);
      setMicActive(false);
      setVidActive(false);
    }

    const peer = isJoining ? new Peer() : new Peer(targetId);
    peerRef.current = peer;

    peer.on('open', (id) => {
      if (isJoining) {
        attemptConnection(targetId, stream);
      } else {
        setMeetingId(id);
        setInCall(true);
        setIsConnecting(false);
      }
    });

    peer.on('call', (call) => {
      mediaCallRef.current = call;
      // Answer with local stream if available, otherwise answer without sending media
      call.answer(stream || undefined);
      call.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
        setIsWaiting(false);
      });
    });

    peer.on('connection', (conn) => {
      setupDataHandlers(conn);
    });

    peer.on('error', (err) => {
      setIsConnecting(false);
      if (err.type === 'peer-unavailable') setError("Wrong code. Meeting not found.");
      else if (err.type === 'unavailable-id') setError("Code in use. Try again.");
      else setError("Connection error.");
    });
  };

  const attemptConnection = (code: string, stream: MediaStream | null) => {
    if (!peerRef.current) return;

    const conn = peerRef.current.connect(code);
    
    conn.on('open', () => {
      setupDataHandlers(conn);
      
      // Initiate call to receive remote stream, even if we don't have a local stream
      const call = peerRef.current!.call(code, stream || new MediaStream());
      mediaCallRef.current = call;
      call.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
        setIsWaiting(false);
      });

      setMeetingId(code);
      setInCall(true);
      setIsConnecting(false);
    });

    setTimeout(() => {
      if (!dataConnRef.current) {
        setError("Wrong code or meeting ended.");
        setIsConnecting(false);
      }
    }, 5000);
  };

  const handleCreate = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    startFlux(code, false);
  };

  const handleJoin = () => {
    if (joinId.length === 6) {
      startFlux(joinId.toUpperCase(), true);
    }
  };

  const handleHangup = () => {
    playSound('disconnect');
    localStream?.getTracks().forEach(track => track.stop());
    peerRef.current?.destroy();
    setTimeout(() => window.location.reload(), 500);
  };

  const toggleMic = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setMicActive(track.enabled);
      sendStatusUpdate(track.enabled, vidActive);
      playSound('toggle');
    } else {
      setError("Microphone is not available.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      track.enabled = !track.enabled;
      setVidActive(track.enabled);
      sendStatusUpdate(micActive, track.enabled);
      playSound('toggle');
    } else {
      setError("Camera is not available.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);

        const videoTrack = stream.getVideoTracks()[0];
        
        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Replace track in active call
        if (mediaCallRef.current) {
          const sender = mediaCallRef.current.peerConnection.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }

        videoTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    // Restore local camera stream
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      const videoTrack = localStream.getVideoTracks()[0];
      if (mediaCallRef.current && videoTrack) {
        const sender = mediaCallRef.current.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
    }
  };

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (dataConnRef.current?.open) {
        dataConnRef.current.send({ type: 'chat', name: myName, text: chatInput.trim() });
      }
      setMessages(prev => [...prev, { 
        sender: "You", 
        text: chatInput.trim(), 
        isMine: true,
        timestamp
      }]);
      setChatInput('');
    }
  };

  return (
    <div className={`font-sans h-screen flex flex-col overflow-hidden bg-main text-primary`} data-theme={theme}>
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 border border-red-500"
          >
            <X className="w-4 h-4" /> {error}
          </motion.div>
        )}

        {!inCall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-footer"
          >
            <div className="max-w-md w-full p-8 rounded-2xl shadow-2xl bg-sidebar border border-theme">
              <div className="flex flex-col items-center mb-10">
                <h1 className="text-5xl font-black tracking-tight text-center bg-gradient-to-br from-white to-secondary bg-clip-text text-transparent">Flux</h1>
                <p className="text-secondary text-sm mt-2">Online video meeting</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase mb-2 ml-1">Display Name</label>
                  <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="User" 
                    className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-main border-theme text-primary"
                  />
                </div>

                <div className="pt-4 border-t border-theme">
                  <button 
                    onClick={handleCreate}
                    disabled={isConnecting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-semibold mb-3 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isConnecting && !joinId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create New Meeting"}
                  </button>
                  
                  <div className="relative flex items-center py-4">
                    <div className="flex-grow border-t border-theme"></div>
                    <span className="flex-shrink mx-4 text-secondary text-[10px] uppercase tracking-[0.2em] font-black">or</span>
                    <div className="flex-grow border-t border-zinc-800"></div>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      maxLength={6} 
                      value={joinId}
                      onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                      placeholder="6-digit code" 
                      className="flex-1 border rounded-xl px-4 py-3 text-center font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-main border-theme text-primary"
                    />
                    <button 
                      onClick={handleJoin}
                      disabled={joinId.length !== 6 || isConnecting}
                      className={`px-6 rounded-xl font-semibold transition-all ${joinId.length === 6 ? 'bg-blue-600 text-white' : 'bg-footer text-secondary border border-theme'}`}
                    >
                      {isConnecting && joinId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {inCall && (
        <>
          <main className="flex-1 flex p-4 gap-4 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Local */}
                <div className="relative rounded-2xl overflow-hidden bg-sidebar border border-theme">
                  <video 
                    ref={localVideoRef}
                    className={`w-full h-full object-cover mirror ${!vidActive ? 'hidden' : ''}`} 
                    autoPlay 
                    muted 
                    playsInline 
                  />
                  {!vidActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-main" style={{ backgroundColor: profileColor }}>
                      <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm">
                        <span className="text-4xl font-black text-white">{myName.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg text-sm flex items-center gap-3 backdrop-blur-md border border-white/10 text-white">
                    <span>{myName}</span>
                    <div className="flex gap-1.5 border-l border-white/20 pl-2">
                      {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-red-500" />}
                      {vidActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                  </div>
                </div>

                {/* Remote */}
                <div className="relative rounded-2xl overflow-hidden bg-sidebar border border-theme">
                  <video 
                    ref={remoteVideoRef}
                    className={`w-full h-full object-cover ${!remoteVidActive ? 'hidden' : ''}`} 
                    autoPlay 
                    playsInline 
                    onLoadedMetadata={(e) => (e.target as HTMLVideoElement).play().catch(err => console.error("Remote play failed", err))}
                  />
                  {!remoteVidActive && !isWaiting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-footer">
                      <div className="w-24 h-24 rounded-full bg-sidebar flex items-center justify-center border border-theme">
                        <span className="text-4xl font-black text-white">{remoteName.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg text-sm flex items-center gap-3 backdrop-blur-md border border-white/10 text-white">
                    <span>{remoteName}</span>
                    {!isWaiting && (
                      <div className="flex gap-1.5 border-l border-white/20 pl-2">
                        {remoteMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-red-500" />}
                        {remoteVidActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    )}
                  </div>
                  {isWaiting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-main">
                      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                      <p className="mt-4 text-sm font-medium text-secondary">Waiting for partner...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="w-80 flex flex-col gap-4">
              <div className="rounded-2xl p-4 shadow-xl bg-sidebar border border-theme flex justify-between items-start">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-secondary font-bold mb-1 block">Meeting ID</label>
                  <div className="text-2xl font-mono font-black text-blue-400 tracking-tighter">{meetingId}</div>
                </div>
                <div className="text-right">
                  <label className="text-[10px] uppercase tracking-widest text-secondary font-bold mb-1 block">Duration</label>
                  <div className="text-xl font-mono font-bold text-blue-500">{formatDuration(meetingDuration)}</div>
                </div>
              </div>

              <div className="flex-1 rounded-2xl flex flex-col shadow-xl overflow-hidden bg-sidebar border border-theme">
                <div className="p-4 border-b border-theme">
                  <h2 className="font-bold flex items-center gap-2 text-primary">
                    <MessageSquare className="w-4 h-4 text-blue-500" /> Chat
                  </h2>
                </div>
                <div 
                  className="flex-1 overflow-y-auto p-4 space-y-4 cursor-pointer"
                  onClick={() => setShowTimestamps(!showTimestamps)}
                >
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.isMine ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] text-secondary font-bold">{msg.sender}</span>
                        {showTimestamps && <span className="text-[8px] text-secondary font-medium opacity-70">{msg.timestamp}</span>}
                      </div>
                      <div 
                        className={`chat-bubble ${msg.isMine ? 'chat-mine' : 'chat-theirs'}`}
                        style={msg.isMine ? { backgroundColor: profileColor } : {}}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 bg-footer border-t border-theme">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Message..." 
                      className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-main border border-theme text-primary"
                    />
                    <button type="submit" className="bg-blue-600 p-2 rounded-lg hover:bg-blue-700 transition-colors accent-theme">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </aside>
          </main>

          <footer className="h-20 border-t flex items-center justify-center px-6 bg-footer border-theme">
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleMic}
                className={`control-btn ${!micActive ? 'active-off' : ''}`}
                title="Toggle Microphone"
              >
                {micActive ? <Mic /> : <MicOff />}
              </button>
              <button 
                onClick={toggleVideo}
                className={`control-btn ${!vidActive ? 'active-off' : ''}`}
                title="Toggle Video"
              >
                {vidActive ? <Video /> : <VideoOff />}
              </button>
              <button 
                onClick={toggleScreenShare}
                className={`control-btn ${isScreenSharing ? 'bg-blue-600 border-blue-600' : ''}`}
                title="Share Screen"
              >
                <Monitor />
              </button>
              <div className="w-px h-6 mx-2 border-l border-theme"></div>
              <button 
                onClick={() => {
                  setTempName(myName);
                  setTempColor(profileColor);
                  setTempTheme(theme);
                  setTempSound(soundEnabled);
                  setShowSettings(true);
                }}
                className="control-btn"
                title="Settings"
              >
                <Settings />
              </button>
              <button 
                onClick={handleHangup}
                className="control-btn bg-red-500 border-red-500 text-white hover:bg-red-600 transition-colors"
                title="Hang Up"
              >
                <PhoneOff />
              </button>
            </div>
          </footer>

          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl bg-sidebar border-theme"
                >
                  <div className="p-6 border-b flex items-center justify-between border-theme">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                      <Settings className="w-5 h-5 text-blue-500" /> Settings
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="p-2 rounded-lg transition-colors hover:bg-main">
                      <X className="w-5 h-5 text-primary" />
                    </button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
                        <User className="w-3 h-3" /> Display Name
                      </label>
                      <input 
                        type="text" 
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-main border-theme text-primary"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
                        <Palette className="w-3 h-3" /> Profile Color
                      </label>
                      <div className="flex gap-3">
                        {['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706'].map(color => (
                          <button 
                            key={color}
                            onClick={() => setTempColor(color)}
                            className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-90 ${tempColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
                        <Sun className="w-3 h-3" /> Appearance
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'dark', name: 'Dark', icon: <Moon className="w-4 h-4" /> },
                          { id: 'light', name: 'Light', icon: <Sun className="w-4 h-4" /> },
                        ].map(t => (
                          <button 
                            key={t.id}
                            onClick={() => setTempTheme(t.id as any)}
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${tempTheme === t.id ? 'bg-blue-600 border-blue-500 text-white accent-theme' : 'text-secondary hover:border-theme bg-main border-theme'}`}
                          >
                            {t.icon} {t.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-theme">
                      <button 
                        onClick={() => setTempSound(!tempSound)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-main border border-theme hover:bg-sidebar transition-colors"
                      >
                        <span className="text-sm font-medium text-primary flex items-center gap-2">
                          Sound Effects
                        </span>
                        <div className={`w-10 h-5 rounded-full transition-colors relative ${tempSound ? 'bg-blue-600' : 'bg-footer'}`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${tempSound ? 'left-6' : 'left-1'}`} />
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 border-t bg-footer border-theme">
                    <button 
                      onClick={() => {
                        setMyName(tempName);
                        setProfileColor(tempColor);
                        setTheme(tempTheme);
                        setSoundEnabled(tempSound);
                        if (tempName !== myName && inCall) {
                          sendStatusUpdate(micActive, vidActive, tempName);
                        }
                        setShowSettings(false);
                      }}
                      className="w-full py-3 rounded-xl font-semibold transition-colors bg-main text-primary border border-theme"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
