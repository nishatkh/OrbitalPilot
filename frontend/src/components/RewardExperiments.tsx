import React, { useState } from 'react';
import { ModelType } from '../types/simulation';

interface Props {
  onSelectExperimentModel: (model: ModelType) => void;
  currentModel: ModelType;
}

export const RewardExperiments: React.FC<Props> = ({
  onSelectExperimentModel,
  currentModel,
}) => {
  const [activeTab, setActiveTab] = useState<'exp1' | 'exp2' | 'exp3'>('exp3');

  return (
    <div className="hud-panel p-4 flex flex-col space-y-3">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-zinc-300"></span>
          Reward Shaping Laboratory
        </h3>
        <span className="mono text-[10px] text-zinc-300 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/10 backdrop-blur-sm">
          SB3 PPO
        </span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-white/[0.03] backdrop-blur-md p-1 rounded-xl border border-white/[0.08]">
        <button
          onClick={() => setActiveTab('exp1')}
          className={`py-1 rounded-lg text-[11px] font-medium transition-all ${
            activeTab === 'exp1' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          1: Baseline
        </button>
        <button
          onClick={() => setActiveTab('exp2')}
          className={`py-1 rounded-lg text-[11px] font-medium transition-all ${
            activeTab === 'exp2' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          2: Hover Hack
        </button>
        <button
          onClick={() => setActiveTab('exp3')}
          className={`py-1 rounded-lg text-[11px] font-medium transition-all ${
            activeTab === 'exp3' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          3: Shaped PBRS
        </button>
      </div>

      {/* Tab 1: Baseline */}
      {activeTab === 'exp1' && (
        <div className="text-xs space-y-2 bg-white/[0.025] backdrop-blur-md p-3 rounded-lg border border-white/[0.08]">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-zinc-200">Standard Gymnasium LunarLander</span>
            <span className="mono text-zinc-200 font-semibold">+232.3 pts</span>
          </div>
          <p className="text-zinc-400 text-[11px]">
            Uses standard distance, velocity, tilt penalties, main engine fuel cost (-0.30/step) and +100 touchdown reward.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onSelectExperimentModel('baseline')}
              className={`w-full py-1.5 rounded-lg font-medium text-xs transition-all backdrop-blur-md ${
                currentModel === 'baseline'
                  ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                  : 'bg-white/[0.05] hover:bg-white/10 text-zinc-200 border border-white/10'
              }`}
            >
              {currentModel === 'baseline' ? 'CURRENTLY ACTIVE' : 'LOAD BASELINE MODEL'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Hover Hacking */}
      {activeTab === 'exp2' && (
        <div className="text-xs space-y-2 bg-white/[0.025] backdrop-blur-md p-3 rounded-lg border border-white/[0.08]">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-zinc-200">Hover Exploitation (Reward Hacking)</span>
            <span className="mono text-zinc-400 font-semibold">-96.3 pts</span>
          </div>
          <p className="text-zinc-400 text-[11px]">
            Flawed reward formula: gives bonus +1.5 for maintaining stable altitude. The RL agent exploits this by hovering in mid-air until the 1000-step timeout, completely ignoring landing!
          </p>
          <div className="pt-2">
            <button
              onClick={() => onSelectExperimentModel('hover')}
              className={`w-full py-1.5 rounded-lg font-medium text-xs transition-all backdrop-blur-md ${
                currentModel === 'hover'
                  ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                  : 'bg-white/[0.05] hover:bg-white/10 text-zinc-200 border border-white/10'
              }`}
            >
              {currentModel === 'hover' ? 'CURRENTLY ACTIVE' : 'DEMONSTRATE REWARD HACK'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Potential-Based Shaping */}
      {activeTab === 'exp3' && (
        <div className="text-xs space-y-2 bg-white/[0.025] backdrop-blur-md p-3 rounded-lg border border-white/[0.08]">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-zinc-200">Potential-Based Reward Shaping (PBRS)</span>
            <span className="mono text-zinc-200 font-semibold">+246.7 pts</span>
          </div>
          <div className="mono text-[10px] bg-white/[0.04] p-2 rounded text-zinc-300 border border-white/10">
            F(s, s') = γ · Φ(s') - Φ(s)
          </div>
          <p className="text-zinc-400 text-[11px]">
            Theoretically preserves the optimal policy invariance (Ng et al.) while adding velocity-damping potential to prevent hard ground impacts.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onSelectExperimentModel('shaped')}
              className={`w-full py-1.5 rounded-lg font-medium text-xs transition-all backdrop-blur-md ${
                currentModel === 'shaped'
                  ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                  : 'bg-white/[0.05] hover:bg-white/10 text-zinc-200 border border-white/10'
              }`}
            >
              {currentModel === 'shaped' ? 'CURRENTLY ACTIVE' : 'LOAD SHAPED MODEL'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
