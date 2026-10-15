
import gymnasium as gym

env = gym.make("LunarLander-v3", render_mode="human")

observation, info = env.reset(seed=42)

print("Observation:", observation)
print("Observation shape:", observation.shape)
print("Possible actions:", env.action_space)

for step in range(1000):
    action = env.action_space.sample()

    observation, reward, terminated, truncated, info = env.step(action)

    print(
        f"Step: {step}, "
        f"Action: {action}, "
        f"Reward: {reward:.2f}"
    )

    if terminated or truncated:
        print("Episode finished. Restarting...")
        observation, info = env.reset()

env.close()
