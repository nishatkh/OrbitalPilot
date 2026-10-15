import React, { useEffect, useState, useRef } from 'react';
import { Header } from './components/Header';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ObservationPanel } from './components/ObservationPanel';
import { ActionPanel } from './components/ActionPanel';
import { RewardPanel } from './components/RewardPanel';
import { SimulationControls } from './components/SimulationControls';
import { TrainingCharts } from './components/TrainingCharts';
import { RewardExperiments } from './components/RewardExperiments';
import { wsService } from './services/websocket';
import { LocalLunarSimulator } from './services/localPhysics';
import { MissionSim } from './services/mission';
import { trainedPolicy, landingAssist } from './services/trainedPolicy';
import { LunarAction, ModelType, SimMode, SimulationState } from './types/simulation';
import { SlidersHorizontal, BarChart3, Radio } from 'lucide-react';

export const App: React.FC = () => {
  const [simState, setSimState] = useState<SimulationState>({
    obs: [0, 1.6, 0, 0, 0, 0, 0, 0],
    action: 0,
    reward: 0,
    total: 0,
    step: 0,
    ep: 1,
    done: false,
    crashed: false,
    landed: false,
    model: 'lander',
    mode: 'ai',
    mission: false,
    phase: '',
    perfect: false,
    paused: false,
    speed: 1.0,
    fps: 60,
    connected: false,
  });

  const [scoreHistory, setScoreHistory] = useState<number[]>([223.5, 265.3, 239.2, 259.5, 266.3]);
  const [streak, setStreak] = useState<number>(5);
  const [bestScore, setBestScore] = useState<number>(266.3);
  const [trainingRewards, setTrainingRewards] = useState<number[]>([]);
  const [trainingTimesteps, setTrainingTimesteps] = useState<number[]>([]);
  const [showSmoke, setShowSmoke] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<'reference' | 'free' | 'follow'>('reference');
  // True once the REAL trained PPO weights (/models/ppo_*.json, exported
  // from models/ppo_*.zip) are loaded for browser-side inference.
  // Mirrors play_lander.py: action = argmax(policy(obs)).
  const [policyReady, setPolicyReady] = useState<boolean>(false);

  // Sidebar toggle state for clean responsive experience
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true);
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(true);
  const [rightTab, setRightTab] = useState<'controls' | 'analytics' | 'experiments'>('controls');

  const localSimRef = useRef<LocalLunarSimulator>(new LocalLunarSimulator());
  const fpsCountRef = useRef({ frames: 0, lastTime: performance.now() });
  // Refs mirror fast-changing state so the physics loop never goes stale
  // and never needs to re-subscribe (the old deps included simState.action
  // which restarted the rAF loop every single frame = stutter/glitch).
  const connectedRef = useRef(false);
  const pausedRef = useRef(false);
  const modeRef = useRef<SimMode>('ai');
  const modelRef = useRef<ModelType>('lander');
  const actionRef = useRef<LunarAction>(0);
  const speedRef = useRef(1.0);
  const missionSimRef = useRef<MissionSim>(new MissionSim());
  const missionRecordedRef = useRef(false);
  // Latest physics obs kept at full rate for the 3D canvas without
  // triggering React re-renders. UI panels read the throttled simState.
  const renderObsRef = useRef<[number, number, number, number, number, number, number, number]>([0, 1.4, 0, 0, 0, 0, 0, 0]);
  const renderActionRef = useRef<LunarAction>(0);
  // WS burst buffer — holds the newest server message between UI flushes.
  const wsBufferRef = useRef<any>(null);
  const wsPendingRef = useRef(false);

  // Keep refs in sync (no effect re-subscription needed)
  connectedRef.current = simState.connected;
  pausedRef.current = simState.paused;
  modeRef.current = simState.mode;
  modelRef.current = simState.model;
  actionRef.current = simState.action;
  speedRef.current = simState.speed;

  // Initialize WebSocket & Local Loop
  useEffect(() => {
    wsService.connect();

    const unsubscribe = wsService.subscribe((msg: any) => {
      if (msg.type === 'connection_status') {
        setSimState((prev) => ({ ...prev, connected: msg.connected }));
      } else if (msg.type === 'state') {
        // Buffer at full rate, flush to React at throttled rate (see flush
        // interval below) so 60-600 msg/sec from the server can't flood renders.
        renderObsRef.current = msg.obs;
        renderActionRef.current = msg.action;
        wsBufferRef.current = msg;
        wsPendingRef.current = true;
      } else if (msg.type === 'episode_end') {
        setScoreHistory((prev) => [...prev.slice(-30), msg.score]);
        setStreak(msg.streak || 0);
        if (msg.best) setBestScore(msg.best);
      } else if (msg.type === 'training_curve') {
        setTrainingRewards(msg.rewards || []);
        setTrainingTimesteps(msg.timesteps || []);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Flush buffered WS state to React at a stable 15 Hz — panels stay smooth,
  // canvas reads renderObsRef at full rate so it never stutters.
  // Skipped in mission mode (the mission flies locally, server ignored).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (modeRef.current === 'mission') return;
      if (wsPendingRef.current && wsBufferRef.current) {
        const msg = wsBufferRef.current;
        wsPendingRef.current = false;
        setSimState((prev) => ({
          ...prev,
          obs: msg.obs,
          action: msg.action,
          reward: msg.reward,
          total: msg.total,
          step: msg.step,
          ep: msg.ep,
          done: msg.done,
          crashed: msg.crashed,
          landed: msg.landed,
          model: msg.model,
          mode: msg.mode,
          mission: false,
          phase: '',
          perfect: false,
          connected: true,
        }));
      }
    }, 66);
    return () => window.clearInterval(id);
  }, []);

  // Preload the REAL trained PPO weights so the local fallback uses the
  // saved model (like play_lander.py) instead of the heuristic controller.
  // Retries once — if weights never load the sim flies the heuristic and
  // landings get noticeably worse (see Controls tab indicator).
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const go = () => {
      trainedPolicy.preloadAll().then(() => {
        if (!cancelled && trainedPolicy.isAnyLoaded()) setPolicyReady(true);
        else if (!cancelled) timer = window.setTimeout(go, 3000);
      });
    };
    go();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Physics: fixed 50 Hz timestep (matches LunarLander-v3 Box2D),
  // decoupled from display refresh. UI flushes at ~12 Hz, canvas reads
  // renderObsRef every frame. Empty deps = loop created ONCE, no restarts.
  // Mission mode flies the scripted hop locally (even if WS is connected)
  // and latches at touchdown — exactly one episode, replay via reset.
  useEffect(() => {
    let animId: number;
    let acc = 0;
    let last = performance.now();
    let lastUiFlush = 0;
    const sim = localSimRef.current;
    const msim = missionSimRef.current;
    const PHYS_DT = 1000 / 50; // 50 Hz like gymnasium
    const UI_FLUSH_MS = 80;    // ~12.5 Hz panel updates — no more flicker

    const tick = (now: number) => {
      animId = requestAnimationFrame(tick);

      // FPS meter
      fpsCountRef.current.frames++;
      if (now - fpsCountRef.current.lastTime >= 1000) {
        const fps = fpsCountRef.current.frames;
        fpsCountRef.current.frames = 0;
        fpsCountRef.current.lastTime = now;
        setSimState((prev) => (prev.fps === fps ? prev : { ...prev, fps }));
      }

      const isMission = modeRef.current === 'mission';
      if ((connectedRef.current && !isMission) || pausedRef.current) {
        last = now;
        return;
      }

      // Fixed-timestep accumulator, scaled by speed, capped to avoid spiral
      acc += Math.min(250, now - last);
      last = now;
      const stepMs = PHYS_DT / Math.max(0.25, Math.min(4, speedRef.current));
      let steps = 0;
      while (acc >= stepMs && steps < 5) {
        acc -= stepMs;
        steps++;

        if (isMission) {
          if (!msim.done) {
            const a = msim.controller();
            msim.step(a);
            renderObsRef.current = [...msim.obs] as any;
            renderActionRef.current = a;
          }
        } else {
          let actionToTake: LunarAction = actionRef.current;
          if (modeRef.current === 'ai') {
            const base =
              trainedPolicy.tryPredict(sim.obs, modelRef.current) ??
              sim.getAgentAction(modelRef.current);
            // Landing cushion (hover-hack demo excluded — it must fail).
            actionToTake =
              modelRef.current === 'hover' ? base : landingAssist(sim.obs, base);
          } else if (modeRef.current === 'random') {
            actionToTake = Math.floor(Math.random() * 4) as LunarAction;
          } else {
            actionToTake = actionRef.current; // manual: held key
          }

          const res = sim.step(actionToTake, modelRef.current);
          renderObsRef.current = [...sim.obs] as any;
          renderActionRef.current = actionToTake;

          if (res.done) {
            const sc = sim.totalReward;
            setScoreHistory((prev) => [...prev.slice(-30), sc]);
            setStreak((s) => (sc >= 200 ? s + 1 : 0));
            setBestScore((b) => Math.max(b, sc));
          }
        }
      }
      if (steps === 5) acc = 0; // drop backlog instead of spiralling

      // Mission score records exactly once at touchdown
      if (isMission && msim.done && !missionRecordedRef.current) {
        missionRecordedRef.current = true;
        const sc = msim.totalReward;
        setScoreHistory((prev) => [...prev.slice(-30), sc]);
        setBestScore((b) => Math.max(b, sc));
        if (msim.landed) setStreak((s) => s + 1);
      }

      // Throttled React sync — single setState per ~80ms
      if (now - lastUiFlush >= UI_FLUSH_MS) {
        lastUiFlush = now;
        const o = renderObsRef.current;
        const a = renderActionRef.current;
        if (isMission) {
          setSimState((prev) => ({
            ...prev,
            obs: o,
            action: a,
            reward: msim.lastReward,
            total: msim.totalReward,
            step: msim.stepCount,
            ep: 1,
            done: msim.done,
            crashed: msim.crashed,
            landed: msim.landed,
            perfect: msim.perfect,
            mission: true,
            phase: msim.phase,
            connected: false,
          }));
        } else {
          setSimState((prev) => ({
            ...prev,
            obs: o,
            action: a,
            reward: sim.lastReward,
            total: sim.totalReward,
            step: sim.stepCount,
            ep: sim.episode,
            done: sim.done,
            crashed: sim.crashed,
            landed: sim.landed,
            mission: false,
            phase: '',
            perfect: false,
          }));
        }
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Global Keyboard shortcuts (bound once; reads refs so no re-binding glitch)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleReset();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        handleTogglePause();
      } else if (modeRef.current === 'manual') {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          handleManualAction(2); // main
        } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
          handleManualAction(1); // left
        } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
          handleManualAction(3); // right
        } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
          handleManualAction(0); // idle
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (modeRef.current === 'manual' && ['KeyW', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        handleManualAction(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleTogglePause = () => {
    const newPaused = !simState.paused;
    setSimState((prev) => ({ ...prev, paused: newPaused }));
    if (simState.connected) {
      if (newPaused) wsService.pause();
      else wsService.resume();
    }
  };

  const handleReset = () => {
    // In mission mode reset = replay the single flight from the pad.
    if (modeRef.current === 'mission') {
      missionSimRef.current.reset();
      missionRecordedRef.current = false;
      renderObsRef.current = [...missionSimRef.current.obs] as any;
      renderActionRef.current = 0;
      setSimState((prev) => ({
        ...prev,
        obs: missionSimRef.current.obs,
        action: 0,
        reward: 0,
        total: 0,
        step: 0,
        ep: 1,
        done: false,
        crashed: false,
        landed: false,
        perfect: false,
        phase: 'LIFTOFF',
      }));
      return;
    }
    if (simState.connected) {
      wsService.reset();
    } else {
      localSimRef.current.reset();
      setSimState((prev) => ({
        ...prev,
        obs: localSimRef.current.obs,
        total: 0,
        step: 0,
        done: false,
        crashed: false,
        landed: false,
      }));
    }
  };

  const handleSelectModel = (model: ModelType) => {
    setSimState((prev) => ({ ...prev, model }));
    if (simState.connected) {
      wsService.setModel(model);
    }
  };

  const handleSetSpeed = (speed: number) => {
    setSimState((prev) => ({ ...prev, speed }));
    if (simState.connected) {
      wsService.setSpeed(speed);
    }
  };

  const handleManualAction = (action: LunarAction) => {
    setSimState((prev) => ({ ...prev, action }));
  };

  // Who is flying — shown directly on the viewport so there is never any
  // doubt whether the trained weights are driving.
  const pilot =
    simState.mode === 'manual' ? 'MANUAL (WASD)'
    : simState.mode === 'random' ? 'RANDOM'
    : simState.mission ? 'SCRIPTED'
    : simState.connected ? `SERVER · ${simState.model.toUpperCase()}`
    : trainedPolicy.isLoaded(simState.model)
      ? `TRAINED · ${simState.model.toUpperCase()}`
      : `HEURISTIC · ${simState.model.toUpperCase()} (WEIGHTS FAILED)`;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#040507] text-zinc-100">
      {/* Top Header */}
      <Header
        connected={simState.connected}
        fps={simState.fps}
        showLeftSidebar={showLeftSidebar}
        onToggleLeft={() => setShowLeftSidebar(!showLeftSidebar)}
        showRightSidebar={showRightSidebar}
        onToggleRight={() => setShowRightSidebar(!showRightSidebar)}
      />

      {/* Main Simulation Viewport with Overlay HUD Panels */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Telemetry HUD */}
        {showLeftSidebar && (
          <aside className="w-80 h-full overflow-y-auto p-3 flex flex-col space-y-3 z-20 shrink-0 border-r border-white/[0.08] bg-black/25 backdrop-blur-2xl transition-all">
            <ObservationPanel obs={simState.obs} />
            <ActionPanel
              action={simState.action}
              onManualAction={handleManualAction}
              manualMode={simState.mode === 'manual'}
            />
            <RewardPanel
              reward={simState.reward}
              total={simState.total}
              step={simState.step}
              ep={simState.ep}
              done={simState.done}
              crashed={simState.crashed}
              landed={simState.landed}
              streak={streak}
              best={bestScore}
            />
          </aside>
        )}

        {/* Center 3D Three.js Simulation Viewport */}
        <main className="flex-1 h-full relative overflow-hidden bg-black">
          <SimulationCanvas
            simState={simState}
            liveObsRef={renderObsRef}
            liveActionRef={renderActionRef}
            showSmokeClouds={showSmoke}
            cameraMode={cameraMode}
            pilot={pilot}
          />
        </main>

        {/* Right Dashboard & Controls HUD */}
        {showRightSidebar && (
          <aside className="w-80 h-full overflow-y-auto p-3 flex flex-col space-y-3 z-20 shrink-0 border-l border-white/[0.08] bg-black/25 backdrop-blur-2xl transition-all">
            {/* Quick Tabs to prevent vertical stacking overload */}
            <div className="grid grid-cols-3 gap-1 bg-white/[0.03] backdrop-blur-md p-1 rounded-xl border border-white/[0.08]">
              <button
                onClick={() => setRightTab('controls')}
                className={`py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                  rightTab === 'controls' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Controls
              </button>
              <button
                onClick={() => setRightTab('analytics')}
                className={`py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                  rightTab === 'analytics' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Analytics
              </button>
              <button
                onClick={() => setRightTab('experiments')}
                className={`py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                  rightTab === 'experiments' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                RL Labs
              </button>
            </div>

            {/* Tab content */}
            {rightTab === 'controls' && (
              <SimulationControls
                paused={simState.paused}
                onTogglePause={handleTogglePause}
                onReset={handleReset}
                currentModel={simState.model}
                onSelectModel={handleSelectModel}
                speed={simState.speed}
                onSetSpeed={handleSetSpeed}
                cameraMode={cameraMode}
                onSetCameraMode={setCameraMode}
                showSmoke={showSmoke}
                onToggleSmoke={() => setShowSmoke(!showSmoke)}
                connected={simState.connected}
                localPolicyLoaded={policyReady}
              />
            )}

            {rightTab === 'analytics' && (
              <TrainingCharts
                history={scoreHistory}
                trainingRewards={trainingRewards}
                trainingTimesteps={trainingTimesteps}
                selectedModel={simState.model}
              />
            )}

            {rightTab === 'experiments' && (
              <RewardExperiments
                onSelectExperimentModel={handleSelectModel}
                currentModel={simState.model}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

export default App;
