
import os
import gymnasium as gym
import numpy as np
from gymnasium import Wrapper
from stable_baselines3 import PPO

os.makedirs("models", exist_ok=True)
os.makedirs("logs", exist_ok=True)


class RewardExperiment(Wrapper):
    def __init__(self, env, mode="baseline", gamma=0.99):
        super().__init__(env)
        self.mode = mode
        self.gamma = gamma
        self.previous_potential = None

    def potential(self, obs):
        # Observation:
        # x, y, vx, vy, angle, angular_velocity, left_leg, right_leg
        x, y, vx, vy, angle, angular_velocity, _, _ = obs

        # Lower is worse; closer to a stable landing state is better.
        return -(
            1.0 * abs(x)
            + 0.5 * abs(vx)
            + 0.5 * abs(vy)
            + 0.3 * abs(angle)
            + 0.2 * abs(angular_velocity)
            + 0.1 * max(y, 0.0)
        )

    def reset(self, **kwargs):
        obs, info = self.env.reset(**kwargs)
        self.previous_potential = self.potential(obs)
        return obs, info

    def step(self, action):
        obs, reward, terminated, truncated, info = (
            self.env.step(action)
        )

        if self.mode == "hover":
            x, y, vx, vy, angle, angular_velocity, left, right = obs

            # Intentionally flawed objective:
            # pay repeatedly for hovering in a stable state.
            hovering = (
                y > 0.2
                and abs(vx) < 0.1
                and abs(vy) < 0.1
                and abs(angle) < 0.1
                and abs(angular_velocity) < 0.1
                and not (left and right)
            )

            if hovering:
                reward += 1.0

        elif self.mode == "shaped":
            current_potential = self.potential(obs)

            # Stop potential shaping at episode boundaries.
            next_potential = (
                0.0 if terminated or truncated
                else current_potential
            )

            reward += 0.1 * (
                self.gamma * next_potential
                - self.previous_potential
            )

            # Small cost for each step taken.
            reward -= 0.01

            self.previous_potential = (
                0.0 if terminated or truncated
                else current_potential
            )

        return obs, reward, terminated, truncated, info


def train(mode, timesteps=300_000):
    env = RewardExperiment(
        gym.make("LunarLander-v3"),
        mode=mode,
    )

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

    model.learn(total_timesteps=timesteps)
    model.save(f"models/ppo_{mode}")
    env.close()

    print(f"Saved models/ppo_{mode}.zip")


if __name__ == "__main__":
    for mode in ["baseline", "hover", "shaped"]:
        print(f"\n--- Training mode: {mode} ---")
        train(mode)
