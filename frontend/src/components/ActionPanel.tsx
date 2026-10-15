import React from 'react';
import { LunarAction } from '../types/simulation';

interface Props {
  action: LunarAction;
  onManualAction?: (action: LunarAction) => void;
  manualMode: boolean;
}

export const ActionPanel: React.FC<Props> = ({ action, onManualAction, manualMode }) => {
  const actions = [
    { id: 0, label: '0: IDLE', desc: 'Engines Off', key: 'S' },
    { id: 1, label: '1: LEFT RCS', desc: 'Roll Right', key: 'A' },
    { id: 2, label: '2: MAIN THRUST', desc: 'Ascent / Braking', key: 'W' },
    { id: 3, label: '3: RIGHT RCS', desc: 'Roll Left', key: 'D' },
  ];

  return (
    <div className="hud-panel p-4 flex flex-col space-y-3">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-zinc-300"></span>
          Discrete Action Space (4)
        </h3>
        <span className="mono text-[10px] text-zinc-300 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/10 backdrop-blur-sm">
          {manualMode ? 'MANUAL OVERRIDE' : 'AGENT POLICIES'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {actions.map((act) => {
          const isActive = action === act.id;
          return (
            <button
              key={act.id}
              disabled={!manualMode}
              onClick={() => onManualAction && onManualAction(act.id as LunarAction)}
              className={`p-2.5 rounded-lg border text-left transition-all duration-150 flex flex-col justify-between backdrop-blur-md ${
                isActive
                  ? 'bg-white/15 border-white/30 text-white shadow-sm scale-[1.02]'
                  : 'bg-white/[0.025] border-white/[0.07] text-zinc-400 hover:text-zinc-200 hover:border-white/15 hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px]">{act.label}</span>
                {manualMode && (
                  <span className="mono text-[9px] bg-white/10 border border-white/10 px-1 rounded text-zinc-200">
                    [{act.key}]
                  </span>
                )}
              </div>
              <div className="text-[10px] opacity-75 mt-1">{act.desc}</div>
              {isActive && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                  <span className="text-[9px] font-semibold tracking-wider text-white">ACTIVE</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
