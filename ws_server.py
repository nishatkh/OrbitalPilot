"""
Rocket-AI WebSocket Server (Production)
========================================
Streams LunarLander-v3 simulation state to the Three.js frontend.
Uses the trained PPO models directly — same as play_lander.py.
"""

import asyncio, csv, json, math, os, sys, time
import numpy as np
import websockets
from stable_baselines3 import PPO
import gymnasium as gym

HOST = "0.0.0.0"
PORT = 8765
ALL_MODELS = ["lander", "baseline", "shaped", "hover"]

# ── State ────────────────────────────────────────────────────────────────────
class SimState:
    def __init__(self):
        self.paused    = False
        self.speed     = 1.0   # multiplier
        self.model     = "lander"
        self.mode      = "ai"  # "ai" | "random"
        self.ep        = 0
        self.step      = 0
        self.total     = 0.0
        self.streak    = 0
        self.best      = None
        self.history   = []
        self.clients   = set()
        self.env       = None
        self.model_obj = None
        self.obs       = np.zeros(8)
        self.done_flag = True

state = SimState()

def load_model(name):
    p = f"models/ppo_{name}.zip"
    if os.path.exists(p):
        print(f"[server] Loading {p}...")
        return PPO.load(p)
    print(f"[server] Model file not found: {p}")
    return None

def load_training_curve():
    path = "logs/training.csv.monitor.csv"
    R, T = [], []
    if not os.path.exists(path):
        return R, T
    try:
        with open(path) as f:
            for l in f:
                if l.startswith("#"): continue
                break
            ts = 0
            for row in csv.DictReader(f, fieldnames=["r","l","t"]):
                try:
                    ts += int(row["l"])
                    R.append(float(row["r"]))
                    T.append(ts)
                except:
                    pass
    except Exception as e:
        print("[server] Error loading training curve:", e)
    return R, T

async def broadcast(msg: dict):
    if not state.clients:
        return
    data = json.dumps(msg)
    dead = set()
    for ws in list(state.clients):
        try:
            await ws.send(data)
        except Exception:
            dead.add(ws)
    for ws in dead:
        state.clients.discard(ws)

# ── Simulation loop ───────────────────────────────────────────────────────────
async def sim_loop():
    print("[sim] Initializing LunarLander-v3 environment...")
    state.env = gym.make("LunarLander-v3")
    state.model_obj = load_model(state.model)
    print("[sim] Simulation loop active.")

    # Broadcast throttle: cap at ~30 Hz to avoid flooding the browser
    last_send = 0.0
    MIN_SEND_INTERVAL = 1.0 / 30.0

    while True:
        # Fixed 50 Hz base timestep like the real env
        delay = max(0.005, 1.0 / (50.0 * max(0.2, state.speed)))
        await asyncio.sleep(delay)

        if state.paused:
            continue

        # Reset episode if finished
        if state.done_flag:
            state.done_flag = False
            state.ep += 1
            state.step = 0
            state.total = 0.0
            obs, _ = state.env.reset(seed=state.ep + 100)
            state.obs = obs

        obs = state.obs

        # Agent decision — use trained policy DIRECTLY like play_lander.py
        if state.mode == "ai" and state.model_obj is not None:
            action, _ = state.model_obj.predict(obs, deterministic=True)
            action = int(action)
        else:
            action = int(state.env.action_space.sample())

        obs_next, reward, terminated, truncated, _ = state.env.step(action)
        state.obs = obs_next
        state.total += float(reward)
        state.step += 1

        done = terminated or truncated
        # Solved landing: total score >= 200, terminal reward >= 100, or leg contact with positive score
        landed  = done and (state.total >= 200 or float(reward) >= 100 or ((obs_next[6] or obs_next[7]) and state.total > 80))
        crashed = done and not landed

        # Throttled broadcast (always send final step of an episode)
        now = time.monotonic()
        if done or (now - last_send) >= MIN_SEND_INTERVAL:
            last_send = now
            await broadcast({
                "type":    "state",
                "obs":     obs_next.tolist(),
                "action":  action,
                "reward":  float(reward),
                "total":   float(state.total),
                "step":    int(state.step),
                "ep":      int(state.ep),
                "done":    bool(done),
                "crashed": bool(crashed),
                "landed":  bool(landed),
                "model":   str(state.model),
                "mode":    str(state.mode),
            })

        if done:
            sc = float(state.total)
            state.history.append(sc)
            if state.best is None or sc > state.best:
                state.best = sc
            state.streak = state.streak + 1 if sc >= 200 else 0
            state.done_flag = True

            status = "✓ LANDED" if landed else "✗ CRASH"
            print(f"  [Ep {state.ep:3d}] [{state.model:8s}] {status}  score={sc:+7.1f} steps={state.step} streak={state.streak}")
            await broadcast({
                "type":    "episode_end",
                "score":   sc,
                "steps":   state.step,
                "ep":      state.ep,
                "streak":  state.streak,
                "best":    state.best,
                "history": state.history[-50:],
            })

# ── Client connection handler ─────────────────────────────────────────────────
async def handler(ws):
    state.clients.add(ws)
    print(f"[server] Client connected ({len(state.clients)} active)")

    # Send initial datasets
    R, T = load_training_curve()
    try:
        await ws.send(json.dumps({
            "type": "training_curve",
            "rewards": R,
            "timesteps": T,
        }))
    except Exception:
        pass

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                cmd = msg.get("cmd", "")

                if cmd == "reset":
                    state.done_flag = True

                elif cmd == "pause":
                    state.paused = True

                elif cmd == "resume":
                    state.paused = False

                elif cmd == "set_model":
                    name = msg.get("model", "lander")
                    if name in ALL_MODELS:
                        state.model = name
                        state.model_obj = load_model(name)
                        state.done_flag = True
                        await ws.send(json.dumps({"type": "model_loaded", "model": name}))

                elif cmd == "set_speed":
                    state.speed = max(0.25, min(10.0, float(msg.get("speed", 1.0))))

                elif cmd == "set_mode":
                    state.mode = msg.get("mode", "ai")

                elif cmd == "get_training_curve":
                    R, T = load_training_curve()
                    await ws.send(json.dumps({"type": "training_curve", "rewards": R, "timesteps": T}))

            except json.JSONDecodeError:
                pass
    except Exception:
        pass
    finally:
        state.clients.discard(ws)
        print(f"[server] Client disconnected ({len(state.clients)} active)")

# ── Main ──────────────────────────────────────────────────────────────────────
async def main():
    print(f"[server] Starting WebSocket server on {HOST}:{PORT}")
    asyncio.create_task(sim_loop())
    async with websockets.serve(handler, HOST, PORT):
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[server] Shutting down.")
