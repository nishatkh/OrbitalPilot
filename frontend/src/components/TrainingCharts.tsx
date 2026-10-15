import React, { useMemo } from 'react';

interface Props {
  history: number[];
  trainingRewards: number[];
  trainingTimesteps: number[];
  selectedModel: string;
}

export const TrainingCharts: React.FC<Props> = ({
  history,
  trainingRewards,
  selectedModel,
}) => {
  // Model benchmark stats in clean neutral grayscale
  const benchmarks = [
    { name: 'Shaped PPO', score: 246.7, std: 24.1, color: '#f4f4f6', solved: true },
    { name: 'Best Lander', score: 232.3, std: 28.5, color: '#d4d4d8', solved: true },
    { name: 'Baseline', score: 232.3, std: 28.5, color: '#a1a1aa', solved: true },
    { name: 'Hover Hack', score: -96.3, std: 45.2, color: '#71717a', solved: false },
  ];

  // Downsample training rewards for clean SVG curve
  const svgTrainingPath = useMemo(() => {
    if (!trainingRewards || trainingRewards.length === 0) return '';
    const points = trainingRewards.slice(-150);
    const min = -300;
    const max = 300;
    const width = 280;
    const height = 90;

    return points
      .map((val, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const norm = (val - min) / (max - min);
        const y = height - Math.max(0, Math.min(height, norm * height));
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [trainingRewards]);

  return (
    <div className="hud-panel p-4 flex flex-col space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-zinc-300"></span>
          Training Performance & Analytics
        </h3>
        <span className="mono text-[10px] text-zinc-300 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/10 backdrop-blur-sm">
          250k Steps
        </span>
      </div>

      {/* 1. Recent Episode Scores with +200 Threshold */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-zinc-400 font-medium">Live Episode Score History</span>
          <span className="mono text-[10px] text-zinc-400">Target ≥ +200</span>
        </div>
        <div className="h-16 bg-white/[0.025] backdrop-blur-md rounded-lg border border-white/[0.07] flex items-end gap-1 px-2 py-1.5 relative overflow-hidden">
          {/* Target +200 line */}
          <div
            className="absolute left-0 right-0 border-b border-white/20 border-dashed z-0 pointer-events-none"
            style={{ bottom: '70%' }}
          >
            <span className="mono text-[8px] text-zinc-400 absolute right-1 -top-3">
              +200
            </span>
          </div>

          {/* 0 line */}
          <div
            className="absolute left-0 right-0 border-b border-white/10 z-0 pointer-events-none"
            style={{ bottom: '30%' }}
          ></div>

          {history.length === 0 ? (
            <div className="w-full text-center text-zinc-500 text-[10px] self-center">
              Awaiting episode completions...
            </div>
          ) : (
            history.slice(-30).map((sc, i) => {
              // Map score [-200, 300] to [0, 100]%
              const heightPct = Math.max(5, Math.min(100, ((sc + 150) / 450) * 100));
              const isWin = sc >= 200;
              return (
                <div
                  key={i}
                  title={`Episode: ${sc.toFixed(1)}`}
                  className={`flex-1 rounded-t transition-all ${
                    isWin ? 'bg-white/80' : sc > 0 ? 'bg-white/45' : 'bg-white/20'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* 2. Real SB3 PPO Training Curve */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-zinc-400 font-medium">PPO Convergence (Monitor CSV)</span>
          <span className="mono text-[10px] text-zinc-500">250,000 steps</span>
        </div>
        <div className="h-24 bg-white/[0.025] backdrop-blur-md rounded-lg border border-white/[0.07] p-2 relative">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 280 90">
            {/* Grid lines */}
            <line x1="0" y1="15" x2="280" y2="15" stroke="rgba(255,255,255,0.12)" strokeDasharray="2,2" />
            <line x1="0" y1="45" x2="280" y2="45" stroke="rgba(255,255,255,0.06)" />
            <line x1="0" y1="75" x2="280" y2="75" stroke="rgba(255,255,255,0.12)" strokeDasharray="2,2" />

            {/* Target 200 label */}
            <text x="2" y="13" fill="#a1a1aa" fontSize="7" fontFamily="monospace">+200 Target</text>
            <text x="2" y="43" fill="#71717a" fontSize="7" fontFamily="monospace">0.0</text>
            <text x="2" y="73" fill="#71717a" fontSize="7" fontFamily="monospace">-200</text>

            {svgTrainingPath && (
              <path
                d={svgTrainingPath}
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
      </div>

      {/* 3. Model Benchmark Comparison Bars */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-2">
          <span className="text-zinc-400 font-medium">Trained Models Benchmark</span>
          <span className="mono text-[10px] text-zinc-400">Mean Score ± Std</span>
        </div>
        <div className="space-y-2">
          {benchmarks.map((b) => {
            const isSelected = selectedModel.includes(b.name.toLowerCase().split(' ')[0]);
            // Map [-150, 300] to percentage
            const normPct = Math.max(8, Math.min(100, ((b.score + 150) / 450) * 100));
            return (
              <div key={b.name} className="text-xs">
                <div className="flex justify-between items-center mb-0.5">
                  <span className={`font-medium ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                    {b.name}
                  </span>
                  <span className="mono text-[11px] font-semibold text-zinc-300">
                    {b.score > 0 ? `+${b.score}` : b.score} ± {b.std}
                  </span>
                </div>
                <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden border border-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${normPct}%`, backgroundColor: b.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
