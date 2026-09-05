import React from 'react';
import type { BoardTheme, AIDifficulty, Player } from '../engine/types';
import type { MusicTheme } from '../audio/music-synthesizer';
import { Settings, Volume2, Music, Palette, Cpu, X, BookOpen, User } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: BoardTheme;
  onSelectTheme: (t: BoardTheme) => void;
  difficulty: AIDifficulty;
  onSelectDifficulty: (d: AIDifficulty) => void;
  humanPlayer: Player;
  onSelectHumanPlayer: (p: Player) => void;
  sfxVolume: number;
  onChangeSfxVolume: (v: number) => void;
  musicTheme: MusicTheme;
  onSelectMusicTheme: (m: MusicTheme) => void;
  musicVolume: number;
  onChangeMusicVolume: (v: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onSelectTheme,
  difficulty,
  onSelectDifficulty,
  humanPlayer,
  onSelectHumanPlayer,
  sfxVolume,
  onChangeSfxVolume,
  musicTheme,
  onSelectMusicTheme,
  musicVolume,
  onChangeMusicVolume,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg mb-4">
          <Settings size={22} />
          <span>GAME SETTINGS</span>
        </div>

        <div className="space-y-5 text-xs">
          <div>
            <label className="flex items-center gap-1.5 font-bold text-slate-300 mb-2">
              <Palette size={14} className="text-cyan-400" />
              <span>VISUAL THEME</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'cyber', name: 'Neo Cyber', desc: 'Dark Slate & Cyan' },
                  { id: 'zen', name: 'Zen Dojo', desc: 'Kaya Wood & Slate' },
                  { id: 'light', name: 'Clean Light', desc: 'Modern Crisp' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTheme(t.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    theme === t.id
                      ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold">{t.name}</div>
                  <div className="text-[10px] text-slate-500">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-bold text-slate-300 mb-2">
              <Cpu size={14} className="text-cyan-400" />
              <span>AI PLAYER STRENGTH (NON-ML SOTA)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'beginner', name: 'Casual', desc: 'Pattern Heuristics' },
                  { id: 'intermediate', name: 'Challenger', desc: 'Alpha-Beta D4' },
                  { id: 'master', name: 'Grandmaster', desc: 'VCF + PVS + TT' },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  onClick={() => onSelectDifficulty(d.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    difficulty === d.id
                      ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold">{d.name}</div>
                  <div className="text-[10px] text-slate-500">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-bold text-slate-300 mb-2">
              <User size={14} className="text-cyan-400" />
              <span>YOUR PIECE (VS AI)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSelectHumanPlayer(1)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  humanPlayer === 1
                    ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>Player X (Black)</span>
                </div>
                <div className="text-[10px] text-slate-500">First move advantage</div>
              </button>

              <button
                onClick={() => onSelectHumanPlayer(2)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  humanPlayer === 2
                    ? 'bg-amber-500/15 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Player O (White)</span>
                </div>
                <div className="text-[10px] text-slate-500">AI plays first move</div>
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-bold text-slate-300 mb-2">
              <Volume2 size={14} className="text-cyan-400" />
              <span>SOUND EFFECTS (WEB AUDIO SYNTHESIZER)</span>
            </label>
            <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={sfxVolume}
                onChange={(e) => onChangeSfxVolume(Number(e.target.value))}
                className="flex-1 accent-cyan-400 cursor-pointer"
              />
              <span className="font-mono text-slate-400 w-10 text-right">
                {Math.round(sfxVolume * 100)}%
              </span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-bold text-slate-300 mb-2">
              <Music size={14} className="text-cyan-400" />
              <span>PROCEDURAL AMBIENT MUSIC</span>
            </label>
            <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {(['zen', 'cyber', 'off'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onSelectMusicTheme(m)}
                    className={`py-1.5 px-2 rounded-lg text-center font-semibold capitalize transition-all ${
                      musicTheme === m
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'off' ? 'Mute' : `${m} Ambient`}
                  </button>
                ))}
              </div>

              {musicTheme !== 'off' && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] text-slate-500">Music Vol:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={musicVolume}
                    onChange={(e) => onChangeMusicVolume(Number(e.target.value))}
                    className="flex-1 accent-cyan-400 cursor-pointer"
                  />
                  <span className="font-mono text-slate-400 w-10 text-right">
                    {Math.round(musicVolume * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-cyan-400">
              <BookOpen size={14} />
              <span>RULES & NAVIGATION</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Place 5 stones in an unbroken row horizontally, vertically, or diagonally on the 64x64 grid to win. Drag mouse or swipe to pan freely. Scroll wheel or pinch to zoom.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-bold transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
