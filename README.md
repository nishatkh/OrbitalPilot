# OrbitalPilot 🚀

An autonomous reinforcement learning lunar lander and space shuttle booster simulation system built with **Gymnasium Box2D v3**, **Stable-Baselines3 (PPO)**, **FastAPI/WebSockets**, and a 3D **Three.js + React** dashboard featuring an aerospace glassmorphic HUD.

---

## 🌟 Key Features

- **Trained RL Policies**: SB3 PPO agents trained on `LunarLander-v3` with benchmark return > 230+ pts.
- **Potential-Based Reward Shaping (PBRS)**: Evaluates invariance proofs and velocity-damping potential against reward hacking and standard baselines.
- **Dual Inference Engine**:
  - **Live WebSocket Server (`ws_server.py`)**: Full Python Box2D physics stream at 50 Hz.
  - **In-Browser Fallback Engine**: Pure client-side neural network weight inference + local numerical integrator.
- **3D Aerospace Simulation**: Realistic Apollo booster geometry, dynamic particle smoke, landing pad terrain (LC-39A), orbital and chase cameras.
- **Glassmorphic Cockpit Dashboard**:
  - Telemetry HUD with real-time state observations (Pos X/Y, Velocity X/Y, Pitch Angle, Angular Velocity, Touchdown sensors).
  - Reinforcement Learning return metrics, landing streak counter, and live score history.
  - Interactive manual override controls (`[W]`, `[A]`, `[D]`, `[S]`).
  - Training curve analytics & reward shaping laboratory.

---

## 🏗️ Architecture

```
rocket-ai/
├── frontend/                     # React + Vite + Three.js + TailwindCSS frontend
│   ├── src/
│   │   ├── components/           # Glassmorphic HUD components & 3D Canvas
│   │   ├── services/             # Local physics, trained policies, & WebSockets
│   │   └── types/                # Simulation state & telemetry interfaces
│   └── public/models/            # Exported ONNX & JSON neural weights
├── models/                       # Trained Stable-Baselines3 model checkpoints
├── train_lander.py               # PPO agent training script
├── evaluate_lander.py            # Monte-Carlo evaluation script
├── export_weights.py             # Policy neural weights exporter for web
├── export_onnx.py                # ONNX model exporter
├── reward_experiments.py         # Reward shaping & reward hacking experiments
├── ws_server.py                  # Real-time WebSocket telemetry bridge
└── requirements.txt              # Python dependencies
```

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/nishatkh/OrbitalPilot.git
cd OrbitalPilot

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start WebSocket server
python3 ws_server.py
```

### 2. Frontend Dashboard Setup

```bash
cd frontend

# Install node packages
npm install

# Run Vite dev server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 🕹️ Controls

- **Manual Flight Override**:
  - `[W]` / `[Up Arrow]` — Main Thruster
  - `[A]` / `[Left Arrow]` — Left RCS Thruster (Roll Right)
  - `[D]` / `[Right Arrow]` — Right RCS Thruster (Roll Left)
  - `[S]` / `[Down Arrow]` — Engines Idle
- `[Space]` — Reset Simulation Episode
- `[P]` — Pause / Resume

---

## 📄 License

MIT License.
