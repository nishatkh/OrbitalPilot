# OrbitalPilot

**An AI-powered spacecraft landing simulation built with reinforcement learning, real-time telemetry, and interactive 3D visualization.**

OrbitalPilot explores autonomous spacecraft control using Proximal Policy Optimization (PPO), Gymnasium's LunarLander-v3 environment, and Stable-Baselines3. It combines reinforcement-learning experiments with a Three.js and React dashboard designed to visualize spacecraft movement, flight telemetry, and agent performance.

The project brings together reinforcement learning, reward engineering, Python-based simulation, real-time communication, and 3D frontend development in one experimental platform.

> **Project scope:** The learning environment is a simulated lunar lander. The booster-style 3D model and aerospace dashboard are visualization elements, not a validated physical model of a real rocket or space shuttle.

---

## Table of Contents

- [Demo Video](#demo-video)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Controls](#controls)
- [Training and Evaluation](#training-and-evaluation)
- [Reward Shaping Experiments](#reward-shaping-experiments)
- [Performance Results](#performance-results)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---
<div align="center">
  <img src="https://i.postimg.cc/jj5V03YG/image.png" alt="OrbitalPilot 3D spacecraft simulation dashboard" width="100%" />
  <p><em>Interactive 3D spacecraft simulation with live telemetry, AI flight control, and an aerospace-inspired HUD.</em></p>
</div>
---

## Features

### 1. Reinforcement Learning with PPO

- Train an autonomous agent using Proximal Policy Optimization.
- Use Gymnasium's `LunarLander-v3` environment.
- Save and reload trained Stable-Baselines3 policies.
- Evaluate model performance across multiple episodes.

### 2. Reward Shaping and Experimentation

- Compare a baseline PPO agent with custom reward strategies.
- Investigate potential-based reward shaping (PBRS).
- Study the effects of velocity penalties and stability incentives.
- Examine reward hacking, where an agent maximizes a reward without properly completing the intended task.

### 3. Real-Time Simulation Communication

- Connect the Python simulation to the frontend using WebSockets.
- Stream state observations, selected actions, rewards, and episode status.
- Display the latest simulation state in the dashboard.
- Support a client-side fallback where implemented.

The Python environment should remain the source of truth whenever the frontend is connected to the Gymnasium simulation.

### 4. Interactive 3D Visualization

- Render a spacecraft-inspired 3D model using Three.js.
- Visualize the lander, landing area, and engine effects.
- Provide orbital and chase-camera views where implemented.
- Display movement and orientation based on simulation telemetry.

The 3D scene is a visualization of the simulation state. It should not be interpreted as a physically validated spacecraft dynamics model.

### 5. Aerospace-Inspired Dashboard

- Glassmorphic heads-up display (HUD).
- Position, velocity, orientation, and touchdown telemetry.
- Episode reward and performance history.
- Training analytics and reward-shaping experiment views.
- Manual control and simulation playback options where implemented.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Python | Reinforcement-learning backend and simulation integration |
| Gymnasium | Reinforcement-learning environment API |
| LunarLander-v3 | Simulated lunar landing task |
| Box2D | Physics engine used by the LunarLander environment |
| Stable-Baselines3 | PPO model training and inference |
| PyTorch | Neural-network computation |
| FastAPI | Optional HTTP API and WebSocket application framework |
| WebSockets | Real-time communication between backend and frontend |
| React | Frontend user interface |
| TypeScript | Type-safe frontend development |
| Three.js | 3D rendering and visualization |
| Vite | Frontend development server and build tool |
| Tailwind CSS | Interface styling, if configured |
| ONNX / JSON | Optional exported policy formats for browser-side inference |

Actual dependencies and supported features should match the implementation in the repository and its dependency files.

---

## System Architecture

OrbitalPilot is organized around a Python reinforcement-learning environment and a 3D web interface.

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

### Backend

The backend manages the reinforcement-learning environment, loads or trains policies, and provides simulation information to the frontend.

### Frontend

The frontend renders the 3D scene, presents telemetry, and provides controls for interacting with the simulation.

### Communication

When a WebSocket server is used, the frontend and backend exchange structured messages. The implementation should define the message format, connection status, update frequency, and handling of resets or disconnections.

**Important:** A browser-side fallback model is a separate inference implementation. Its predictions and numerical integration should not be assumed to reproduce the original Python model and Box2D physics exactly.

---

## How It Works

OrbitalPilot follows a reinforcement-learning workflow.

1. **Observe:** The agent receives the current state of the lander.
2. **Select an action:** The PPO policy chooses one of the available discrete actions.
3. **Simulate:** Gymnasium advances the environment and applies the action.
4. **Calculate reward:** The environment evaluates the outcome of the action.
5. **Learn:** During training, PPO uses collected experience to update the policy.
6. **Visualize:** Simulation observations and episode information can be streamed to the frontend.
7. **Evaluate:** The trained policy is tested on episodes that were not used for the current training update.

### Observation Space

`LunarLander-v3` provides eight observations:

| Index | Observation | Description |
|---:|---|---|
| 0 | Horizontal position | Position along the horizontal axis |
| 1 | Vertical position | Position along the vertical axis |
| 2 | Horizontal velocity | Horizontal movement speed |
| 3 | Vertical velocity | Vertical movement speed |
| 4 | Angle | Lander orientation |
| 5 | Angular velocity | Rate of rotation |
| 6 | Left-leg contact | Whether the left landing leg is in contact |
| 7 | Right-leg contact | Whether the right landing leg is in contact |

These values help the agent determine its movement, orientation, and landing state.

### Action Space

The standard discrete LunarLander action space has four actions:

| Action | Description |
|---:|---|
| 0 | Do nothing |
| 1 | Fire the left orientation engine |
| 2 | Fire the main engine |
| 3 | Fire the right orientation engine |

The agent learns a policy for choosing actions that lead to better landing outcomes.

---

## Project Structure

The following illustrates the intended organization. Keep only files and features that exist in the actual repository.

```text
OrbitalPilot/
├── frontend/
│   ├── public/
│   │   └── models/                 # Exported policy assets, if available
│   ├── src/
│   │   ├── components/             # HUD, interface, and 3D components
│   │   ├── services/               # WebSocket and inference services
│   │   └── types/                  # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── models/                         # Trained model checkpoints
├── videos/                         # Recorded demonstrations
├── train_lander.py                 # PPO training
├── evaluate_lander.py              # Policy evaluation
├── reward_experiments.py            # Reward-shaping experiments
├── export_weights.py               # Policy weight export, if implemented
├── export_onnx.py                  # ONNX export, if implemented
├── ws_server.py                    # WebSocket server, if implemented
├── requirements.txt
├── .gitignore
└── README.md
```

### Main Components

| Component | Responsibility |
|---|---|
| `train_lander.py` | Creates and trains the PPO policy |
| `evaluate_lander.py` | Evaluates a trained policy |
| `reward_experiments.py` | Runs alternative reward strategies |
| `ws_server.py` | Streams simulation data to connected clients |
| `export_weights.py` | Exports supported policy parameters |
| `export_onnx.py` | Exports a model to ONNX where supported |
| `frontend/` | Contains the 3D dashboard and interface |
| `models/` | Stores trained model checkpoints |

Script names, model formats, and output paths may vary depending on the current implementation.

---

## Prerequisites

Install the following before running the project:

- Python 3.12 recommended for the dependency setup described below.
- Node.js and npm for the frontend.
- Git.
- SWIG on macOS if required to build the Box2D Python dependency.
- A supported browser for the Three.js interface.

Check the installed versions:

```bash
python3 --version
node --version
npm --version
```

---

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/nishatkh/OrbitalPilot.git
cd OrbitalPilot
```

### 2. Install SWIG on macOS

If SWIG is not already installed:

```bash
brew install swig
```

Verify the installation:

```bash
swig -version
```

### 3. Create a Python Virtual Environment

Using Python 3.12:

```bash
python3.12 -m venv .venv
```

Activate the environment.

**Fish shell:**

```fish
source .venv/bin/activate.fish
```

**Bash or Zsh:**

```bash
source .venv/bin/activate
```

### 4. Install Backend Dependencies

Upgrade the packaging tools:

```bash
python -m pip install --upgrade pip setuptools wheel
```

Install the dependencies defined by the repository:

```bash
python -m pip install -r requirements.txt
```

If you are setting up the environment before a `requirements.txt` has been prepared, install the core reinforcement-learning dependencies:

```bash
python -m pip install "gymnasium[box2d]" stable-baselines3
```

If the project uses FastAPI and a WebSocket server, ensure the appropriate packages are included in the dependency file. For example:

```bash
python -m pip install fastapi "uvicorn[standard]"
```

Install dependencies in the active virtual environment, not in a different Python installation.

### 5. Verify the Environment

```bash
python -c "import gymnasium as gym; import Box2D; import torch; from stable_baselines3 import PPO; env = gym.make('LunarLander-v3'); obs, info = env.reset(); print('Observation shape:', obs.shape); print('Action space:', env.action_space); env.close()"
```

The expected observation shape is `(8,)`, and the standard discrete action space contains four actions.

### 6. Start the Backend

If the repository includes `ws_server.py`:

```bash
python ws_server.py
```

Use the host and port configured by the server. Confirm that the backend is running before opening a frontend that depends on it.

If the server is implemented as a FastAPI application with an ASGI entry point, it may instead be started with a command such as:

```bash
uvicorn ws_server:app --reload
```

Use this alternative only if `ws_server.py` exposes an ASGI application named `app` and supports that launch method.

### 7. Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite in the terminal. The default Vite development port is commonly `5173`, but your project configuration may use a different port, such as `3000`.

If the frontend cannot connect to the backend, check the configured WebSocket URL, server port, and browser console.

---

## Controls

The following controls describe the intended interface. Keyboard behavior depends on the frontend implementation.

| Key | Intended action |
|---|---|
| `W` / `Up Arrow` | Main engine |
| `A` / `Left Arrow` | Left orientation control |
| `D` / `Right Arrow` | Right orientation control |
| `S` / `Down Arrow` | Idle engines |
| `Space` | Reset the episode |
| `P` | Pause or resume |

**Control mapping note:** The Gymnasium action space uses discrete actions, while the frontend may expose keyboard commands. The mapping must be implemented explicitly. For accurate behavior, manual commands should be translated into supported environment actions rather than assumed to correspond directly to real spacecraft controls.

---

## Training and Evaluation

### Train the PPO Agent

From the repository root:

```bash
python train_lander.py
```

The script should initialize the environment, configure PPO, run training, and save the trained policy.

The training duration and output location depend on the script's configuration.

### Evaluate a Trained Model

```bash
python evaluate_lander.py
```

Evaluate policies across multiple episodes and record:

- Mean episode reward.
- Standard deviation of rewards.
- Successful landing rate.
- Crash rate.
- Episode length.

Use consistent evaluation conditions when comparing different models.

### Run Reward Experiments

```bash
python reward_experiments.py
```

This script can be used to compare the baseline reward with custom reward-shaping strategies, provided those experiments are implemented in the file.

### Benchmark Reference

An average return of approximately **200 or higher over 100 evaluation episodes** is a commonly used LunarLander benchmark. It is a reference target, not a verified result for OrbitalPilot.

---

## Reward Shaping Experiments

Reward shaping changes the feedback received by an agent to help guide learning.

OrbitalPilot investigates the relationship between reward design, learning behavior, and actual landing success.

### Baseline Reward

The baseline experiment uses the original reward provided by Gymnasium's LunarLander environment. It provides a reference for evaluating custom approaches.

### Custom Reward Shaping

Custom rewards may encourage behaviors such as controlled descent, lower horizontal velocity, reduced rotation, or stable touchdown.

However, additional rewards can introduce unintended incentives. For example, an agent may learn to hover or optimize an intermediate reward rather than complete a landing.

### Potential-Based Reward Shaping

A common potential-based shaping function is:

\[
F(s,s')=\gamma\Phi(s')-\Phi(s)
\]

Where:

- \(s\) is the current state.
- \(s'\) is the next state.
- \(\gamma\) is the discount factor.
- \(\Phi\) is a state-potential function.
- \(F\) is the shaping reward.

Under appropriate assumptions, potential-based reward shaping preserves the optimal policy while providing additional learning guidance.

To make a fair comparison, evaluate all policies using the original environment reward, and report the evaluation setup, number of episodes, and measured results.

---

## Performance Results

Add measured results here after completing the training and evaluation runs.

| Experiment | Mean Reward | Reward Standard Deviation | Landing Success Rate |
|---|---:|---:|---:|
| Baseline PPO | Not measured | Not measured | Not measured |
| Custom Reward | Not measured | Not measured | Not measured |
| Potential-Based Shaping | Not measured | Not measured | Not measured |

Do not interpret training reward alone as proof of better performance. Report landing success, failures, and evaluation conditions alongside reward statistics.

If a model reaches an average reward above 230, include the result only after verifying it through the evaluation script. Ideally, report the number of episodes, random seeds, and model checkpoint used.

---

## Troubleshooting

### Gymnasium Cannot Be Imported

Activate the virtual environment and install the backend dependencies:

```bash
python -m pip install -r requirements.txt
```

### SWIG or Box2D Installation Fails

On macOS, install SWIG:

```bash
brew install swig
```

If installation still fails, check Python compatibility and the versions of Gymnasium and its Box2D dependencies.

### Model Checkpoint Not Found

Verify that training completed and that the model path in the evaluation or WebSocket script matches the saved checkpoint.

### Frontend Cannot Connect to the Backend

Check the following:

1. The Python server is running.
2. The frontend uses the correct WebSocket URL.
3. The server and frontend ports are correct.
4. The browser console contains no connection or protocol errors.
5. The backend sends messages in the format expected by the frontend.

### 3D Scene Does Not Match the Simulation

Confirm that the frontend uses the latest backend telemetry for position and orientation. Check coordinate conversions, units, axis directions, and update timing.

The frontend's local fallback should be treated as a separate simulation unless its behavior has been validated against the Python environment.

---

## Roadmap

Potential future improvements include:

- More reliable evaluation across multiple random seeds.
- Better analysis of reward hacking and policy behavior.
- Persistent training metrics and experiment history.
- Improved real-time telemetry and WebSocket reconnection.
- Synchronized 3D playback and episode replay.
- Exported policies for browser-side inference.
- Automated tests for the backend, model loading, and frontend communication.
- Reproducible training configurations and saved checkpoints.

Roadmap items should be marked as completed only when they are implemented and tested.

---

## License

This project is intended to use the MIT License.

Before distributing it, add a `LICENSE` file containing the full MIT License text and the appropriate copyright holder and year.

---

## Author

**Nishat Khan**

GitHub: [@nishatkh](https://github.com/nishatkh)

Repository: [OrbitalPilot](https://github.com/nishatkh/OrbitalPilot)

---

OrbitalPilot is an experimental project exploring reinforcement learning, reward engineering, simulation telemetry, and interactive 3D visualization. Its goal is to make the process of training and evaluating an autonomous landing agent easier to understand through both quantitative results and visual feedback.
