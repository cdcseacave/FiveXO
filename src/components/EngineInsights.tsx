import React from 'react';
import type { AIStats, GameMode } from '../engine/types';
import { Cpu, Play, Pause, StepForward, Activity, Gauge, Zap } from 'lucide-react';

interface EngineInsightsProps {
  stats: AIStats | null;
  mode: GameMode;
  aiVsAiRunning: boolean;
  aiVsAiSpeed: number; // in ms
  onToggleAiVsAi: () => void;
  onStepAiVsAi: () => void;
  onChangeSpeed: (ms: number) => void;
}

export const EngineInsights: React.FC<EngineInsightsProps> = ({
  stats,
  mode,
  aiVsAiRunning,
  aiVsAiSpeed,
  onToggleAiVsAi,
  onStepAiVsAi,
  onChangeSpeed,
}) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl flex flex-col gap-2.5 text-xs text-slate-300">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold tracking-wide text-cyan-400">
          <Cpu size={15} />
          <span>SOTA CLASSICAL AI INSIGHTS</span>
        </div>
        {stats?.thinking && (
          <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono animate-pulse">
            <Activity size={12} /> Thinking...
          </span>
        )}
      </div>

      {/* AI vs AI Controls if in AI vs AI mode */}
      {mode === 'ai-v-ai' && (
        <div className="flex items-center justify-between gap-2 p-2 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <button
            onClick={onToggleAiVsAi}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              aiVsAiRunning
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
            }`}
          >
            {aiVsAiRunning ? <Pause size={14} /> : <Play size={14} />}
            <span>{aiVsAiRunning ? 'Pause Match' : 'Play Match'}</span>
          </button>

          <button
            onClick={onStepAiVsAi}
            disabled={aiVsAiRunning}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg transition-colors"
          >
            <StepForward size={14} />
            <span>Step</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Speed:</span>
            <input
              type="range"
              min={100}
              max={1500}
              step={100}
              value={aiVsAiSpeed}
              onChange={(e) => onChangeSpeed(Number(e.target.value))}
              className="w-20 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono text-[11px] text-slate-400 w-10 text-right">
              {(aiVsAiSpeed / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {/* AI Search Metrics */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
          <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <Gauge size={10} /> Depth
          </div>
          <div className="text-sm font-mono font-bold text-cyan-300">
            {stats ? `D${stats.depth}` : '—'}
          </div>
        </div>

        <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
          <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <Activity size={10} /> Nodes
          </div>
          <div className="text-sm font-mono font-bold text-slate-200">
            {stats ? stats.nodes.toLocaleString() : '—'}
          </div>
        </div>

        <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
          <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <Zap size={10} /> Speed
          </div>
          <div className="text-sm font-mono font-bold text-amber-300">
            {stats && stats.nps > 0 ? `${(stats.nps / 1000).toFixed(1)}k/s` : '—'}
          </div>
        </div>

        <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
          <div className="text-[10px] text-slate-500 uppercase">Eval Score</div>
          <div
            className={`text-sm font-mono font-bold ${
              (stats?.score ?? 0) > 5000
                ? 'text-cyan-400'
                : (stats?.score ?? 0) < -5000
                ? 'text-rose-400'
                : 'text-slate-200'
            }`}
          >
            {stats ? (stats.score > 5_000_000 ? '+WIN' : stats.score < -5_000_000 ? '-WIN' : (stats.score / 1000).toFixed(1)) : '0.0'}
          </div>
        </div>
      </div>

      {/* PV Line */}
      {stats?.pvNotation && (
        <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 font-mono text-[11px]">
          <span className="text-slate-500 uppercase mr-1">Best Line (PV):</span>
          <span className="text-cyan-300">{stats.pvNotation}</span>
        </div>
      )}

      {/* Tactics Callout */}
      {stats?.tacticsNote && (
        <div className="bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 px-2.5 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1.5">
          <Zap size={13} className="text-cyan-400 shrink-0" />
          <span>{stats.tacticsNote}</span>
        </div>
      )}
    </div>
  );
};
