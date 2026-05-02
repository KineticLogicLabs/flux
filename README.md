# Flux | Online Video Meeting

Flux is a high-performance peer-to-peer video meeting application designed for seamless communication. It supports multi-user video calls, real-time chat, and screen sharing, all within a polished, responsive interface.

## 🚀 Features

- **P2P Video & Audio**: High-quality real-time communication powered by PeerJS.
- **Multi-User Mesh Networking**: Connect with multiple participants in a direct peer-to-peer network.
- **Host Controls**: Only the meeting host can end the call for all participants.
- **Real-Time Chat**: Integrated chat system with message history and timestamps.
- **Screen Sharing**: Effortlessly share your screen with other participants.
- **Responsive Design**: Optimized for Desktop, Tablet, and Mobile with explicit 4:3 video ratios.
- **Theming**: Support for Dark and Light modes with customizable profile colors.
- **Participants List**: Easily view and manage current attendees and their media status.

## 🛠️ Technical Stack

- **Framework**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Networking**: [PeerJS](https://peerjs.com/) (WebRTC)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

## 🏁 Getting Started

### Prerequisites

- Node.js installed on your machine.

### Installation

1. Clone the repository or download the source code.
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

### Building for Production

Create an optimized production build:
```bash
npm run build
```

## 🔒 Security Note

This app uses direct peer-to-peer connections. For production environments, consider implementing a TURN server for better reliability across restrictive networks.
