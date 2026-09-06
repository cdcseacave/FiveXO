import React, { useState, useRef, useEffect } from 'react';
import type { NetworkState } from '../network/peer-connection';
import { Send, Globe, Copy, Check, MessageSquare, X } from 'lucide-react';

interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}

interface InGameChatProps {
  networkState: NetworkState;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onOpenLobby?: () => void;
  onClose?: () => void;
  isFloating?: boolean;
}

const QUICK_REACTIONS = ['👋 Hi!', '👍 Nice move!', '😮 Wow!', '🤔 Thinking...', '🔥 Great game!', '🤝 Rematch?'];

export const InGameChat: React.FC<InGameChatProps> = ({
  networkState,
  messages,
  onSendMessage,
  onOpenLobby,
  onClose,
  isFloating = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleQuickReaction = (reaction: string) => {
    onSendMessage(reaction);
  };

  const handleCopyRoom = () => {
    if (!networkState.roomCode) return;
    navigator.clipboard?.writeText(networkState.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      className={`flex flex-col bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md ${
        isFloating
          ? 'w-80 h-96 fixed bottom-20 left-4 z-40 animate-scale-up'
          : 'h-80 w-full'
      }`}
    >
      {/* Header: Connection Status & Room Code */}
      <div className="px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              networkState.connected
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse'
            }`}
          />
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xs font-bold text-slate-100 flex items-center gap-1">
                <MessageSquare size={13} className="text-cyan-400" />
                <span>MATCH CHAT</span>
              </span>
              {networkState.connected && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-800/60">
                  {networkState.pingMs}ms
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">
              {networkState.connected
                ? `Playing vs ${networkState.remotePlayerName} (${
                    networkState.role === 'host' ? 'Host: Black' : 'Guest: White'
                  })`
                : 'Waiting for opponent...'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {networkState.roomCode && (
            <button
              onClick={handleCopyRoom}
              title="Copy Room Code"
              className="flex items-center gap-1 px-2 py-1 bg-slate-800/90 hover:bg-slate-700 text-[10px] font-mono font-bold text-cyan-300 rounded-lg border border-slate-700 transition-colors"
            >
              {copiedCode ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copiedCode ? 'Copied' : networkState.roomCode}</span>
            </button>
          )}

          {onOpenLobby && (
            <button
              onClick={onOpenLobby}
              title="View Lobby / Share Link"
              className="p-1.5 text-slate-400 hover:text-cyan-300 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Globe size={14} />
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              title="Minimize Chat"
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs font-sans">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-6 px-4">
            <MessageSquare size={24} className="text-slate-600 mb-2 opacity-60" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[10px] text-slate-500 mt-1">
              Send a quick reaction or message to your opponent below!
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender === 'You';
            return (
              <div
                key={i}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span
                    className={`text-[10px] font-semibold ${
                      isMe ? 'text-cyan-400' : 'text-amber-400'
                    }`}
                  >
                    {msg.sender}
                  </span>
                  <span className="text-[9px] text-slate-500">{msg.time}</span>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-2xl max-w-[85%] break-words leading-relaxed text-xs shadow-md ${
                    isMe
                      ? 'bg-cyan-600 text-slate-950 font-medium rounded-tr-xs'
                      : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reactions Bar */}
      <div className="px-2.5 py-1.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {QUICK_REACTIONS.map((r, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickReaction(r)}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-700 hover:text-cyan-300 text-[10px] text-slate-300 border border-slate-700/60 transition-colors"
          >
            {r}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-2 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5"
      >
        <input
          type="text"
          placeholder={networkState.connected ? 'Type a message...' : 'Connect first to chat...'}
          disabled={!networkState.connected}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!networkState.connected || !inputText.trim()}
          title="Send Message (Enter)"
          className="p-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-bold rounded-xl transition-colors shadow-sm"
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
};
