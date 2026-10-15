import { LunarAction, ModelType } from '../types/simulation';

/**
 * Browser port of gymnasium LunarLander-v3 Box2D dynamics.
 *
 * Matches the real env closely enough that the exported PPO weights
 * (services/trainedPolicy.ts, argmax like SB3 predict) fly correctly:
 *  - fixed 50 Hz timestep (gym FPS=50)
 *  - gravity / thrust-weight ratio like Box2D (main barely overcomes
 *    gravity, side engines give torque + small lateral push)
 *  - engine dispersion (Box2D randomises thrust slightly per firing)
 *  - linear + angular damping (air drag / joint friction)
 *  - fuel costs: main -0.3 / side -0.03 per step (gym values)
 *  - shaping + landing/crash bonuses identical to gym
 *  - leg contact + touchdown criteria like the real lander
 */
export class LocalLunarSimulator {
  public obs: [number, number, number, number, number, number, number, number] = [0, 1.4, 0, 0, 0, 0, 0, 0];
  public action: LunarAction = 0;
  public totalReward: number = 0;
  public lastReward: number = 0;
  public stepCount: number = 0;
  public episode: number = 1;
  public done: boolean = false;
  public crashed: boolean = false;
  public landed: boolean = false;

  private prevShaping: number = 0;

  // ── Tuned to Box2D feel (units/s², rad/s²) at dt = 1/50 ──
  private static DT = 1 / 50;
  private static GRAVITY = 1.65;
  private static MAIN_THRUST = 4.1;
  private static SIDE_THRUST_LAT = 0.55; // lateral push from RCS
  private static SIDE_TORQUE = 3.4;
  private static LIN_DAMPING = 0.012; // per-second velocity bleed
  private static ANG_DAMPING = 1.6; // per-second angular bleed
  private static WIND = 0.04; // gentle random drift like Box2D initial force

  constructor() {
    this.reset();
  }

  reset() {
    // Higher, longer flights: spawn ~1.6-1.75 (policy extrapolates fine,
    // shaping still guides it down — gives a proper descent to watch).
    this.obs = [
      (Math.random() - 0.5) * 0.6, // x in ~[-0.3, 0.3]
      1.55 + Math.random() * 0.2, // y
      (Math.random() - 0.5) * 0.4, // vx
      -0.1 - Math.random() * 0.1, // vy (slight descent)
      (Math.random() - 0.5) * 0.3, // angle
      (Math.random() - 0.5) * 0.2, // angularVel
      0.0,
      0.0,
    ];
    this.action = 0;
    this.totalReward = 0;
    this.lastReward = 0;
    this.stepCount = 0;
    this.done = false;
    this.crashed = false;
    this.landed = false;
    this.prevShaping = this.calculateShaping(this.obs);
  }

  private calculateShaping(obs: [number, number, number, number, number, number, number, number]): number {
    const [x, y, vx, vy, angle, , leftLeg, rightLeg] = obs;
    return (
      -100 * Math.sqrt(x * x + y * y) -
      100 * Math.sqrt(vx * vx + vy * vy) -
      100 * Math.abs(angle) +
      10 * leftLeg +
      10 * rightLeg
    );
  }

  // Heuristic PD-controller — FALLBACK ONLY while PPO weights load.
  // Gains tuned for the dynamics above (stable hover + landing).
  getAgentAction(model: ModelType): LunarAction {
    if (model === 'hover') {
      const y = this.obs[1];
      const vy = this.obs[3];
      const angle = this.obs[4];
      // Hold ~0.8 altitude, stay level
      if (Math.abs(angle) > 0.12) return angle < 0 ? 1 : 3;
      if (y < 0.75 || vy < -0.15) return 2;
      if (y > 0.95 && vy > 0.1) return 0;
      return 0;
    }

    const [x, y, vx, vy, angle, angularVel] = this.obs;

    // Desired tilt: lean toward pad + cancel horizontal drift.
    // Positive angle pushes left (ax = -sin(a)*T), so x>0 needs +angle.
    // Action 1 = CCW torque (also brakes CW spin), 3 = CW (brakes CCW spin).
    const targetAngle = Math.max(-0.4, Math.min(0.4, x * 0.6 + vx * 0.9));
    const angleError = targetAngle - angle; // >0 => need to rotate CCW (+)

    // RCS first when misaligned or spinning
    if (angleError > 0.06 || angularVel < -0.25) return 1; // CCW
    if (angleError < -0.06 || angularVel > 0.25) return 3; // CW

    // Descent profile: faster when high, gentle near ground.
    // Final flare under 0.35: bleed off to -0.22 m/s so touchdown is soft.
    const flare = y < 0.35;
    const targetVy = flare
      ? -0.22
      : -Math.min(0.9, Math.max(0.18, y * 0.65 + 0.12));
    const angTol = flare ? 0.2 : 0.35;
    if (vy < targetVy && Math.abs(angle) < angTol) return 2;
    // Emergency burn if plummeting and roughly upright
    if (vy < -0.9 && Math.abs(angle) < 0.5) return 2;

    return 0;
  }

