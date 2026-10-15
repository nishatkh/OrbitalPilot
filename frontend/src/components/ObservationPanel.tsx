import React, { memo } from 'react';
import { LunarObservation } from '../types/simulation';

interface Props {
  obs: [number, number, number, number, number, number, number, number];
}

export const ObservationPanel: React.FC<Props> = memo(({ obs }) => {
  const [x, y, vx, vy, angle, angularVel, leftLeg, rightLeg] = obs;

  const angleDeg = (angle * 180 / Math.PI).toFixed(1);

  // Helper for progress indicator bar — clean monochromatic glass meter
  const renderBar = (val: number, min: number, max: number, colorClass = 'bg-white/75') => {
    const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    return (
      <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-1 overflow-hidden">
        <div
          className={`h-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  };

  return (
    <div className="hud-panel p-4 flex flex-col space-y-3">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-zinc-300"></span>
          Gymnasium Telemetry (8 Obs)
        </h3>
        <span className="mono text-[10px] text-zinc-300 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/10 backdrop-blur-sm">
          Box2D V3
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* 1. Horizontal Position */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07] hover:border-white/15 transition-all">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>1. Pos X (Horiz)</span>
            <span className="mono text-zinc-100 font-semibold">{x.toFixed(3)}</span>
          </div>
          {renderBar(x, -1.0, 1.0, Math.abs(x) < 0.2 ? 'bg-white/90' : 'bg-white/60')}
          <span className="text-[9px] text-zinc-500 block text-right mt-0.5">[-1.0 to 1.0]</span>
        </div>

        {/* 2. Vertical Position */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07] hover:border-white/15 transition-all">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>2. Pos Y (Alt)</span>
            <span className="mono text-zinc-100 font-semibold">{Math.max(0, y).toFixed(3)}</span>
          </div>
          {renderBar(y, 0.0, 1.5, 'bg-white/80')}
          <span className="text-[9px] text-zinc-500 block text-right mt-0.5">[0.0 (pad) to 1.5]</span>
        </div>

        {/* 3. Horizontal Velocity */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07] hover:border-white/15 transition-all">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>3. Vel X (Vx)</span>
            <span className="mono text-zinc-100 font-semibold">{vx.toFixed(3)} m/s</span>
          </div>
          {renderBar(vx, -1.5, 1.5, Math.abs(vx) < 0.2 ? 'bg-white/90' : 'bg-white/60')}
        </div>

        {/* 4. Vertical Velocity */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07] hover:border-white/15 transition-all">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>4. Vel Y (Vy)</span>
            <span className="mono font-semibold text-zinc-100">
              {vy.toFixed(3)} m/s
            </span>
          </div>
          {renderBar(vy, -1.5, 0.5, vy > -0.3 ? 'bg-white/90' : 'bg-white/50')}
        </div>

        {/* 5. Angle */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07] hover:border-white/15 transition-all">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>5. Pitch Angle</span>
            <span className="mono text-zinc-100 font-semibold">{angleDeg}°</span>
          </div>
          {renderBar(angle, -0.6, 0.6, Math.abs(angle) < 0.1 ? 'bg-white/90' : 'bg-white/60')}
        </div>

        {/* 6. Angular Velocity */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07] hover:border-white/15 transition-all">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>6. Angular Vel</span>
            <span className="mono text-zinc-100 font-semibold">{angularVel.toFixed(3)}</span>
          </div>
          {renderBar(angularVel, -1.0, 1.0, 'bg-white/80')}
        </div>
      </div>

      {/* 7 & 8: Contact Sensors */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className={`p-2 rounded-lg border text-center backdrop-blur-md transition-all ${
          leftLeg > 0.5
            ? 'bg-white/15 border-white/25 text-white shadow-sm'
            : 'bg-white/[0.02] border-white/[0.06] text-zinc-500'
        }`}>
          <div className="text-[10px] uppercase font-semibold tracking-wider">7. Left Leg</div>
          <div className="mono font-semibold text-xs mt-0.5">
            {leftLeg > 0.5 ? 'TOUCHDOWN' : 'AIRBORNE'}
          </div>
        </div>

        <div className={`p-2 rounded-lg border text-center backdrop-blur-md transition-all ${
          rightLeg > 0.5 
            ? 'bg-white/15 border-white/25 text-white shadow-sm' 
            : 'bg-white/[0.02] border-white/[0.06] text-zinc-500'
        }`}>
          <div className="text-[10px] uppercase font-semibold tracking-wider">8. Right Leg</div>
          <div className="mono font-semibold text-xs mt-0.5">
            {rightLeg > 0.5 ? 'TOUCHDOWN' : 'AIRBORNE'}
          </div>
        </div>
      </div>
    </div>
  );
});
