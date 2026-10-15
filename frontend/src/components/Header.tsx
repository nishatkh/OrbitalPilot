import React from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';

interface Props {
  connected: boolean;
  fps: number;
  showLeftSidebar: boolean;
  onToggleLeft: () => void;
  showRightSidebar: boolean;
  onToggleRight: () => void;
}

export const Header: React.FC<Props> = ({
  connected,
  fps,
  showLeftSidebar,
  onToggleLeft,
  showRightSidebar,
  onToggleRight,
}) => {
  return (
    <header className="h-14 bg-black/30 backdrop-blur-2xl border-b border-white/[0.08] px-4 flex items-center justify-between z-30 shrink-0 select-none">
      <div className="flex items-center space-x-3">
        {/* Toggle Left Sidebar */}
        <button
          onClick={onToggleLeft}
          title={showLeftSidebar ? 'Hide Telemetry' : 'Show Telemetry'}
          className={`p-1.5 rounded-lg border transition-all backdrop-blur-md ${
            showLeftSidebar
              ? 'bg-white/15 border-white/25 text-white shadow-sm'
              : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
          }`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-md shadow-sm">
          <span className="text-white font-bold text-sm">R1</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-white uppercase">
              Apollo RL Lander <span className="text-zinc-400 font-normal">• 3D Space Shuttle</span>
            </h1>
            <span className="mono text-[10px] bg-white/[0.04] text-zinc-300 px-2 py-0.5 rounded border border-white/10 backdrop-blur-sm">
              LC-39A
            </span>
          </div>
          <p className="text-[10px] text-zinc-400">
            Gymnasium Box2D v3 • Stable-Baselines3 PPO • Three.js WebGL
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* FPS Counter */}
        <div className="mono text-xs text-zinc-300 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 rounded-md border border-white/[0.08]">
          {fps} <span className="text-zinc-500">FPS</span>
        </div>

        {/* Backend Connection status */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs border border-white/10 bg-white/[0.04] text-zinc-300 mono backdrop-blur-md">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-zinc-200 animate-pulse' : 'bg-zinc-500'}`}></span>
          <span>{connected ? 'WS LIVE: 8765' : 'LOCAL ADAPTER'}</span>
        </div>

        {/* Keyboard Shortcut Hints */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-400 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 rounded-md border border-white/[0.08]">
          <span>Manual Flight:</span>
          <span className="mono bg-white/10 border border-white/10 px-1 rounded text-zinc-200">[W]</span>
          <span className="mono bg-white/10 border border-white/10 px-1 rounded text-zinc-200">[A]</span>
          <span className="mono bg-white/10 border border-white/10 px-1 rounded text-zinc-200">[D]</span>
        </div>

        {/* Toggle Right Sidebar */}
        <button
          onClick={onToggleRight}
          title={showRightSidebar ? 'Hide Controls' : 'Show Controls'}
          className={`p-1.5 rounded-lg border transition-all backdrop-blur-md ${
            showRightSidebar
              ? 'bg-white/15 border-white/25 text-white shadow-sm'
              : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
          }`}
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
