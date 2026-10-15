
import gymnasium as gym
import numpy as np
from stable_baselines3 import PPO

models = [
    "baseline",
    "hover",
    "shaped",
]

# IMPORTANT: use the original, unmodified reward
env = gym.make("LunarLander-v3")

for name in models:
    model = PPO.load(f"models/ppo_{name}")

    scores = []

    for episode in range(20):
        obs, info = env.reset(seed=1000 + episode)
        total_reward = 0.0

        while True:
            action, _ = model.predict(
                obs,
                deterministic=True,
            )

            obs, reward, terminated, truncated, info = (
                env.step(action)
            )

            total_reward += float(reward)

            if terminated or truncated:
                break

        scores.append(total_reward)

    print(f"\nModel: {name}")
    print(f"Mean score: {np.mean(scores):.2f}")
    print(f"Standard deviation: {np.std(scores):.2f}")
    print(f"Successful episodes (score >= 200): "
          f"{sum(s >= 200 for s in scores)}/20")

env.close()
