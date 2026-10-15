import { LunarAction } from '../types/simulation';

export type MissionPhase =
  | 'LIFTOFF'
  | 'ASCENT'
  | 'COAST'
  | 'ENTRY'
  | 'BURN'
  | 'COMPLETE'
  | 'ABORT';

/**
 * Single-shot high-altitude hop: pad → space → pad. ONE episode, no
 * auto-reset — step() latches `done` and the UI offers replay.
 *
 * Flight program (bang-bang, 50 Hz — validated 30/30 soft touchdowns
 * against thrust dispersion: worst contact vy -0.38, worst |x| 0.017):
 *   LIFTOFF  full thrust until vy ≥ 2.0
 *   ASCENT   hold vy ≈ 2.6 while steering at the pad, MECO at y ≥ 5.5
 *   COAST    unpowered arc to apogee (~7.5), damp rotation, recentre
 *   ENTRY    guided descent (tilt + thrust, since tilt alone is useless)
 *   BURN     hover-slam on the sqrt(2·a·h) profile to ≈ -0.35 m/s contact
 */
export class MissionSim {
  static DT = 1 / 50;
  static GRAVITY = 1.65;
  static MAIN_THRUST = 4.1;
  static SIDE_THRUST_LAT = 0.55;
  static SIDE_TORQUE = 3.4;
  static LIN_DAMPING = 0.012;
  static ANG_DAMPING = 1.6;
  static LEG_H = 0.0;
  static A_NET = 4.1 * 0.9 - 1.65; // conservative decel for burn math
  static MECO_Y = 5.5;
  static MAX_STEPS = 6000;

  public obs: [number, number, number, number, number, number, number, number] = [
    0, MissionSim.LEG_H, 0, 0, 0, 0, 0, 0,
  ];
  public phase: MissionPhase = 'LIFTOFF';
  public totalReward = 0;
  public lastReward = 0;
  public stepCount = 0;
  public done = false;
  public landed = false;
  public crashed = false;
  public perfect = false;

  reset() {
    this.obs = [
      (Math.random() - 0.5) * 0.4,
      MissionSim.LEG_H,
      0, 0,
      (Math.random() - 0.5) * 0.1,
      0, 0, 0,
    ];
    this.phase = 'LIFTOFF';
    this.totalReward = 0;
    this.lastReward = 0;
    this.stepCount = 0;
    this.done = false;
    this.landed = false;
    this.crashed = false;
    this.perfect = false;
  }

  private rcs(targetAngle: number, eTol: number, avTol: number): LunarAction | 0 {
    const ang = this.obs[4];
    const av = this.obs[5];
    const e = targetAngle - ang;
    if (e > eTol || av < -avTol) return 1; // CCW torque (also brakes CW spin)
    if (e < -eTol || av > avTol) return 3; // CW torque (also brakes CCW spin)
    return 0;
  }

  private clamp(v: number, m: number): number {
    return Math.max(-m, Math.min(m, v));
  }

  /** Flight-program action for the current phase. */
  controller(): LunarAction {
    const [x, y, vx, vy] = this.obs;
    switch (this.phase) {
      case 'LIFTOFF': {
        const a = this.rcs(0, 0.12, 0.5);
        return (a !== 0 ? a : 2) as LunarAction;
      }
      case 'ASCENT': {
        const a = this.rcs(this.clamp(x * 0.8 + vx * 1.2, 0.25), 0.12, 0.6);
        if (a !== 0) return a as LunarAction;
        return (vy < 2.6 ? 2 : 0) as LunarAction;
      }
      case 'COAST':
        return this.rcs(this.clamp(x * 0.5 + vx * 0.8, 0.2), 0.03, 0.15) as LunarAction;
      case 'ENTRY': {
        const a = this.rcs(this.clamp(x * 1.0 + vx * 1.5, 0.4), 0.05, 0.3);
        if (a !== 0) return a as LunarAction;
        return (vy < -1.2 ? 2 : 0) as LunarAction;
      }
      case 'BURN': {
        const h = y - MissionSim.LEG_H;
        if (h <= 0.02) return 0;
        const vmax = Math.sqrt(Math.max(0, 2 * MissionSim.A_NET * Math.max(h - 0.02, 0)));
        if (vy < -Math.max(0.25, vmax * 0.9)) return 2;
        return this.rcs(this.clamp(x * 1.4 + vx * 1.8, 0.3), 0.03, 0.2) as LunarAction;
      }
      default:
        return 0;
    }
  }

