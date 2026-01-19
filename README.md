# 🪞 MirrorBody-X

## Real-Time Pose-Synced Mirror Clone System

A production-grade WebGL application that creates a **real-time 3D mirror clone avatar** that perfectly copies your body movements using MediaPipe Pose tracking and Three.js rendering.

---

## ⚡ Features

### Core Features
- **Real-Time Pose Tracking** - MediaPipe Pose with 33 keypoints at 30+ FPS
- **Kalman Filter Smoothing** - Eliminates jitter with prediction
- **Skeleton Retargeting** - Accurate bone mapping to humanoid rig
- **Chrome Mirror Shader** - PBR material with fresnel reflections
- **HDR Environment Lighting** - Multiple lighting presets

### Visual Effects
- ✨ Fresnel edge glow
- 🌊 Motion trails on limbs
- 💡 Light rays from joints
- 🪞 Reflective floor plane
- 🌑 Real-time shadows

### Performance
- 🎯 GPU-accelerated rendering
- ⚡ Adaptive resolution scaling
- 📊 Frame skipping for stability
- 🔧 Performance mode presets

### Recording
- 📹 WebM/MP4 video recording
- 📸 Screenshot capture

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MirrorBody-X                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Camera     │───▶│    Pose      │───▶│   Skeleton   │      │
│  │   Pipeline   │    │   Tracker    │    │  Retargeting │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                    │               │
│         │            MediaPipe Pose        Bone Mapping         │
│         │            Kalman Filter         Quaternions          │
│         ▼                   ▼                    ▼               │
│  ┌──────────────────────────────────────────────────────────────┐
│  │                    THREE.JS SCENE                             │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  │   Avatar    │  │   Mirror    │  │   Effects   │          │
│  │  │   (Rigged)  │  │   Shader    │  │   System    │          │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │
│  │         │                │                │                  │
│  │         └────────────────┼────────────────┘                  │
│  │                          ▼                                   │
│  │              ┌─────────────────────┐                        │
│  │              │    WebGL Renderer   │                        │
│  │              └─────────────────────┘                        │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **3D Rendering** | Three.js + React Three Fiber |
| **Pose Tracking** | MediaPipe Pose |
| **Animation** | Framer Motion, GSAP |
| **Styling** | Tailwind CSS |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Modern browser with WebGL2 support
- Webcam (720p minimum recommended)
- GPU acceleration enabled

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 📁 Project Structure

```
neuro-mirror-ai/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main application page
│   │   └── globals.css         # Global styles
│   │
│   ├── components/
│   │   ├── avatar/             # 3D Avatar components
│   │   │   └── MirrorAvatar.tsx
│   │   ├── core/               # Core components
│   │   │   ├── CameraFeed.tsx  # Webcam feed with overlay
│   │   │   └── MirrorScene.tsx # Three.js scene
│   │   └── ui/                 # UI components
│   │       └── ControlPanel.tsx
│   │
│   ├── hooks/                  # React hooks
│   │   ├── usePoseTracking.ts  # Pose tracking hook
│   │   └── useSettings.ts      # Settings management
│   │
│   ├── lib/                    # Core libraries
│   │   ├── pose-tracker.ts     # MediaPipe integration
│   │   ├── skeleton-retargeting.ts
│   │   ├── mirror-shader.ts    # GLSL shaders
│   │   ├── effects.ts          # Visual effects
│   │   ├── performance.ts      # Optimization
│   │   └── recording.ts        # Video/screenshot
│   │
│   └── types/                  # TypeScript definitions
│       └── index.ts
│
├── public/                     # Static assets
├── package.json
└── next.config.ts
```

---

## ⚙️ Configuration

### Performance Modes

| Mode | Target FPS | Resolution | Effects |
|------|------------|------------|---------|
| **Quality** | 30 | 100% | Full |
| **Balanced** | 30 | 85% | Medium |
| **Performance** | 60 | 70% | Low |

### Shader Presets

| Preset | Metalness | Roughness | Description |
|--------|-----------|-----------|-------------|
| Chrome | 1.0 | 0.05 | Classic mirror finish |
| Gold | 1.0 | 0.1 | Warm metallic |
| Holographic | 0.8 | 0.2 | Iridescent effect |
| Neon | 0.5 | 0.3 | Glowing edges |
| Glass | 0.1 | 0.0 | Transparent |
| Obsidian | 0.9 | 0.15 | Dark reflective |

### Lighting Presets

- **Studio** - Clean, professional lighting
- **Sunset** - Warm orange tones
- **Neon** - Cyberpunk purple/cyan
- **Dramatic** - High contrast single source
- **Soft** - Ambient diffused light

---

## 🎮 Controls

| Control | Action |
|---------|--------|
| **Panel Toggle** | Click arrow on right edge |
| **Orbit Camera** | Click and drag on 3D view |
| **Zoom** | Scroll wheel |
| **Screenshot** | 📸 button |
| **Record** | 🔴 button |

---

## 🐛 Troubleshooting

### Camera not working

1. Check browser permissions for camera access
2. Ensure HTTPS (required for camera API on deployed sites)
3. Try a different browser (Chrome/Edge recommended)

### Low FPS

1. Enable GPU acceleration in browser settings
2. Switch to "Performance" mode
3. Close other GPU-intensive applications
4. Reduce browser window size

### Pose tracking jittery

1. Ensure good lighting
2. Stand 2-3 meters from camera
3. Wear contrasting clothing
4. Adjust Kalman filter settings

---

## 📊 Performance Targets

| Metric | Target | Minimum |
|--------|--------|---------|
| FPS | 30-60 | 24 |
| Latency | <70ms | <100ms |
| Pose Inference | <30ms | <50ms |
| Render Time | <10ms | <16ms |

---

## 🚧 Roadmap

- [ ] Custom avatar model loading (GLB/FBX)
- [ ] Hand tracking integration
- [ ] Face mesh overlay
- [ ] Background replacement
- [ ] Multi-person tracking
- [ ] VR headset support

---

**Built for production. Not a toy demo.** 🔥
