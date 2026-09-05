import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { WinInfo, GameMode } from '../engine/types';
import { Trophy, RotateCcw, Eye } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  winInfo: WinInfo | null;
  mode: GameMode;
  moveCount: number;
  onNewGame: () => void;
  onClose: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winInfo,
  mode,
  moveCount,
  onNewGame,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen && winInfo) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: winInfo.winner === 1 ? ['#06b6d4', '#22d3ee', '#38bdf8'] : ['#f59e0b', '#fbbf24', '#fde047'],
      });
    }
  }, [isOpen, winInfo]);

  if (!isOpen || !winInfo) return null;

  const winnerLabel =
    winInfo.winner === 1
      ? mode === '1v-ai'
        ? 'Player X (You) Won!'
        : 'Player X (Black) Won!'
      : mode === '1v-ai'
      ? 'Player O (AI) Won!'
      : 'Player O (White) Won!';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-200 text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-cyan-600 to-amber-500 flex items-center justify-center text-slate-950 shadow-xl shadow-cyan-500/20">
          <Trophy size={32} />
        </div>

        <h2 className="text-2xl font-black text-slate-100 tracking-wide mb-1">
          {winnerLabel}
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Five connected in a row on the 64x64 grand board in {moveCount} moves!
        </p>

        <div className="grid grid-cols-2 gap-2 mb-6 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="text-slate-500 block">Total Moves</span>
            <span className="text-lg font-mono font-bold text-slate-200">{moveCount}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Alignment</span>
            <span className="text-lg font-mono font-bold text-cyan-400">
              {winInfo.direction === 'H'
                ? 'Horizontal'
                : winInfo.direction === 'V'
                ? 'Vertical'
                : 'Diagonal'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onNewGame}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-extrabold rounded-xl text-sm shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            <span>Play Again</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Eye size={14} />
            <span>Inspect & Review Board</span>
          </button>
        </div>
      </div>
    </div>
  );
};