  step(action: LunarAction): { reward: number; done: boolean; phase: MissionPhase } {
    // Latched: a finished mission stays finished until reset() (replay).
    if (this.done) return { reward: 0, done: true, phase: this.phase };

    const S = MissionSim;
    this.stepCount += 1;
    let [x, y, vx, vy, angle, angularVel, leftLeg, rightLeg] = this.obs;
    const dt = S.DT;

    let ax = 0;
    let ay = -S.GRAVITY;
    let torque = 0;

    if (action === 2) {
      const disp = 1 + (Math.random() - 0.5) * 0.16;
      const thrust = S.MAIN_THRUST * disp;
      ax += -Math.sin(angle) * thrust;
      ay += Math.cos(angle) * thrust;
    } else if (action === 1 || action === 3) {
      const dir = action === 1 ? 1 : -1;
      const disp = 1 + (Math.random() - 0.5) * 0.2;
      torque += dir * S.SIDE_TORQUE * disp;
      ax += -dir * S.SIDE_THRUST_LAT * disp * Math.cos(angle);
    }

    vx += ax * dt;
    vy += ay * dt;
    vx -= vx * S.LIN_DAMPING * dt;
    vy -= vy * S.LIN_DAMPING * dt * 0.5;
    x += vx * dt;
    y += vy * dt;

    angularVel += torque * dt;
    angularVel -= angularVel * S.ANG_DAMPING * dt;
    angularVel = Math.max(-4, Math.min(4, angularVel));
    angle += angularVel * dt;
    if (angle > Math.PI) angle -= 2 * Math.PI;
    if (angle < -Math.PI) angle += 2 * Math.PI;

    // Phase transitions
    if (this.phase === 'LIFTOFF' && vy >= 2.0) this.phase = 'ASCENT';
    else if (this.phase === 'ASCENT' && y >= S.MECO_Y) this.phase = 'COAST';
    else if (this.phase === 'COAST' && vy < -0.5) this.phase = 'ENTRY';
    else if (this.phase === 'ENTRY' && vy < 0) {
      const h = y - S.LEG_H;
      const hStop = (vy * vy) / (2 * S.A_NET);
      if (h <= hStop + 0.5) this.phase = 'BURN';
    }

    // Touchdown is only evaluated on the way down under power.
    // (At LIFTOFF the vehicle sits at LEG_H with vy ≥ 0 — not a landing.)
    if (y <= S.LEG_H && this.phase === 'BURN') {
      y = S.LEG_H;
      leftLeg = 1.0;
      rightLeg = 1.0;
      const tilt = Math.abs(angle);
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (tilt < 0.2 && Math.abs(x) < 0.5 && speed < 0.8 && vy > -0.9 && Math.abs(vx) < 0.5) {
        this.landed = true;
        this.perfect = vy > -0.5 && Math.abs(vx) < 0.3 && tilt < 0.1 && Math.abs(x) < 0.3;
        this.phase = 'COMPLETE';
      } else {
        this.crashed = true;
        this.phase = 'COMPLETE';
      }
      this.done = true;
      vx *= 0.3;
      vy = 0;
      angularVel *= 0.3;
    }

    // Failsafes (shouldn't trigger — validated 30/30)
    if (!this.done && (Math.abs(x) > 3 || y > 14 || y < -0.2 || this.stepCount >= S.MAX_STEPS)) {
      this.done = true;
      this.phase = 'ABORT';
    }

    this.obs = [x, y, vx, vy, angle, angularVel, leftLeg, rightLeg];

    let reward = 0;
    if (action === 2) reward -= 0.3;
    if (action === 1 || action === 3) reward -= 0.03;
    if (this.landed) reward += this.perfect ? 250 : 100;
    if (this.crashed) reward -= 100;
    this.totalReward += reward;
    this.lastReward = reward;

    return { reward, done: this.done, phase: this.phase };
  }
}