  step(action: LunarAction, _model: ModelType = 'lander'): { reward: number; done: boolean } {
    if (this.done) {
      this.reset();
      this.episode += 1;
    }

    this.action = action;
    this.stepCount += 1;

    let [x, y, vx, vy, angle, angularVel, leftLeg, rightLeg] = this.obs;
    const dt = LocalLunarSimulator.DT;

    let ax = 0;
    let ay = -LocalLunarSimulator.GRAVITY;
    let torque = 0;

    if (action === 2) {
      // Main engine with Box2D-style dispersion (±8%)
      const disp = 1 + (Math.random() - 0.5) * 0.16;
      const T = LocalLunarSimulator.MAIN_THRUST * disp;
      ax += -Math.sin(angle) * T;
      ay += Math.cos(angle) * T;
    } else if (action === 1 || action === 3) {
      const dir = action === 1 ? 1 : -1;
      const disp = 1 + (Math.random() - 0.5) * 0.2;
      torque += dir * LocalLunarSimulator.SIDE_TORQUE * disp;
      // RCS also shoves slightly sideways (like Box2D side force)
      ax += -dir * LocalLunarSimulator.SIDE_THRUST_LAT * disp * Math.cos(angle);
    }

    // Wind drift (tiny, like Box2D initial random force decay)
    ax += (Math.random() - 0.5) * LocalLunarSimulator.WIND;

    // Integrate
    vx += ax * dt;
    vy += ay * dt;
    // Air drag
    vx -= vx * LocalLunarSimulator.LIN_DAMPING * dt;
    vy -= vy * LocalLunarSimulator.LIN_DAMPING * dt * 0.5;
    x += vx * dt;
    y += vy * dt;

    angularVel += torque * dt;
    angularVel -= angularVel * LocalLunarSimulator.ANG_DAMPING * dt;
    // Clamp spin (Box2D bodies can't spin infinitely)
    angularVel = Math.max(-4, Math.min(4, angularVel));
    angle += angularVel * dt;
    // Wrap angle to [-pi, pi]
    if (angle > Math.PI) angle -= 2 * Math.PI;
    if (angle < -Math.PI) angle += 2 * Math.PI;

    // ── Ground contact: legs touch at y=0 (matches gymnasium LunarLander-v3) ──
    const LEG_H = 0.0;
    if (y <= LEG_H) {
      y = LEG_H;
      // Each leg touches if roughly below its side and upright-ish
      const tilt = Math.abs(angle);
      leftLeg = tilt < 0.5 ? 1.0 : 0.0;
      rightLeg = tilt < 0.5 ? 1.0 : 0.0;

      const speed = Math.sqrt(vx * vx + vy * vy);
      const upright = tilt < 0.28;
      const centred = Math.abs(x) < 0.55;
      const gentle = speed < 0.85 && vy > -1.0 && Math.abs(vx) < 0.7 && Math.abs(angularVel) < 1.2;

      if (upright && centred && gentle && leftLeg === 1 && rightLeg === 1) {
        this.landed = true;
        this.done = true;
      } else if (this.stepCount > 20) {
        // Touching ground too hard / sideways / off-pad = crash
        this.crashed = true;
        this.done = true;
      }
      // Kill velocity into ground
      vx *= 0.3;
      vy = 0;
      angularVel *= 0.3;
    } else {
      leftLeg = 0.0;
      rightLeg = 0.0;
    }

    // Out of bounds / timeout like gym (Box2D kills far-away bodies)
    if (Math.abs(x) > 1.6 || y < -0.2 || y > 2.2 || this.stepCount >= 1000) {
      this.done = true;
      if (!this.landed && y <= LEG_H + 0.01) this.crashed = true;
    }

    this.obs = [x, y, vx, vy, angle, angularVel, leftLeg, rightLeg];

    // ── Gym-identical rewards ──
    const shaping = this.calculateShaping(this.obs);
    let reward = shaping - this.prevShaping;
    this.prevShaping = shaping;

    if (action === 2) reward -= 0.3; // gym fuel costs (were 10x too small)
    if (action === 1 || action === 3) reward -= 0.03;

    if (this.landed) reward += 100;
    if (this.crashed) reward -= 100;

    this.totalReward += reward;
    this.lastReward = reward;

    return { reward, done: this.done };
  }
}
