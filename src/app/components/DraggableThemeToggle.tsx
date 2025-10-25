"use client";

import React, { useEffect, useRef, useState } from 'react';
import ThemeToggle from './ThemeToggle';

interface Position { x: number; y: number }
const STORAGE_KEY = 'themeTogglePosition';
const MARGIN = 8;

function clamp(pos: Position, el?: HTMLElement): Position {
  if (typeof window === 'undefined') return pos;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cw = el?.offsetWidth || 64;
  const ch = el?.offsetHeight || 48;
  return {
    x: Math.min(Math.max(pos.x, MARGIN), w - cw - MARGIN),
    y: Math.min(Math.max(pos.y, MARGIN), h - ch - MARGIN)
  };
}

export default function DraggableThemeToggle() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef<{ startX: number; startY: number; originX: number; originY: number; dragging: boolean }>({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    dragging: false,
  });
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  // Load or set initial position bottom-right (offset upward by 56px for visibility above edge)
  useEffect(() => {
    if (!containerRef.current) return;
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    let pos: Position | null = null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          pos = parsed;
        }
      } catch {}
    }
    const el = containerRef.current;
    if (!pos) {
      // default bottom-right slightly above bottom
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cw = el.offsetWidth || 72;
      const ch = el.offsetHeight || 56;
      const bottomOffset = 56; // raise above bottom edge
      pos = { x: w - cw - MARGIN - 8, y: h - ch - bottomOffset };
    }
    pos = clamp(pos, el);
    setPosition(pos);
    setInitialized(true);
  }, []);

  // Persist position
  useEffect(() => {
    if (!initialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch {}
  }, [position, initialized]);

  // Clamp on resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      setPosition(p => clamp(p, containerRef.current!));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pointer handlers (ignore direct clicks on the inner toggle button so click works)
  function onPointerDown(e: React.PointerEvent) {
    if (!containerRef.current) return;
    // If clicking the actual ThemeToggle button or its descendants, don't initiate drag
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button')) {
      return; // allow normal click to propagate
    }
    const el = containerRef.current;
    dragDataRef.current.dragging = true;
    dragDataRef.current.startX = e.clientX;
    dragDataRef.current.startY = e.clientY;
    dragDataRef.current.originX = position.x;
    dragDataRef.current.originY = position.y;
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragDataRef.current.dragging || !containerRef.current) return;
    const dx = e.clientX - dragDataRef.current.startX;
    const dy = e.clientY - dragDataRef.current.startY;
    const raw: Position = { x: dragDataRef.current.originX + dx, y: dragDataRef.current.originY + dy };
    setPosition(clamp(raw, containerRef.current));
  }

  function endDrag(e: React.PointerEvent) {
    if (!containerRef.current) return;
    if (dragDataRef.current.dragging) {
      dragDataRef.current.dragging = false;
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-[1000] cursor-grab active:cursor-grabbing touch-none select-none transition-all duration-300"
      style={{ left: position.x, top: position.y, animation: 'fadePop 0.6s ease-out' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="toolbar"
      aria-label="Theme toggle draggable container"
    >
      <div className="rounded-full shadow-lg ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-sm">
        <ThemeToggle />
      </div>
      <style jsx>{`
        @keyframes fadePop {
          0% { opacity:0; transform:translateY(12px) scale(.95); }
          60% { opacity:1; transform:translateY(-2px) scale(1.02); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
