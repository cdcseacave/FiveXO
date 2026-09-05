import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Board } from '../engine/board';
import { BoardRenderer, CELL_PIXELS, RULER_MARGIN, BOARD_PIXEL_SIZE } from '../graphics/board-renderer';
import type { Camera } from '../graphics/board-renderer';
import type { BoardTheme, Player, WinInfo } from '../engine/types';
import { MinimapView } from './MinimapView';
import { ZoomIn, ZoomOut, Maximize, Target, Compass } from 'lucide-react';
import { coordsToNotation } from '../engine/board';

interface BoardViewProps {
  board: Board;
  theme: BoardTheme;
  currentTurn: Player;
  winInfo: WinInfo | null;
  lastMove: [number, number] | null;
  centerTarget?: [number, number] | null;
  showThreats: boolean;
  onCellClick: (x: number, y: number) => void;
  disabled?: boolean;
}

export const BoardView: React.FC<BoardViewProps> = ({
  board,
  theme,
  currentTurn,
  winInfo,
  lastMove,
  centerTarget,
  showThreats,
  onCellClick,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);

  // Camera state
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.8 });
  const cameraRef = useRef<Camera>(camera);
  cameraRef.current = camera;

  const [hoverCoord, setHoverCoord] = useState<[number, number] | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Drag tracking
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; camX: number; camY: number }>({
    x: 0,
    y: 0,
    camX: 0,
    camY: 0,
  });
  const dragDistanceRef = useRef<number>(0);

  // Pinch to zoom tracking
  const touchDistanceRef = useRef<number | null>(null);

  // Center camera on coordinate (bx, by)
  const centerOnCoord = useCallback((bx: number, by: number, zoom?: number) => {
    let width = viewportSize.width;
    let height = viewportSize.height;
    if ((width === 0 || height === 0) && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }
    const targetScale = zoom ?? cameraRef.current.scale;
    const worldX = RULER_MARGIN + (bx + 0.5) * CELL_PIXELS;
    const worldY = RULER_MARGIN + (by + 0.5) * CELL_PIXELS;

    const newX = width / 2 - worldX * targetScale;
    const newY = height / 2 - worldY * targetScale;

    setCamera({
      x: newX,
      y: newY,
      scale: targetScale,
    });
  }, [viewportSize]);

  // Fit entire 64x64 board in viewport
  const fitBoardToView = useCallback(() => {
    let width = viewportSize.width;
    let height = viewportSize.height;
    if ((width === 0 || height === 0) && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }
    const scale = Math.max(0.12, Math.min(width, height) / (BOARD_PIXEL_SIZE + 40));
    const newX = (width - BOARD_PIXEL_SIZE * scale) / 2;
    const newY = (height - BOARD_PIXEL_SIZE * scale) / 2;
    setCamera({ x: newX, y: newY, scale });
  }, [viewportSize]);

  // Initial center on board tracker
  const hasCenteredInitialRef = useRef<boolean>(false);

  // Resize listener & robust initial center
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      setViewportSize({ width: rect.width, height: rect.height });
      if (canvasRef.current && rendererRef.current) {
        rendererRef.current.resize(rect.width, rect.height);
      }

      if (!hasCenteredInitialRef.current) {
        hasCenteredInitialRef.current = true;
        const targetScale = 0.75;
        const targetX = lastMove ? lastMove[0] : 32;
        const targetY = lastMove ? lastMove[1] : 32;
        const worldX = RULER_MARGIN + (targetX + 0.5) * CELL_PIXELS;
        const worldY = RULER_MARGIN + (targetY + 0.5) * CELL_PIXELS;
        const newX = rect.width / 2 - worldX * targetScale;
        const newY = rect.height / 2 - worldY * targetScale;
        setCamera({
          x: newX,
          y: newY,
          scale: targetScale,
        });
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [lastMove]);

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new BoardRenderer(canvasRef.current);
    }
  }, []);

  // Animation render loop
  useEffect(() => {
    let animId: number;
    const renderLoop = (time: number) => {
      if (rendererRef.current && canvasRef.current) {
        rendererRef.current.render(
          board,
          cameraRef.current,
          viewportSize.width,
          viewportSize.height,
          {
            theme,
            hoverCoord,
            currentTurn,
            showThreats,
            lastMove,
            winInfo,
            animTime: time,
          }
        );
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [board, theme, hoverCoord, currentTurn, showThreats, lastMove, winInfo, viewportSize]);

  // Auto-center on new last move if off-screen
  useEffect(() => {
    if (lastMove) {
      const [lx, ly] = lastMove;
      const [sx, sy] = rendererRef.current?.boardToScreen(lx, ly, cameraRef.current) || [0, 0];
      const margin = 80;
      if (
        sx < margin ||
        sx > viewportSize.width - margin ||
        sy < margin ||
        sy > viewportSize.height - margin
      ) {
        centerOnCoord(lx, ly);
      }
    }
  }, [lastMove, centerOnCoord, viewportSize]);

  // Center on explicit coordinate request (e.g. from Move History click)
  useEffect(() => {
    if (centerTarget) {
      centerOnCoord(centerTarget[0], centerTarget[1], 1.1);
    }
  }, [centerTarget, centerOnCoord]);

  // Mouse Wheel Zoom centered on cursor
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.12, Math.min(3.5, camera.scale * zoomFactor));

    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - camera.x) / camera.scale;
    const worldY = (mouseY - camera.y) / camera.scale;

    const newX = mouseX - worldX * newScale;
    const newY = mouseY - worldY * newScale;

    setCamera({ x: newX, y: newY, scale: newScale });
  };

  // Mouse Down: Start Pan
  const dragStartTimeRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // only left click
    isDraggingRef.current = true;
    dragDistanceRef.current = 0;
    dragStartTimeRef.current = Date.now();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      camX: camera.x,
      camY: camera.y,
    };
  };

  // Mouse Move: Pan or update hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const dist = Math.hypot(dx, dy);
      dragDistanceRef.current = dist;

      // Only move camera if mouse dragged at least 3px
      if (dist >= 3) {
        setCamera({
          ...cameraRef.current,
          x: dragStartRef.current.camX + dx,
          y: dragStartRef.current.camY + dy,
        });
      }
    }

    if (rendererRef.current && !disabled) {
      const coord = rendererRef.current.screenToBoard(mouseX, mouseY, cameraRef.current);
      setHoverCoord(coord);
    }
  };

  // Mouse Up: Place stone if click
  const handleMouseUp = () => {
    const elapsed = Date.now() - dragStartTimeRef.current;
    const isClick = dragDistanceRef.current < 12 || (elapsed < 300 && dragDistanceRef.current < 22);

    if (isDraggingRef.current && isClick && !disabled && !winInfo) {
      const canvas = canvasRef.current;
      if (canvas && rendererRef.current) {
        const rect = canvas.getBoundingClientRect();
        // Use the initial mousedown coordinates for precision click
        const clickX = dragStartRef.current.x - rect.left;
        const clickY = dragStartRef.current.y - rect.top;
        const coord = rendererRef.current.screenToBoard(clickX, clickY, cameraRef.current);
        if (coord && board.isValid(coord[0], coord[1])) {
          onCellClick(coord[0], coord[1]);
        }
      }
    }
    isDraggingRef.current = false;
  };

  // Touch Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragDistanceRef.current = 0;
      dragStartTimeRef.current = Date.now();
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        camX: camera.x,
        camY: camera.y,
      };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      const dist = Math.hypot(dx, dy);
      dragDistanceRef.current = dist;

      if (dist >= 3) {
        setCamera({
          ...cameraRef.current,
          x: dragStartRef.current.camX + dx,
          y: dragStartRef.current.camY + dy,
        });
      }
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchDistanceRef.current;
      const newScale = Math.max(0.12, Math.min(3.5, camera.scale * factor));

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = canvasRef.current!.getBoundingClientRect();
      const canvasMidX = midX - rect.left;
      const canvasMidY = midY - rect.top;

      const worldX = (canvasMidX - camera.x) / camera.scale;
      const worldY = (canvasMidY - camera.y) / camera.scale;

      setCamera({
        x: canvasMidX - worldX * newScale,
        y: canvasMidY - worldY * newScale,
        scale: newScale,
      });
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const elapsed = Date.now() - dragStartTimeRef.current;
    const isClick = dragDistanceRef.current < 16 || (elapsed < 350 && dragDistanceRef.current < 28);

    if (e.changedTouches.length === 1 && isClick && !disabled && !winInfo) {
      const canvas = canvasRef.current;
      if (canvas && rendererRef.current) {
        const rect = canvas.getBoundingClientRect();
        const touchX = dragStartRef.current.x - rect.left;
        const touchY = dragStartRef.current.y - rect.top;
        const coord = rendererRef.current.screenToBoard(touchX, touchY, cameraRef.current);
        if (coord && board.isValid(coord[0], coord[1])) {
          onCellClick(coord[0], coord[1]);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isDraggingRef.current = false;
          setHoverCoord(null);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Minimap Radar */}
      <MinimapView
        board={board}
        camera={camera}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        theme={theme}
        onMinimapClick={(bx, by) => centerOnCoord(bx, by)}
      />

      {/* Floating Viewport Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-xl text-slate-300">
        <button
          onClick={() => setCamera((c) => ({ ...c, scale: Math.min(3.5, c.scale * 1.25) }))}
          title="Zoom In"
          className="p-2 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-lg transition-colors"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => setCamera((c) => ({ ...c, scale: Math.max(0.12, c.scale * 0.8) }))}
          title="Zoom Out"
          className="p-2 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-lg transition-colors"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={fitBoardToView}
          title="Fit Entire 64x64 Board"
          className="p-2 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-lg transition-colors"
        >
          <Maximize size={18} />
        </button>
        {lastMove && (
          <button
            onClick={() => centerOnCoord(lastMove[0], lastMove[1], 1.0)}
            title="Focus on Last Move"
            className="p-2 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-lg transition-colors text-amber-400"
          >
            <Target size={18} />
          </button>
        )}
        <button
          onClick={() => centerOnCoord(32, 32, 0.75)}
          title="Center on Board"
          className="p-2 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-lg transition-colors"
        >
          <Compass size={18} />
        </button>
      </div>

      {/* Coordinate & Zoom Indicator Badge */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/60 text-xs font-mono text-slate-400 shadow-xl">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Zoom: <strong className="text-slate-200">{Math.round(camera.scale * 100)}%</strong>
        </span>
        {hoverCoord && (
          <span className="border-l border-slate-700 pl-3">
            Hover: <strong className="text-cyan-300">{coordsToNotation(hoverCoord[0], hoverCoord[1])}</strong>{' '}
            <span className="text-slate-500">({hoverCoord[0]}, {hoverCoord[1]})</span>
          </span>
        )}
      </div>
    </div>
  );
};
