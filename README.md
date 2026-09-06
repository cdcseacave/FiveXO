# FiveXO (64x64 Grand Gomoku & SOTA Classical AI)

**FiveXO** is a high-performance, web-based Five-in-a-Row (Gomoku / Connect5) application played on an expansive **64x64 grid** (4,096 cells). It features a tournament-grade classical AI player (built completely without Machine Learning), smooth 60fps pan & zoom with an interactive radar minimap, procedural Web Audio sound effects & ambient generative music, and serverless WebRTC peer-to-peer online multiplayer.

---

## 🌟 Key Highlights

### 1. 🤖 Tournament-Grade Non-ML Classical AI
Designed specifically for the vast 64x64 grid based on modern game theory and competitive Gomoku tournament engines (such as Yixin / Embryo):
- **Threat-Space Search (TSS)**: Focuses calculation on forced sequences, drastically cutting branching factor.
- **Victory by Continuous Fours (VCF) Solver**: Deep recursive DFS looking for consecutive 4-threat winning sequences (searching 10–16 plies deep in milliseconds).
- **Principal Variation Search (PVS) with Alpha-Beta Pruning**: Negamax framework with null-window searches for optimal pruning.
- **Zobrist Hashing & Transposition Table**: 64-bit BigInt hash table for $O(1)$ state caching across 4,096 cells.
- **Locality-Constrained Candidate Generation**: Dynamically tracks Chebyshev neighborhood ($d \le 2$) of placed stones, shrinking candidate moves from 4,096 to ~15–35 viable cells.
- **Directional Pattern Evaluator**: Evaluates Win (5), Live 4, Blocked 4, Live 3, Blocked 3, Live 2, and double threats.
- **Dedicated Web Worker**: The AI engine runs on a background worker thread (`ai.worker.ts`), keeping the 60fps UI buttery smooth with zero frame drops.
- **Real-Time Search Metrics**: Live display of search depth, nodes visited, speed (NPS), evaluation score, and principal variation (PV line).

### 2. 🎮 Game Modes
- **1 vs AI**: Challenge the AI at *Casual* (Beginner), *Challenger* (Intermediate), or *Grandmaster* (SOTA Master) strength.
- **Pass & Play (1 vs 1 Local)**: Two players sharing the same device.
- **AI vs AI (Spectator Mode)**: Watch the AI battle itself with adjustable turn speed (0.1s to 1.5s per move), pause/resume, and step controls.
- **Online 1 vs 1 (WebRTC P2P)**:
  - Connect directly browser-to-browser over the internet using a 6-character room code (e.g. `X7K9PQ`) or shareable URL link.
  - Zero server lag, real-time move synchronization, latency ping display, and in-game chat.

### 3. 🎨 Visuals, Navigation & Themes
- **Infinite 64x64 Viewport**:
  - Mouse wheel zoom, click-and-drag pan, touch pinch-to-zoom, and touch panning.
  - Viewport culling: only visible cells are rendered, maintaining steady 60+ FPS.
  - Precision coordinate rulers (A..BL, 1..64) and star points.
  - Last-move pulsing halo and coordinate callout.
  - Threat vision overlay: highlights active 3s, 4s, and double threats.
  - Winning 5-in-a-row laser beam with celebratory confetti particle explosion.
- **64x64 Radar Minimap**:
  - Corner radar widget rendering all placed stones at micro-scale.
  - Interactive camera frustum rectangle: click or drag on the minimap to instantly jump anywhere on the 64x64 grid.
- **Three Premium Visual Themes**:
  - **Neo Cyber**: Sci-fi dark slate carbon board with glowing cyan/amber holographic stones.
  - **Zen Dojo**: Japanese Kaya wood board texture with authentic Kuroki slate and clam shell stones.
  - **Clean Light**: Crisp modern minimalist monochrome aesthetic.

### 4. 🔊 Procedural Web Audio & Ambient Music
- **Tactile Stone Placement Snap**: Dual-layer synthesized acoustic clack (bandpass noise burst + woody resonance thump).
- **Tactical Chimes**: High threat warning chime, victory fanfare chord arpeggio, and defeat chord.
- **Procedural Ambient Music**: Generative pentatonic chord progressions and atmospheric synth pads via Web Audio API oscillators and resonant filters.
- **100% Offline**: Zero external audio files or network dependencies.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v20.17+ or v22+ LTS recommended)
- npm

### Installation & Development
```bash
# Clone or navigate to the directory
cd FiveXO

# Install dependencies
npm install

# Run Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

### Running Unit Tests
```bash
npm test
```

### Production Build
```bash
npm run build
npm run preview
```

---

## ⌨️ Keyboard Shortcuts
| Key | Action |
| --- | --- |
| `Ctrl + Z` | Undo last move |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo move |
| `H` | AI Best Move Hint |
| `T` | Toggle Threat Vision Overlay |
| `M` | Toggle Ambient Background Music |
| `+` / `-` | Zoom in / Zoom out |

---

## 📁 Architecture Overview
```
FiveXO/
├── src/
│   ├── ai/
│   │   ├── ai.worker.ts        # Dedicated Web Worker for background search
│   │   ├── negamax.ts          # PVS Alpha-Beta search, iterative deepening
│   │   ├── patterns.ts         # Directional line pattern evaluator
│   │   ├── transposition.ts    # Transposition Table
│   │   ├── vcf.ts              # Victory by Continuous Fours (VCF) solver
│   │   └── zobrist.ts          # 64-bit Zobrist hashing for 4,096 cells
│   ├── audio/
│   │   ├── music-synthesizer.ts# Generative procedural ambient BGM
│   │   └── sound-effects.ts    # Tactile stone clack, warning & fanfare SFX
│   ├── components/
│   │   ├── BoardView.tsx       # 60fps pan/zoom Canvas viewport
│   │   ├── EngineInsights.tsx  # Live AI search metrics & PV line
│   │   ├── GameHeader.tsx      # Top bar, eval bar, action controls
│   │   ├── GameOverModal.tsx   # Victory celebration with confetti
│   │   ├── LobbyModal.tsx      # WebRTC P2P room hosting & joining
│   │   ├── MinimapView.tsx     # 64x64 interactive radar minimap
│   │   ├── MoveHistory.tsx     # Algebraic notation move history
│   │   └── SettingsModal.tsx   # Themes, AI difficulty, and audio sliders
│   ├── engine/
│   │   ├── board.ts            # High performance 64x64 typed array board
│   │   └── types.ts            # Game types, coordinates, and notations
│   ├── graphics/
│   │   ├── board-renderer.ts   # Canvas 2D viewport-culled renderer
│   │   └── minimap.ts          # Radar canvas renderer
│   ├── network/
│   │   └── peer-connection.ts  # PeerJS WebRTC peer-to-peer manager
│   ├── App.tsx                 # Root application
│   └── main.tsx                # React entry point
└── tests/
    ├── ai.test.ts              # AI tactical test suite (wins, blocks, VCF)
    └── board.test.ts           # 64x64 coordinates, win detection, undo/redo
```
