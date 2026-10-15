"""
Export trained SB3 PPO policies to ONNX for browser inference.
Mirrors play_lander.py: deterministic predict = argmax over action logits.
Output: frontend/public/models/ppo_{name}.onnx
"""
import os
import numpy as np
import torch as th
from stable_baselines3 import PPO

MODELS = ["lander", "baseline", "shaped", "hover"]
OUT_DIR = "frontend/public/models"


class PolicyNet(th.nn.Module):
    """Wraps SB3 MlpPolicy actor -> raw action logits (4 actions)."""

    def __init__(self, sb3_policy):
        super().__init__()
        self.mlp_extractor = sb3_policy.mlp_extractor
        self.action_net = sb3_policy.action_net

    def forward(self, obs):
        # obs: (B, 8) -> SB3 MlpExtractor expects features, policy has no CNN
        # so features == obs
        pi_features = self.mlp_extractor.forward_actor(obs)
        logits = self.action_net(pi_features)
        return logits


def export_one(name):
    src = f"models/ppo_{name}.zip"
    if not os.path.exists(src):
        print(f"[skip] {src} not found")
        return False
    os.makedirs(OUT_DIR, exist_ok=True)
    dst = os.path.join(OUT_DIR, f"ppo_{name}.onnx")

    model = PPO.load(src)
    model.policy.eval()
    wrapper = PolicyNet(model.policy)
    wrapper.eval()

    dummy = th.zeros(1, 8, dtype=th.float32)
    with th.no_grad():
        ref_logits = wrapper(dummy).numpy()[0]
        ref_action = int(np.argmax(ref_logits))
        # Cross-check against SB3 deterministic predict (like play_lander.py)
        sb3_action, _ = model.predict(dummy.numpy()[0], deterministic=True)
        print(f"[{name}] onnx-logits-argmax={ref_action} sb3-deterministic={int(sb3_action)} "
              f"match={ref_action == int(sb3_action)}")

    th.onnx.export(
        wrapper,
        dummy,
        dst,
        input_names=["observation"],
        output_names=["action_logits"],
        dynamic_axes={"observation": {0: "batch"}, "action_logits": {0: "batch"}},
        opset_version=17,
    )
    print(f"[ok] {src} -> {dst}")

    # Verify with onnxruntime
    import onnxruntime as ort
    sess = ort.InferenceSession(dst, providers=["CPUExecutionProvider"])
    test_obs = np.random.randn(2, 8).astype(np.float32)
    with th.no_grad():
        expected = wrapper(th.from_numpy(test_obs)).numpy()
    got = sess.run(None, {"observation": test_obs})[0]
    err = float(np.max(np.abs(expected - got)))
    actions_ok = all(
        int(np.argmax(e)) == int(model.predict(o, deterministic=True)[0])
        for o, e in zip(test_obs, got)
    )
    print(f"[{name}] max-logit-error={err:.2e} argmax-matches-sb3={actions_ok}")
    return True


if __name__ == "__main__":
    ok = 0
    for name in MODELS:
        if export_one(name):
            ok += 1
    print(f"\nExported {ok}/{len(MODELS)} models to {OUT_DIR}/")
