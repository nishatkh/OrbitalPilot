
import gymnasium as gym
from stable_baselines3 import PPO

env = gym.make(
    "LunarLander-v3",
    render_mode="rgb_array",
)

env = gym.wrappers.RecordVideo(
    env,
    video_folder="videos",
    episode_trigger=lambda episode: True,
    name_prefix="trained-lander",
)

model = PPO.load("models/ppo_lander")

for episode in range(3):
    observation, info = env.reset(seed=200 + episode)

    while True:
        action, _ = model.predict(
            observation,
            deterministic=True,
        )

        observation, reward, terminated, truncated, info = (
            env.step(action)
        )

        if terminated or truncated:
            break

env.close()
print("Videos saved in the videos folder.")
