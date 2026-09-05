import React, { useState } from 'react';
import type { NetworkState } from '../network/peer-connection';
import { Globe, Copy, Check, Radio, Send, X, ArrowRight } from 'lucide-react';

interface LobbyModalProps {
  isOpen: boolean;
  networkState: NetworkState;
  onClose: () => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  onDisconnect: () => void;
  onSendMessage: (text: string) => void;
  chatMessages: Array<{ sender: string; text: string; time: string }>;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  isOpen,
  networkState,
  onClose,
  onHost,
  onJoin,
  onDisconnect,
  onSendMessage,
  chatMessages,
}) => {
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!networkState.roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${networkState.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    if (!networkState.roomCode) return;
    navigator.clipboard.writeText(networkState.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg mb-1">
          <Globe size={22} />
          <span>ONLINE 1VS1 MULTIPLAYER</span>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          Play peer-to-peer over the internet using WebRTC. Zero lag, direct browser connection.
        </p>

        {networkState.connected ? (
          <div className="space-y-4">
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-300">
                  Connected to {networkState.remotePlayerName}
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400/80">
                Ping: {networkState.pingMs}ms
              </span>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Room Code:</span>
              <span className="font-mono font-bold text-cyan-400 tracking-wider">
                {networkState.roomCode}
              </span>
              <span className="text-slate-400">Role:</span>
              <span className="font-semibold uppercase text-slate-300">
                {networkState.role === 'host' ? 'Host (Player X)' : 'Guest (Player O)'}
              </span>
            </div>

            <div className="flex flex-col h-40 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 text-xs font-sans">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-slate-600 py-6">Say hi to your opponent!</div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="flex flex-col">
                      <span className="text-[10px] text-slate-500">{msg.sender} • {msg.time}</span>
                      <span className="text-slate-200">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendChat} className="flex border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-200 outline-none"
                />
                <button
                  type="submit"
                  className="px-3 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={onDisconnect}
                className="px-4 py-2 bg-rose-950/60 text-rose-300 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-semibold transition-colors"
              >
                Disconnect
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all"
              >
                Return to Game
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex border-b border-slate-800 pb-1">
              <button
                onClick={() => setActiveTab('host')}
                className={`flex-1 pb-2 text-xs font-bold text-center border-b-2 transition-all ${
                  activeTab === 'host'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                Host Game
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`flex-1 pb-2 text-xs font-bold text-center border-b-2 transition-all ${
                  activeTab === 'join'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                Join Game
              </button>
            </div>

            {activeTab === 'host' ? (
              <div className="space-y-4">
                {networkState.roomCode ? (
                  <div className="space-y-3">
                    <div className="text-center p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
                        Your 6-Character Room Code
                      </div>
                      <div className="text-3xl font-black font-mono tracking-widest text-cyan-400">
                        {networkState.roomCode}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyCode}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copied ? 'Copied Code!' : 'Copy Room Code'}</span>
                      </button>

                      <button
                        onClick={handleCopyLink}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-bold transition-colors"
                      >
                        <Globe size={14} />
                        <span>Copy Invite Link</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2 animate-pulse">
                      <Radio size={14} className="text-cyan-400" />
                      <span>Waiting for opponent to connect...</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={onHost}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-extrabold rounded-xl text-sm shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Globe size={18} />
                    <span>Create Room & Get Code</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Enter Host Room Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. X7K9PQ"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-mono text-lg font-bold tracking-widest text-cyan-300 placeholder:text-slate-600 uppercase focus:border-cyan-400 outline-none"
                  />
                </div>

                <button
                  onClick={() => onJoin(joinCode)}
                  disabled={joinCode.trim().length !== 6}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-slate-950 font-extrabold rounded-xl text-sm shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <span>Connect & Join Game</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
