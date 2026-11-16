# OrbitalPilot

A spacecraft landing simulation where a reinforcement learning agent learns to land on its own, with a live 3D dashboard on top of it.

I built OrbitalPilot to see how far I could take a small RL problem. The agent is trained with Proximal Policy Optimization (PPO) on Gymnasium's `LunarLander-v3` using Stable-Baselines3. A React and Three.js frontend shows what the agent is doing in 3D, with telemetry streaming in from the Python side.

It started as a way to understand reward engineering, and it grew into a project that mixes RL, a Python simulation backend, real-time communication, and 3D frontend work.

> **Scope note:** The learning environment is the standard simulated lunar lander. The booster-style 3D model and the aerospace-style HUD are just for visualization. They are not a validated physical model of a real rocket or shuttle.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [How It Is Put Together](#how-it-is-put-together)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Controls](#controls)
- [Training and Evaluation](#training-and-evaluation)
- [Reward Shaping Experiments](#reward-shaping-experiments)
- [Troubleshooting](#troubleshooting)
- [Author](#author)

---

<div align="center">
  <img src="https://i.postimg.cc/jj5V03YG/image.png" alt="OrbitalPilot 3D spacecraft simulation dashboard" width="100%" />
  <p><em>The 3D simulation with live telemetry, AI flight control, and the HUD.</em></p>
</div>

## Features

**PPO agent.** I train an agent with PPO on `LunarLander-v3`, save the policy, reload it later, and evaluate it over many episodes.

**Reward shaping experiments.** I compare the baseline reward against custom ones, including potential-based reward shaping (PBRS), velocity penalties, and stability bonuses. A big part of this is watching for reward hacking, where the agent finds a way to score well without actually landing.

**Live communication.** The Python simulation talks to the frontend over WebSockets. It sends observations, chosen actions, rewards, and episode status, and the dashboard shows the latest state. When the frontend is connected to the backend, the Python environment is the source of truth.

**3D visualization.** The scene is built with Three.js. It shows the lander, the landing area, and the engine effects, and it follows the simulation state with orbit and chase camera views.

**Dashboard.** The HUD has a glass-style look and shows position, velocity, orientation, touchdown info, episode reward, and performance history. There are also views for training analytics and the reward experiments.

One thing worth saying clearly: the 3D scene only visualizes what the simulation reports. It is not a physics engine of its own.

---

## Tech Stack

| Technology | What I use it for |
|---|---|
| Python | RL backend and simulation |
| Gymnasium | RL environment API |
| LunarLander-v3 | The landing task |
| Box2D | Physics behind LunarLander |
| Stable-Baselines3 | PPO training and inference |
| PyTorch | Neural network computation |
| FastAPI | HTTP API and WebSocket server |
| WebSockets | Backend to frontend communication |
| React | Frontend UI |
| TypeScript | Typed frontend code |
| Three.js | 3D rendering |
| Vite | Dev server and build tool |
| Tailwind CSS | Styling |
| ONNX / JSON | Exported policies for browser-side inference |

---

## How It Is Put Together

The project has two main halves: a Python RL backend and a React frontend with a Three.js scene.

```text
                 ORBITALPILOT
                       |
          +------------+------------+
          |                         |
   Python RL Backend          React Frontend
          |                         |
   Gymnasium Environment       Three.js Scene
          |                         |
   LunarLander-v3              3D Lander and Terrain
          |
   PPO Policy
          |
   State, Action, Reward
          |
   WebSocket Communication
          |
   Live Telemetry and HUD
```

**Backend.** Runs the environment, loads or trains policies, and sends simulation data to the frontend.

**Frontend.** Renders the 3D scene, shows telemetry, and handles user controls.

**Communication.** The two sides exchange structured messages over a WebSocket.

A heads up on the browser-side fallback model: it is a separate inference implementation. Its predictions and numerical integration will not match the original Python model and Box2D physics exactly.

---

## How It Works

The loop is the usual RL one:

1. **Observe.** The agent reads the current state of the lander.
2. **Act.** The PPO policy picks one of the discrete actions.
3. **Simulate.** Gymnasium steps the environment with that action.
4. **Reward.** The environment scores the outcome.
5. **Learn.** During training, PPO uses the collected experience to update the policy.
6. **Visualize.** Observations and episode info are streamed to the frontend.
7. **Evaluate.** The trained policy is tested on fresh episodes.

### Observation space

`LunarLander-v3` gives eight observations:

| Index | Observation | Meaning |
|---:|---|---|
| 0 | Horizontal position | Position along the x axis |
| 1 | Vertical position | Position along the y axis |
| 2 | Horizontal velocity | Speed along x |
| 3 | Vertical velocity | Speed along y |
| 4 | Angle | Orientation of the lander |
| 5 | Angular velocity | Rotation rate |
| 6 | Left-leg contact | Whether the left leg is touching the ground |
| 7 | Right-leg contact | Whether the right leg is touching the ground |

### Action space

The discrete version has four actions:

| Action | Meaning |
|---:|---|
| 0 | Do nothing |
| 1 | Fire the left orientation engine |
| 2 | Fire the main engine |
| 3 | Fire the right orientation engine |

---

## Project Structure

```text
OrbitalPilot/
├── frontend/
│   ├── public/
│   │   └── models/                 # Exported policy assets
│   ├── src/
│   │   ├── components/             # HUD, interface, and 3D components
│   │   ├── services/               # WebSocket and inference services
│   │   └── types/                  # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── models/                         # Trained model checkpoints
├── videos/                         # Recorded demos
├── train_lander.py                 # PPO training
├── evaluate_lander.py              # Policy evaluation
├── reward_experiments.py           # Reward shaping experiments
├── export_weights.py               # Policy weight export
├── export_onnx.py                  # ONNX export
├── ws_server.py                    # WebSocket server
├── requirements.txt
├── .gitignore
└── README.md
```

| File | What it does |
|---|---|
| `train_lander.py` | Creates and trains the PPO policy |
| `evaluate_lander.py` | Evaluates a trained policy |
| `reward_experiments.py` | Runs alternative reward strategies |
| `ws_server.py` | Streams simulation data to connected clients |
| `export_weights.py` | Exports policy parameters |
| `export_onnx.py` | Exports a model to ONNX |
| `frontend/` | The 3D dashboard and interface |
| `models/` | Trained model checkpoints |

---

## Getting Started

### What you need

- Python 3.12
- Node.js and npm
- Git
- SWIG on macOS, needed to build the Box2D dependency
- A modern browser for the Three.js interface

Check your versions:

```bash
python3 --version
node --version
npm --version
```

### 1. Clone the repo

```bash
git clone https://github.com/nishatkh/OrbitalPilot.git
cd OrbitalPilot
```

### 2. Install SWIG (macOS)

```bash
brew install swig
swig -version
```

### 3. Create a virtual environment

```bash
python3.12 -m venv .venv
```

Activate it.

Fish:

```fish
source .venv/bin/activate.fish
```

Bash or Zsh:

```bash
source .venv/bin/activate
```

### 4. Install backend dependencies

```bash
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
```

If you only want the core RL packages:

```bash
python -m pip install "gymnasium[box2d]" stable-baselines3
```

For the WebSocket server:

```bash
python -m pip install fastapi "uvicorn[standard]"
```

Make sure you install everything inside the active virtual environment.

### 5. Check that everything works

```bash
python -c "import gymnasium as gym; import Box2D; import torch; from stable_baselines3 import PPO; env = gym.make('LunarLander-v3'); obs, info = env.reset(); print('Observation shape:', obs.shape); print('Action space:', env.action_space); env.close()"
```

You should see an observation shape of `(8,)` and a discrete action space with four actions.

### 6. Start the backend

```bash
python ws_server.py
```

Or, if you run it as an ASGI app:

```bash
uvicorn ws_server:app --reload
```

Only use the `uvicorn` command if `ws_server.py` exposes an app called `app`.

### 7. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints. It is usually `http://localhost:5173`, but yours might use a different port. If the frontend cannot reach the backend, check the WebSocket URL, the ports, and the browser console.

---

## Controls

| Key | Action |
|---|---|
| `W` / `Up Arrow` | Main engine |
| `A` / `Left Arrow` | Left orientation engine |
| `D` / `Right Arrow` | Right orientation engine |
| `S` / `Down Arrow` | Engines off |
| `Space` | Reset the episode |
| `P` | Pause or resume |

---

## Training and Evaluation

### Train the agent

```bash
python train_lander.py
```

This sets up the environment, configures PPO, trains, and saves the policy. Training time and the output path depend on the settings in the script.

### Evaluate a model

```bash
python evaluate_lander.py
```

I run each policy over many episodes and track:

- Mean episode reward
- Standard deviation of rewards
- Successful landing rate
- Crash rate
- Episode length

I keep the evaluation conditions the same when comparing models, otherwise the numbers are not comparable.

### Run the reward experiments

```bash
python reward_experiments.py
```

This compares the baseline reward against my custom shaping strategies.

### Benchmark

The commonly used target for LunarLander is an average return of about **200 or higher over 100 evaluation episodes**. That is a reference number from the community, not a result I am claiming for OrbitalPilot.

---

## Reward Shaping Experiments

Reward shaping changes the feedback the agent gets so learning is easier to guide. This is the part of the project I care most about, because the gap between a high reward and a real landing is where things get interesting.

**Baseline.** The original Gymnasium reward, used as the reference for everything else.

**Custom shaping.** I try rewards that encourage controlled descent, low horizontal velocity, less rotation, and a stable touchdown. The risk is that extra rewards create unintended incentives. An agent can learn to hover and collect an intermediate reward instead of landing.

**Potential-based shaping.** The standard form is:

$$F(s, s') = \gamma \Phi(s') - \Phi(s)$$

where:

- $s$ is the current state
- $s'$ is the next state
- $\gamma$ is the discount factor
- $\Phi$ is a potential function over states
- $F$ is the shaping reward

Under the right assumptions, this kind of shaping keeps the optimal policy the same while still giving the agent extra guidance.

For a fair comparison, I evaluate every policy on the original environment reward, and I report the setup, the number of episodes, and the measured results.

---

## Troubleshooting

**Gymnasium cannot be imported.** Activate the virtual environment and reinstall:

```bash
python -m pip install -r requirements.txt
```

**SWIG or Box2D fails to install.** On macOS, run `brew install swig`. If it still fails, check your Python version and the versions of Gymnasium and its Box2D dependencies.

**Model checkpoint not found.** Make sure training finished and that the model path in the evaluation or WebSocket script matches the saved file.

**Frontend cannot connect to the backend.**

1. Check that the Python server is running.
2. Check that the frontend uses the right WebSocket URL.
3. Check that the ports match.
4. Look for connection or protocol errors in the browser console.
5. Make sure the backend sends messages in the format the frontend expects.

---

## Author

**Nishat Khan**

GitHub: [@nishatkh](https://github.com/nishatkh)

Repository: [OrbitalPilot](https://github.com/nishatkh/OrbitalPilot)

---

OrbitalPilot is an experimental project. I want it to make training and evaluating a landing agent easier to understand, both through the numbers and by actually watching it fly.
