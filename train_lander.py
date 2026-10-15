
import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.monitor import Monitor

# Create folders and record training statistics
import os
os.makedirs("models", exist_ok=True)
os.makedirs("logs", exist_ok=True)

env = gym.make("LunarLander-v3")
env = Monitor(env, filename="logs/training.csv")

# Build the neural-network policy
model = PPO(
    "MlpPolicy",
    env,
    learning_rate=0.0003,
    n_steps=2048,
    batch_size=64,
    gamma=0.99,
    verbose=1,
    seed=42,
)

# Train the AI
model.learn(total_timesteps=300_000)

# Save the trained model
model.save("models/ppo_lander")

env.close()

print("Training complete!")
print("Model saved in models/ppo_lander.zip")
