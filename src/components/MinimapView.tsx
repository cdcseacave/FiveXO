import React, { useRef, useEffect, useCallback } from 'react';
import { Board } from '../engine/board';
import type { Camera } from '../graphics/board-renderer';
import { MinimapRenderer } from '../graphics/minimap';
import type { BoardTheme } from '../engine/types';
import { Maximize2 } from 'lucide-react';

interface MinimapViewProps {
  board: Board;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  theme: BoardTheme;
  onMinimapClick: (bx: number, by: number) => void;
}

export const MinimapView: React.FC<MinimapViewProps> = ({
  board,
  camera,
  viewportWidth,
  viewportHeight,
  theme,
  onMinimapClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<MinimapRenderer | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const FPS_CAP = 30;
  const FRAME_INTERVAL_MS = 1000 / FPS_CAP; // ~33.33ms
  const lastRenderTimeRef = useRef<number>(0);
  const scheduledFrameRef = useRef<number | null>(null);
  const scheduledTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new MinimapRenderer(canvasRef.current);
    }
  }, []);

  const doRender = useCallback(() => {
    if (rendererRef.current) {
      lastRenderTimeRef.current = performance.now();
      rendererRef.current.render(board, camera, viewportWidth, viewportHeight, theme);
    }
  }, [board, camera, viewportWidth, viewportHeight, theme]);

  const requestCappedRender = useCallback(() => {
    if (scheduledFrameRef.current !== null || scheduledTimerRef.current !== null) {
      return;
    }
    const now = performance.now();
    const elapsed = now - lastRenderTimeRef.current;
    if (elapsed >= FRAME_INTERVAL_MS) {
      scheduledFrameRef.current = requestAnimationFrame(() => {
        scheduledFrameRef.current = null;
        doRender();
      });
    } else {
      const waitMs = Math.max(1, Math.ceil(FRAME_INTERVAL_MS - elapsed));
      scheduledTimerRef.current = window.setTimeout(() => {
        scheduledTimerRef.current = null;
        scheduledFrameRef.current = requestAnimationFrame(() => {
          scheduledFrameRef.current = null;
          doRender();
        });
      }, waitMs);
    }
  }, [doRender]);

  // Render on-demand capped to 30 FPS
  useEffect(() => {
    requestCappedRender();
  }, [board, camera, viewportWidth, viewportHeight, theme, requestCappedRender]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scheduledFrameRef.current !== null) cancelAnimationFrame(scheduledFrameRef.current);
      if (scheduledTimerRef.current !== null) clearTimeout(scheduledTimerRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current && e.type !== 'pointerdown') return;
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const [bx, by] = rendererRef.current.screenToBoardCoord(mx, my);
    onMinimapClick(bx, by);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 bg-slate-900/85 backdrop-blur-md p-2 rounded-xl border border-slate-700/60 shadow-2xl flex flex-col items-center">
      <div className="flex items-center justify-between w-full px-1 pb-1 mb-1 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1 font-semibold text-cyan-400">
          <Maximize2 size={12} /> 64x64 RADAR
        </span>
        <span className="text-[10px] text-slate-500">Click to Pan</span>
      </div>
      <canvas
        ref={canvasRef}
        width={150}
        height={150}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="rounded-lg cursor-crosshair touch-none border border-slate-800 shadow-inner"
      />
    </div>
  );
};
