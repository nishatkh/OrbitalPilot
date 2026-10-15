import React from 'react';
import { ModelType } from '../types/simulation';

interface Props {
  paused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  currentModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  speed: number;
  onSetSpeed: (speed: number) => void;
  cameraMode: 'reference' | 'free' | 'follow';
  onSetCameraMode: (cam: 'reference' | 'free' | 'follow') => void;
  showSmoke: boolean;
  onToggleSmoke: () => void;
  connected: boolean;
  localPolicyLoaded?: boolean;
}

export const SimulationControls: React.FC<Props> = ({
  paused,
  onTogglePause,
  onReset,
  currentModel,
  onSelectModel,
  speed,
  onSetSpeed,
  cameraMode,
  onSetCameraMode,
  showSmoke,
  onToggleSmoke,
  connected,
  localPolicyLoaded = false,
}) => {
  const models: { id: ModelType; label: string; desc: string }[] = [
    { id: 'lander', label: 'PPO Best', desc: 'Mean ~232.3' },
    { id: 'shaped', label: 'Potential Shaped', desc: 'Mean ~246.7' },
    { id: 'baseline', label: 'Standard Baseline', desc: 'Mean ~232.3' },
    { id: 'hover', label: 'Hover Hacked', desc: 'Mean -96.3' },
  ];

  return (
    <div className="hud-panel p-4 flex flex-col space-y-3">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-zinc-300"></span>
          Simulation Controls
        </h3>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-zinc-200 animate-pulse' : 'bg-zinc-500'}`}></span>
          <span className="mono text-[10px] text-zinc-400">
            {connected ? 'WS BACKEND' : localPolicyLoaded ? 'LOCAL TRAINED' : 'LOCAL ADAPTER'}
          </span>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onTogglePause}
          className={`py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all backdrop-blur-md ${
            paused
              ? 'bg-white/20 hover:bg-white/25 text-white border border-white/30 shadow-sm'
              : 'bg-white/15 hover:bg-white/20 text-white border border-white/20 shadow-sm'
          }`}
        >
          {paused ? 'RESUME' : 'PAUSE'}
        </button>

        <button
          onClick={onReset}
          className="py-2 px-3 rounded-lg font-medium text-xs bg-white/[0.05] hover:bg-white/10 text-zinc-200 border border-white/10 flex items-center justify-center gap-2 transition-all backdrop-blur-md"
        >
          RESET EPISODE
        </button>
      </div>

      {/* Trained Model Selection */}
      <div className="flex flex-col space-y-1">
        <span className="text-[10px] text-zinc-400 uppercase font-semibold">Trained SB3 / PPO Models</span>
        <div className="grid grid-cols-2 gap-1.5">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectModel(m.id)}
              className={`p-2 rounded-lg border text-left transition-all backdrop-blur-md ${
                currentModel === m.id
                  ? 'bg-white/15 border-white/30 text-white shadow-sm'
                  : 'bg-white/[0.025] border-white/[0.07] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
              }`}
            >
              <div className="font-semibold text-[11px]">{m.label}</div>
              <div className="text-[9px] opacity-75">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Speed & Camera settings */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.08]">
        <div>
          <span className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">Playback Speed</span>
          <div className="flex gap-1">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => onSetSpeed(spd)}
                className={`flex-1 py-1 rounded text-xs font-semibold mono transition-all ${
                  speed === spd
                    ? 'bg-white/15 text-white border border-white/25 shadow-sm'
                    : 'bg-white/[0.025] text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">Camera Framing</span>
          <div className="flex gap-1">
            <button
              onClick={() => onSetCameraMode('reference')}
              title="NASA Photo Angle"
              className={`flex-1 py-1 rounded text-[10px] font-semibold transition-all ${
                cameraMode === 'reference'
                  ? 'bg-white/15 text-white border border-white/25 shadow-sm'
                  : 'bg-white/[0.025] text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              PHOTO
            </button>
            <button
              onClick={() => onSetCameraMode('free')}
              title="Interactive 3D Orbit"
              className={`flex-1 py-1 rounded text-[10px] font-semibold transition-all ${
                cameraMode === 'free'
                  ? 'bg-white/15 text-white border border-white/25 shadow-sm'
                  : 'bg-white/[0.025] text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              ORBIT
            </button>
            <button
              onClick={() => onSetCameraMode('follow')}
              title="Chase Cam"
              className={`flex-1 py-1 rounded text-[10px] font-semibold transition-all ${
                cameraMode === 'follow'
                  ? 'bg-white/15 text-white border border-white/25 shadow-sm'
                  : 'bg-white/[0.025] text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              CHASE
            </button>
          </div>
        </div>
      </div>

      {/* Visual Toggles */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={showSmoke}
            onChange={onToggleSmoke}
            className="rounded border-white/20 bg-white/[0.05] accent-zinc-200 focus:ring-0"
          />
          <span>Exhaust Steam Clouds (From Photo)</span>
        </label>
      </div>
    </div>
  );
};
