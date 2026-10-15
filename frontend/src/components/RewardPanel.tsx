import React, { memo } from 'react';

interface Props {
  reward: number;
  total: number;
  step: number;
  ep: number;
  done: boolean;
  crashed: boolean;
  landed: boolean;
  streak: number;
  best?: number;
}

export const RewardPanel: React.FC<Props> = memo(({
  reward,
  total,
  step,
  ep,
  done,
  crashed,
  landed,
  streak,
  best,
}) => {
  let statusBadge = (
    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.05] text-zinc-300 border border-white/10 backdrop-blur-sm">
      IN FLIGHT
    </span>
  );

  if (landed) {
    statusBadge = (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/15 text-white border border-white/30 backdrop-blur-sm shadow-sm">
        TOUCHDOWN +100
      </span>
    );
  } else if (crashed) {
    statusBadge = (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/[0.08] text-zinc-300 border border-white/20 backdrop-blur-sm">
        CRASHED -100
      </span>
    );
  }

  return (
    <div className="hud-panel p-4 flex flex-col space-y-3">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-zinc-300"></span>
          Reinforcement Learning Return
        </h3>
        {statusBadge}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Cumulative Episode Return */}
        <div className="bg-white/[0.03] backdrop-blur-md p-2.5 rounded-lg border border-white/[0.08] col-span-2 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 block">Total Episode Return</span>
            <span className="text-[9px] text-zinc-500">Solved benchmark: ≥ 200 pts</span>
          </div>
          <div className="mono text-2xl font-bold text-white">
            {total >= 0 ? `+${total.toFixed(2)}` : total.toFixed(2)}
          </div>
        </div>

        {/* Step Reward */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07]">
          <span className="text-[10px] text-zinc-400 block">Step Reward (r_t)</span>
          <span className="mono font-semibold text-sm text-zinc-100">
            {reward >= 0 ? `+${reward.toFixed(3)}` : reward.toFixed(3)}
          </span>
        </div>

        {/* Step Count */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07]">
          <span className="text-[10px] text-zinc-400 block">Step / Max 1000</span>
          <span className="mono font-semibold text-sm text-zinc-100">
            {step} <span className="text-zinc-500 font-normal">steps</span>
          </span>
        </div>

        {/* Current Episode & Streak */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07]">
          <span className="text-[10px] text-zinc-400 block">Episode Index</span>
          <span className="mono font-semibold text-sm text-zinc-100">
            #{ep}
          </span>
        </div>

        {/* Consecutive Landings Streak */}
        <div className="bg-white/[0.025] backdrop-blur-md p-2 rounded-lg border border-white/[0.07]">
          <span className="text-[10px] text-zinc-400 block">Landing Streak (≥200)</span>
          <span className="mono font-semibold text-sm text-zinc-100">
            {streak}
          </span>
        </div>
      </div>
    </div>
  );
});
