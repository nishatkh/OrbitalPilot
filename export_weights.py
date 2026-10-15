"""
Export trained SB3 PPO actor weights to JSON for sync browser inference.
The frontend's trainedPolicy.ts does the exact same forward pass as
play_lander.py's `model.predict(obs, deterministic=True)`:
  obs(8) -> Linear(8,64) -> Tanh -> Linear(64,64) -> Tanh -> Linear(64,4) -> argmax
Output: frontend/public/models/ppo_{name}.json
"""
import json
import os
import numpy as np
from stable_baselines3 import PPO

MODELS = ["lander", "baseline", "shaped", "hover"]
OUT_DIR = "frontend/public/models"


def export_one(name):
    src = f"models/ppo_{name}.zip"
    if not os.path.exists(src):
        print(f"[skip] {src} not found")
        return False
    os.makedirs(OUT_DIR, exist_ok=True)
    dst = os.path.join(OUT_DIR, f"ppo_{name}.json")

    model = PPO.load(src)
    policy = model.policy
    sd = policy.state_dict()

    # SB3 MlpPolicy actor keys:
    #   mlp_extractor.policy_net.0.weight/bias  (8->64)
    #   mlp_extractor.policy_net.2.weight/bias  (64->64)
    #   action_net.weight/bias                  (64->4)
    def t(key):
        return sd[key].detach().cpu().numpy().tolist()

    data = {
        "model": name,
        "obs_dim": 8,
        "action_dim": 4,
        "w1": t("mlp_extractor.policy_net.0.weight"),
        "b1": t("mlp_extractor.policy_net.0.bias"),
        "w2": t("mlp_extractor.policy_net.2.weight"),
        "b2": t("mlp_extractor.policy_net.2.bias"),
        "w3": t("action_net.weight"),
        "b3": t("action_net.bias"),
    }
    with open(dst, "w") as f:
        json.dump(data, f)

    # Verify: replicate forward pass in numpy, compare argmax vs SB3
    w1 = np.array(data["w1"], dtype=np.float64)
    b1 = np.array(data["b1"], dtype=np.float64)
    w2 = np.array(data["w2"], dtype=np.float64)
    b2 = np.array(data["b2"], dtype=np.float64)
    w3 = np.array(data["w3"], dtype=np.float64)
    b3 = np.array(data["b3"], dtype=np.float64)

    def predict(obs):
        h = np.tanh(w1 @ obs + b1)
        h = np.tanh(w2 @ h + b2)
        logits = w3 @ h + b3
        return int(np.argmax(logits))

    rng = np.random.RandomState(0)
    mismatches = 0
    for i in range(200):
        obs = rng.randn(8).astype(np.float64)
        obs[1] = abs(obs[1])  # altitude non-negative-ish
        sb3_a, _ = model.predict(obs.astype(np.float32), deterministic=True)
        if predict(obs) != int(sb3_a):
            mismatches += 1
    size = os.path.getsize(dst) / 1024
    print(f"[ok] {src} -> {dst} ({size:.1f} KB) mismatches={mismatches}/200")
    return mismatches == 0


if __name__ == "__main__":
    ok = 0
    for name in MODELS:
        if export_one(name):
            ok += 1
    print(f"\nExported {ok}/{len(MODELS)} weight files to {OUT_DIR}/")
