export type LunarAction = 0 | 1 | 2 | 3;

export interface LunarObservation {
  x: number;               // Horizontal position [-1.0, 1.0]
  y: number;               // Vertical position [0.0 ~ 1.5]
  vx: number;              // Horizontal velocity
  vy: number;              // Vertical velocity
  angle: number;           // Angle (radians, 0 is upright)
  angularVelocity: number; // Angular velocity
  leftLegContact: boolean; // Ground contact boolean
  rightLegContact: boolean;// Ground contact boolean
}

export type ModelType = 'lander' | 'baseline' | 'shaped' | 'hover';

export type SimMode = 'ai' | 'random' | 'manual' | 'mission';

export interface EpisodeEndEvent {
  score: number;
  steps: number;
  ep: number;
  streak: number;
  best?: number;
  history: number[];
}

export interface TrainingCurveData {
  rewards: number[];
  timesteps: number[];
}

export interface EvalResult {
  mean: number;
  std: number;
  scores: number[];
}

export interface SimulationState {
  obs: [number, number, number, number, number, number, number, number];
  action: LunarAction;
  reward: number;
  total: number;
  step: number;
  ep: number;
  done: boolean;
  crashed: boolean;
  landed: boolean;
  model: ModelType;
  mode: SimMode;
  mission: boolean;   // true while flying the scripted high-altitude hop
  phase: string;      // mission flight-program phase ('' when not in mission)
  perfect: boolean;   // perfect-touchdown flag (mission scoring)
  paused: boolean;
  speed: number;
  fps: number;
  connected: boolean;
}
