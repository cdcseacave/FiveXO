import { useState, useEffect, useRef, useCallback } from 'react';
import { Board } from './engine/board';
import type { GameMode, BoardTheme, AIDifficulty, Player, AIStats } from './engine/types';
import { BoardView } from './components/BoardView';
import { GameHeader } from './components/GameHeader';
import { EngineInsights } from './components/EngineInsights';
import { MoveHistory } from './components/MoveHistory';
import { LobbyModal } from './components/LobbyModal';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { sfx } from './audio/sound-effects';
import { bgm } from './audio/music-synthesizer';
import type { MusicTheme } from './audio/music-synthesizer';
import { PeerNetwork } from './network/peer-connection';
import type { NetworkState } from './network/peer-connection';
import { GomokuAI } from './ai/negamax';

export function App() {
  const [board] = useState<Board>(() => new Board());
  const [, setHistoryVersion] = useState<number>(0);
  const undoneStackRef = useRef<Array<[number, number]>>([]);

  // Game Settings & Modes
  const [mode, setMode] = useState<GameMode>('1v-ai');
  const [theme, setTheme] = useState<BoardTheme>('cyber');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('master');
  const [humanPlayer, setHumanPlayer] = useState<Player>(1); // Player 1 (X)
  const [centerTarget, setCenterTarget] = useState<[number, number] | null>(null);
  const [showThreats, setShowThreats] = useState<boolean>(false);

  // Audio State
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(false);
  const [musicTheme, setMusicTheme] = useState<MusicTheme>('zen');
  const [sfxVolume, setSfxVolume] = useState<number>(0.6);
  const [musicVolume, setMusicVolume] = useState<number>(0.35);

  // Modals
  const [isLobbyOpen, setIsLobbyOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGameOverOpen, setIsGameOverOpen] = useState<boolean>(false);

  // AI & Engine State
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [aiVsAiRunning, setAiVsAiRunning] = useState<boolean>(false);
  const [aiVsAiSpeed, setAiVsAiSpeed] = useState<number>(500);

  // Worker & Search
  const workerRef = useRef<Worker | null>(null);
  const searchReqIdRef = useRef<number>(0);
  const fallbackAiRef = useRef<GomokuAI | null>(null);

  // Network State
  const [networkState, setNetworkState] = useState<NetworkState>({
    connected: false,
    role: 'none',
    roomCode: null,
    remotePlayerName: 'Opponent',
    pingMs: 0,
  });
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([]);
  const networkRef = useRef<PeerNetwork | null>(null);

  // Initialize Worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('./ai/ai.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (err) {
      console.warn('[AI] Web Worker not supported, using fallback inline search:', err);
      fallbackAiRef.current = new GomokuAI();
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Initialize Network & check URL params
  useEffect(() => {
    const net = new PeerNetwork(
      (msg) => {
        if (msg.type === 'MOVE' && msg.payload) {
          const { x, y } = msg.payload;
          executeMove(x, y, true);
        } else if (msg.type === 'CHAT' && msg.payload) {
          setChatMessages((prev) => [
            ...prev,
            {
              sender: 'Opponent',
              text: msg.payload.text,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } else if (msg.type === 'RESTART') {
          resetGame();
        }
      },
      (state) => {
        setNetworkState(state);
      }
    );
    networkRef.current = net;

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setMode('online-1v1');
      setIsLobbyOpen(true);
      net.joinGame(roomParam).catch(console.error);
    }

    return () => {
      net.disconnect();
    };
  }, []);

  // Sync Audio Settings
  useEffect(() => {
    sfx.enabled = soundEnabled;
    sfx.volume = sfxVolume;
  }, [soundEnabled, sfxVolume]);

  useEffect(() => {
    bgm.setVolume(musicVolume);
    if (musicEnabled && musicTheme !== 'off') {
      bgm.start(musicTheme);
    } else {
      bgm.stop();
    }
  }, [musicEnabled, musicTheme, musicVolume]);

  const lastMove: [number, number] | null =
    board.history.length > 0
      ? [board.history[board.history.length - 1].x, board.history[board.history.length - 1].y]
      : null;

  // Execute Move
  const executeMove = useCallback(
    (x: number, y: number, isRemote: boolean = false): boolean => {
      if (board.winInfo || !board.isValid(x, y)) return false;

      const player = board.currentTurn;
      const success = board.makeMove(x, y);
      if (!success) return false;

      undoneStackRef.current = [];
      setHistoryVersion((v) => v + 1);

      sfx.playStoneClick(player);

      if (board.winInfo) {
        setAiVsAiRunning(false);
        sfx.playVictoryFanfare();
        setIsGameOverOpen(true);
        return true;
      }

      if (mode === 'online-1v1' && !isRemote && networkRef.current?.state.connected) {
        networkRef.current.sendMove(x, y, player);
      }

      return true;
    },
    [board, mode]
  );

  // Trigger AI Move
  const triggerAiTurn = useCallback(() => {
    if (board.winInfo || isAiThinking) return;

    setIsAiThinking(true);
    const reqId = ++searchReqIdRef.current;
    const currentTurn = board.currentTurn;

    if (workerRef.current) {
      let timeoutTimer: number | null = null;

      const handleMessage = (e: MessageEvent) => {
        if (e.data.id !== reqId) return;

        if (e.data.type === 'PROGRESS') {
          setAiStats(e.data.stats);
        } else if (e.data.type === 'DONE') {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          workerRef.current?.removeEventListener('message', handleMessage);
          setIsAiThinking(false);
          setAiStats(e.data.stats);

          if (e.data.move) {
            executeMove(e.data.move[0], e.data.move[1]);
          }
        }
      };

      // Fallback safeguard if worker hangs
      timeoutTimer = window.setTimeout(() => {
        console.warn('[AI] Worker timed out, executing fallback search');
        workerRef.current?.removeEventListener('message', handleMessage);
        const ai = fallbackAiRef.current || new GomokuAI();
        const res = ai.findBestMove(board, currentTurn, { difficulty, maxTimeMs: 400 });
        setIsAiThinking(false);
        setAiStats(res.stats);
        if (res.move) {
          executeMove(res.move[0], res.move[1]);
        }
      }, difficulty === 'master' ? 2500 : 1500);

      workerRef.current.addEventListener('message', handleMessage);
      workerRef.current.postMessage({
        id: reqId,
        type: 'SEARCH',
        cells: Array.from(board.cells),
        currentTurn,
        difficulty,
        history: [...board.history],
        maxTimeMs: difficulty === 'master' ? 1000 : difficulty === 'intermediate' ? 500 : 200,
      });
    } else {
      const ai = fallbackAiRef.current || new GomokuAI();
      setTimeout(() => {
        const res = ai.findBestMove(board, currentTurn, { difficulty, maxTimeMs: 600 });
        setIsAiThinking(false);
        setAiStats(res.stats);
        executeMove(res.move[0], res.move[1]);
      }, 30);
    }
  }, [board, isAiThinking, difficulty, executeMove]);

  useEffect(() => {
    if (board.winInfo) return;

    if (mode === '1v-ai' && board.currentTurn !== humanPlayer && !isAiThinking) {
      const timer = setTimeout(() => {
        triggerAiTurn();
      }, 150);
      return () => clearTimeout(timer);
    }

    if (mode === 'ai-v-ai' && aiVsAiRunning && !isAiThinking) {
      const timer = setTimeout(() => {
        triggerAiTurn();
      }, aiVsAiSpeed);
      return () => clearTimeout(timer);
    }
  }, [board.currentTurn, mode, humanPlayer, isAiThinking, aiVsAiRunning, aiVsAiSpeed, triggerAiTurn]);

  const resetGame = () => {
    board.reset();
    undoneStackRef.current = [];
    setAiStats(null);
    setIsAiThinking(false);
    setAiVsAiRunning(false);
    setIsGameOverOpen(false);
    setCenterTarget([32, 32]);
    setHistoryVersion((v) => v + 1);

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESET' });
    }
    sfx.playUiClick();
  };

  const handleUndo = () => {
    if (board.history.length === 0 || isAiThinking) return;

    const movesToUndo = mode === '1v-ai' && board.history.length >= 2 ? 2 : 1;
    for (let i = 0; i < movesToUndo; i++) {
      const last = board.undoMove();
      if (last) {
        undoneStackRef.current.push([last.x, last.y]);
      }
    }
    setAiStats(null);
    setIsGameOverOpen(false);
    setHistoryVersion((v) => v + 1);
    sfx.playUiClick();
  };

  const handleRedo = () => {
    if (undoneStackRef.current.length === 0 || isAiThinking) return;
    const [rx, ry] = undoneStackRef.current.pop()!;
    executeMove(rx, ry);
  };

  const handleHint = () => {
    if (board.winInfo || isAiThinking) return;
    const ai = new GomokuAI();
    const res = ai.findBestMove(board, board.currentTurn, { difficulty: 'master', maxTimeMs: 600 });
    setAiStats(res.stats);
    sfx.playThreatAlert();
  };

  const handleCellClick = (x: number, y: number) => {
    if (mode === '1v-ai' && board.currentTurn !== humanPlayer) return;
    if (mode === 'ai-v-ai') return;
    if (mode === 'online-1v1' && networkState.connected) {
      const myTurn = networkState.role === 'host' ? 1 : 2;
      if (board.currentTurn !== myTurn) return;
    }
    executeMove(x, y);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'h') {
        handleHint();
      } else if (e.key.toLowerCase() === 'm') {
        setMusicEnabled((m) => !m);
      } else if (e.key.toLowerCase() === 't') {
        setShowThreats((t) => !t);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header & Toolbar */}
      <GameHeader
        mode={mode}
        currentTurn={board.currentTurn}
        moveCount={board.history.length}
        evalScore={aiStats?.score ?? 0}
        canUndo={board.history.length > 0 && !isAiThinking}
        canRedo={undoneStackRef.current.length > 0 && !isAiThinking}
        showThreats={showThreats}
        soundEnabled={soundEnabled}
        musicEnabled={musicEnabled}
        onSelectMode={(newMode) => {
          setMode(newMode);
          if (newMode === 'online-1v1') setIsLobbyOpen(true);
          resetGame();
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onHint={handleHint}
        onToggleThreats={() => setShowThreats((t) => !t)}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        onToggleMusic={() => setMusicEnabled((m) => !m)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewGame={resetGame}
      />

      {/* Main Game Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 h-full relative">
          <BoardView
            board={board}
            theme={theme}
            currentTurn={board.currentTurn}
            winInfo={board.winInfo}
            lastMove={lastMove}
            centerTarget={centerTarget}
            showThreats={showThreats}
            onCellClick={handleCellClick}
            disabled={
              isAiThinking ||
              (mode === '1v-ai' && board.currentTurn !== humanPlayer) ||
              mode === 'ai-v-ai' ||
              (mode === 'online-1v1' &&
                networkState.connected &&
                board.currentTurn !== (networkState.role === 'host' ? 1 : 2))
            }
          />
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 h-full border-l border-slate-800/80 bg-slate-950/70 backdrop-blur-md p-3 flex flex-col gap-3 overflow-hidden z-20 hidden lg:flex">
          <EngineInsights
            stats={aiStats}
            mode={mode}
            aiVsAiRunning={aiVsAiRunning}
            aiVsAiSpeed={aiVsAiSpeed}
            onToggleAiVsAi={() => setAiVsAiRunning((r) => !r)}
            onStepAiVsAi={() => triggerAiTurn()}
            onChangeSpeed={(spd) => setAiVsAiSpeed(spd)}
          />

          <div className="flex-1 overflow-hidden">
            <MoveHistory
              history={board.history}
              onSelectMove={(x, y) => setCenterTarget([x, y])}
            />
          </div>
        </aside>
      </div>

      {/* Online Lobby Modal */}
      <LobbyModal
        isOpen={isLobbyOpen}
        networkState={networkState}
        onClose={() => setIsLobbyOpen(false)}
        onHost={async () => {
          if (networkRef.current) {
            await networkRef.current.hostGame();
          }
        }}
        onJoin={async (code) => {
          if (networkRef.current) {
            await networkRef.current.joinGame(code);
          }
        }}
        onDisconnect={() => {
          if (networkRef.current) {
            networkRef.current.disconnect();
          }
        }}
        onSendMessage={(text) => {
          if (networkRef.current) {
            networkRef.current.send({
              type: 'CHAT',
              payload: { text },
            });
            setChatMessages((prev) => [
              ...prev,
              {
                sender: 'You',
                text,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
        }}
        chatMessages={chatMessages}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onSelectTheme={setTheme}
        difficulty={difficulty}
        onSelectDifficulty={setDifficulty}
        humanPlayer={humanPlayer}
        onSelectHumanPlayer={setHumanPlayer}
        sfxVolume={sfxVolume}
        onChangeSfxVolume={setSfxVolume}
        musicTheme={musicTheme}
        onSelectMusicTheme={(m) => {
          setMusicTheme(m);
          setMusicEnabled(m !== 'off');
        }}
        musicVolume={musicVolume}
        onChangeMusicVolume={setMusicVolume}
      />

      {/* Game Over Victory Modal */}
      <GameOverModal
        isOpen={isGameOverOpen}
        winInfo={board.winInfo}
        mode={mode}
        moveCount={board.history.length}
        onNewGame={resetGame}
        onClose={() => setIsGameOverOpen(false)}
      />
    </div>
  );
}

export default App;
