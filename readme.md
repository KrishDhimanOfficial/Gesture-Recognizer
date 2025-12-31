# 🖐 Gesture Reconiger

> **Transform your hands into a virtual mouse with high-performance gesture recognition.**

Gesture Reconiger is a cutting-edge MERN stack application that leverages **MediaPipe's Computer Vision** to track hand landmarks in real-time and translate them into system-level cursor movements and actions on macOS.

---

## ✨ Features

- 🎯 **Precision Cursor Tracking**: High-accuracy hand tracking with smoothing for jitter-free movement.
- 🤏 **Pinch to Click**: Natural pinching gesture (Thumb to Index/Middle) to trigger mouse clicks.
- ⚡ **Double Tap**: Quick gesture detection for double-click actions.
- 🎥 **Real-time Processing**: Optimized loop running at up to 60 FPS for low-latency response.
- 🌓 **Modern UI**: Sleek, glassmorphic dashboard built with Next.js 15+ and Tailwind CSS.
- 🛡️ **Hand Isolation**: Specifically tuned for L-Hand isolation to avoid accidental triggers.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 15+](https://nextjs.org/)
- **Vision Engine**: [Google MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- **Styling**: Tailwind CSS
- **Animation**: CSS Micro-animations & Canvas Drawing

### Backend
- **Runtime**: Node.js
- **Server**: Express.js
- **Automation**: System-level integration via `cliclick`
- **Execution**: Concurrently for managing multiple processes

---

## 🚀 Getting Started

### Prerequisites

- **macOS**: The system-level control relies on `cliclick`.
- **Node.js**: v18+ recommended.
- **PNPM**: Package manager used for both client and server.

#### Install `cliclick`
```bash
brew install cliclick
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KrishDhimanOfficial/Gesture-Recognizer.git
   cd Gesture-Recognizer
   ```

2. **Setup Server**
   ```bash
   cd server
   pnpm install
   ```

3. **Setup Client**
   ```bash
   cd ../client
   pnpm install
   ```

---

## 🎮 Running the Application

You can start both the client and server simultaneously from the `server` directory:

```bash
cd server
pnpm dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)

---

## 📖 How to Use

1. **Authorize Camera**: Grant camera permissions when prompted.
2. **Setup Left Hand**: Position your **left hand** in the camera's view (the engine is tuned for L-hand isolation).
3. **Move Cursor**: Move your hand across the screen to control the pointer.
4. **Pinch**: Bring your thumb and middle/index finger together to click.
5. **Double Tap**: Perform two quick pinches to double-click.

---

## ⚙️ How it Works

1. **Input**: The browser captures high-resolution video via `getUserMedia`.
2. **Detection**: MediaPipe processes each frame to extract 21 3D hand landmarks.
3. **Translation**: The landmask coordinates (0-1 range) are scaled to your screen resolution with smoothing applied to minimize jitter.
4. **Action**: Reached gesture thresholds trigger POST requests to the Express backend.
5. **Execution**: The backend uses the `cliclick` utility to execute the command on the OS level.

---

<p align="center">
  Developed with ❤️ by <a href="https://github.com/KrishDhimanOfficial">Krish Dhiman</a>
</p>
