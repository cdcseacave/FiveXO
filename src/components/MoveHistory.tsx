import React from 'react';
import type { Move } from '../engine/types';
import { History, Hash } from 'lucide-react';

interface MoveHistoryProps {
  history: Move[];
  onSelectMove: (x: number, y: number) => void;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({ history, onSelectMove }) => {
  const turns: Array<{ turnNumber: number; black?: Move; white?: Move }> = [];
  for (let i = 0; i < history.length; i += 2) {
    turns.push({
      turnNumber: Math.floor(i / 2) + 1,
      black: history[i],
      white: history[i + 1],
    });
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-xl text-xs text-slate-300">
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-950/60 border-b border-slate-800">
        <div className="flex items-center gap-1.5 font-bold text-slate-200">
          <History size={14} className="text-cyan-400" />
          <span>MOVE HISTORY</span>
        </div>
        <span className="font-mono text-[11px] text-slate-500">
          {history.length} {history.length === 1 ? 'move' : 'moves'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono">
        {turns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-6 text-center">
            <Hash size={24} className="mb-1 opacity-40" />
            <span>No moves placed yet</span>
          </div>
        ) : (
          turns.map(({ turnNumber, black, white }) => (
            <div
              key={turnNumber}
              className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/40 hover:bg-slate-800/40 transition-colors"
            >
              <span className="text-slate-500 w-8">{turnNumber}.</span>

              {black ? (
                <button
                  onClick={() => onSelectMove(black.x, black.y)}
                  className="flex-1 text-left text-cyan-300 hover:text-cyan-200 font-semibold px-1 rounded hover:bg-cyan-500/10"
                >
                  {black.notation}
                </button>
              ) : (
                <span className="flex-1 text-slate-600">—</span>
              )}

              {white ? (
                <button
                  onClick={() => onSelectMove(white.x, white.y)}
                  className="flex-1 text-left text-amber-300 hover:text-amber-200 font-semibold px-1 rounded hover:bg-amber-500/10"
                >
                  {white.notation}
                </button>
              ) : (
                <span className="flex-1 text-slate-600">—</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
