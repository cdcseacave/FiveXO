import React from 'react';
import type { GameMode, Player } from '../engine/types';
import {
  Users,
  Bot,
  Globe,
  RotateCcw,
  Redo2,
  Lightbulb,
  Eye,
  Volume2,
  VolumeX,
  Music,
  Settings,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import type { NetworkState } from '../network/peer-connection';

interface GameHeaderProps {
  mode: GameMode;
  currentTurn: Player;
  moveCount: number;
  evalScore: number;
  canUndo: boolean;
  canRedo: boolean;
  showThreats: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  networkState?: NetworkState;
  unreadChatCount?: number;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  onOpenLobby?: () => void;
  onSelectMode: (mode: GameMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onHint: () => void;
  onToggleThreats: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onOpenSettings: () => void;
  onNewGame: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  mode,
  currentTurn,
  moveCount,
  evalScore,
  canUndo,
  canRedo,
  showThreats,
  soundEnabled,
  musicEnabled,
  networkState,
  unreadChatCount = 0,
  isChatOpen = false,
  onToggleChat,
  onOpenLobby,
  onSelectMode,
  onUndo,
  onRedo,
  onHint,
  onToggleThreats,
  onToggleSound,
  onToggleMusic,
  onOpenSettings,
  onNewGame,
}) => {
  const blackWinPct = Math.max(
    5,
    Math.min(95, Math.round((1 / (1 + Math.exp(-evalScore / 80000))) * 100))
  );

  return (
    <header className="h-16 px-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Grid Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-cyan-500/20">
            5X
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-extrabold text-base tracking-wider text-slate-100 font-mono">
                FIVEXO
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                64x64
              </span>
            </div>
            <div className="text-[10px] text-slate-400">Five-in-a-Row • Gomoku</div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="hidden md:flex items-center gap-1 ml-4 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => onSelectMode('1v-ai')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === '1v-ai'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot size={14} /> 1 vs AI
          </button>
          <button
            onClick={() => onSelectMode('local-1v1')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === 'local-1v1'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={14} /> Pass & Play
          </button>
          <button
            onClick={() => onSelectMode('online-1v1')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === 'online-1v1'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe size={14} /> Online P2P
          </button>
          <button
            onClick={() => onSelectMode('ai-v-ai')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === 'ai-v-ai'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={14} /> AI vs AI
          </button>
        </div>
      </div>

      {/* Center: Turn Indicator & Advantage Bar */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
              currentTurn === 1
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-amber-950/60 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                currentTurn === 1
                  ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
              }`}
            />
            <span>{currentTurn === 1 ? 'PLAYER X (BLACK)' : 'PLAYER O (WHITE)'}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Move #{moveCount}</span>
        </div>

        {/* WebRTC Match Status Badge */}
        {mode === 'online-1v1' && networkState && (
          <button
            onClick={onOpenLobby}
            title="Click to view Room Details & Shareable Link"
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
              networkState.connected
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:bg-emerald-900/80'
                : 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)] hover:bg-amber-900/80'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                networkState.connected
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <span>
              {networkState.connected
                ? `CONNECTED (${networkState.role === 'host' ? 'Host: Black' : 'Guest: White'}) • ${networkState.pingMs}ms`
                : `WAITING FOR OPPONENT • Room: ${networkState.roomCode || '...'}`}
            </span>
          </button>
        )}

        {/* Evaluation Bar */}
        <div className="w-36 h-1.5 bg-amber-500/80 rounded-full overflow-hidden flex border border-slate-700/50" title={`Black: ${blackWinPct}% | White: ${100 - blackWinPct}%`}>
          <div
            className="h-full bg-cyan-400 transition-all duration-300"
            style={{ width: `${blackWinPct}%` }}
          />
        </div>
      </div>

      {/* Right: Actions Toolbar */}
      <div className="flex items-center gap-1">
        {mode === 'online-1v1' && onToggleChat && (
          <button
            onClick={onToggleChat}
            title="Toggle Match Chat"
            className={`relative p-2 rounded-lg transition-colors ${
              isChatOpen
                ? 'text-cyan-400 bg-cyan-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <MessageSquare size={16} />
            {unreadChatCount > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(244,63,94,0.8)]">
                {unreadChatCount}
              </span>
            )}
          </button>
        )}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo Move (Ctrl+Z)"
          className="p-2 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <RotateCcw size={16} />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo Move (Ctrl+Y)"
          className="p-2 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Redo2 size={16} />
        </button>

        <button
          onClick={onHint}
          title="AI Best Move Hint (H)"
          className="p-2 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Lightbulb size={16} />
        </button>

        <button
          onClick={onToggleThreats}
          title={showThreats ? 'Hide Threat Vision (T)' : 'Show Threat Vision (T)'}
          className={`p-2 rounded-lg transition-colors ${
            showThreats
              ? 'text-cyan-400 bg-cyan-500/20'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
        >
          <Eye size={16} />
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          className={`p-2 rounded-lg transition-colors ${
            soundEnabled
              ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
              : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <button
          onClick={onToggleMusic}
          title={musicEnabled ? 'Stop Ambient Music (M)' : 'Play Ambient Music (M)'}
          className={`p-2 rounded-lg transition-colors ${
            musicEnabled
              ? 'text-teal-400 bg-teal-500/20 shadow-[0_0_8px_rgba(20,184,166,0.4)]'
              : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          <Music size={16} />
        </button>

        <button
          onClick={onOpenSettings}
          title="Game Settings"
          className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Settings size={16} />
        </button>

        <button
          onClick={onNewGame}
          className="ml-2 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-cyan-600/20 transition-all"
        >
          New Game
        </button>
      </div>
    </header>
  );
};
