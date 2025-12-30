import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DragItem, ImageDemanded } from './types';
import { seededItems, type SeedOptions } from './utils';
import { useBookViewportMode } from './hooks/useBookViewportMode';
import { useInertialDragScroll } from './hooks/useInertialDragScroll';
import { useContinuousScroll } from './hooks/useContinuousScroll';
import { ClimateBookItem } from './ClimateBookItem';
import { useRealMobileViewport } from '../../utils/content-utility/real-mobile';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function wrap(n: number, size: number) {
  return ((n % size) + size) % size;
}
function hash01(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
function smoothstep01(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

type Packed = {
  id: string;
  baseX: number;
  baseY: number;
  hoverX: number;
  hoverY: number;
  zBase: number;
  zHover: number;
};

type Props = { raw: ImageDemanded[] };

export function ClimateBookCanvas({ raw }: Props) {
  const [items, setItems] = useState<DragItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollX, setScrollX] = useState(0);

  const mode = useBookViewportMode();
  const isRealMobile = useRealMobileViewport();

  // Track dragging (used to pause auto-scroll + block hover)
  const isDraggingRef = useRef(false);

  // Hover cooldown after drag ends
  const hoverCooldownUntilRef = useRef(0);
  const HOVER_COOLDOWN_MS = 1000;

  // Small parallax input (ref; no re-render spam)
  const parTargetRef = useRef({ nx: 0, ny: 0 });
  const parRef = useRef({ nx: 0, ny: 0 });

  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setBox({ w: r.width, h: r.height });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ===== Parallax listener + rAF smoothing =====
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf: number | null = null;

    const onMove = (e: PointerEvent) => {
      if (isRealMobile) return;
      if (isDraggingRef.current) return;

      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;

      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;

      const cx = clamp(x, 0, 1);
      const cy = clamp(y, 0, 1);

      parTargetRef.current.nx = (cx - 0.5) * 2;
      parTargetRef.current.ny = (cy - 0.5) * 2;
    };

    const onLeave = () => {
      parTargetRef.current.nx = 0;
      parTargetRef.current.ny = 0;
    };

    const tick = () => {
      const SMOOTH = 0.12;
      parRef.current.nx += (parTargetRef.current.nx - parRef.current.nx) * SMOOTH;
      parRef.current.ny += (parTargetRef.current.ny - parRef.current.ny) * SMOOTH;
      raf = requestAnimationFrame(tick);
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isRealMobile]);

  const layout = useMemo(() => {
    const H = box.h || 600;
    const halfH = H * 0.5;

    const yBias = mode === 'sm' ? -H * 0.06 : mode === 'md' ? -H * 0.055 : -H * 0.045;

    const bandSpread = mode === 'sm' ? 0.32 : mode === 'md' ? 0.40 : 0.34;
    const waveAmpPx = mode === 'sm' ? 88 : mode === 'md' ? 112 : 96;

    const yClampPad =
      mode === 'sm'
        ? clamp(H * 0.14, 72, 170)
        : mode === 'md'
        ? clamp(H * 0.10, 64, 150)
        : clamp(H * 0.13, 70, 165);

    const config =
      mode === 'sm'
        ? {
            width: 'clamp(260px, 76vw, 480px)',
            maxW: 480,
            seed: { baseW: 360, gap: -56, scaleMin: 0.9, scaleRange: 0.45 } as SeedOptions,
            canvasH: '98dvh',
            speed: 64,
          }
        : mode === 'md'
        ? {
            width: 'clamp(260px, 36vw, 520px)',
            maxW: 520,
            seed: { baseW: 420, gap: -70, scaleMin: 0.85, scaleRange: 0.5 } as SeedOptions,
            canvasH: '92dvh',
            speed: 72,
          }
        : {
            width: 'clamp(280px, 24vw, 560px)',
            maxW: 560,
            seed: { baseW: 500, gap: -90, scaleMin: 0.8, scaleRange: 0.55 } as SeedOptions,
            canvasH: '96dvh',
            speed: 80,
          };

    const parallaxPx = mode === 'sm' ? 10 : mode === 'md' ? 12 : 14;

    return { ...config, halfH, yBias, yClampPad, bandSpread, waveAmpPx, parallaxPx };
  }, [mode, box.h]);

  useEffect(() => {
    setItems(seededItems(raw, layout.seed));
  }, [raw, layout.seed]);

  // loop width
  const loopWidth = useMemo(() => {
    if (!items.length) return Math.max((box.w || 1200) * 2.0, 2200);

    const baseW = layout.seed.baseW ?? (mode === 'sm' ? 360 : mode === 'md' ? 420 : 500);
    const gap = layout.seed.gap ?? (mode === 'sm' ? -56 : mode === 'md' ? -70 : -90);
    const step = Math.max(220, baseW + gap);

    const bleed = step * 0.6;
    return step * items.length + bleed;
  }, [items.length, box.w, mode, layout.seed.baseW, layout.seed.gap]);

  useEffect(() => {
    if (!loopWidth || !Number.isFinite(loopWidth) || loopWidth <= 0) return;
    setScrollX((s) => ((s % loopWidth) + loopWidth) % loopWidth);
  }, [loopWidth]);

  // ✅ continuous scroll (unchanged behavior, just pauses on active/drag)
  useContinuousScroll({
    enabled: activeId === null && !isDraggingRef.current,
    setScrollX,
    speedPxPerSec: layout.speed,
  });

  // inertial drag
  const drag = useInertialDragScroll({ setScrollX, enabled: true });

  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    pressedItemId: string | null;
    dragging: boolean;
  } | null>(null);

  const TAP_SLOP = 10;
  const DRAG_START_SLOP = 8;

  const onPointerDown = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;

    el.setPointerCapture(e.pointerId);

    const target = e.target as HTMLElement | null;
    const hitItem = target?.closest?.('[data-climate-book-hitbox="1"]') as HTMLElement | null;
    const itemId = hitItem?.dataset?.itemId ?? null;

    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      pressedItemId: itemId,
      dragging: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (!g.dragging) {
      const dist = Math.hypot(dx, dy);
      if (dist > DRAG_START_SLOP && Math.abs(dx) > Math.abs(dy)) {
        g.dragging = true;
        isDraggingRef.current = true;

        setActiveId(null);

        drag.begin(e.pointerId, e.clientX);
        drag.setDragging(true);

        e.preventDefault();
        return;
      }
      return;
    }

    e.preventDefault();
    drag.dragBy(e.pointerId, e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;

    if (g.dragging) {
      drag.end(e.pointerId);
      isDraggingRef.current = false;

      hoverCooldownUntilRef.current = performance.now() + HOVER_COOLDOWN_MS;

      gestureRef.current = null;
      return;
    }

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const dist = Math.hypot(dx, dy);

    if (dist <= TAP_SLOP && isRealMobile && g.pressedItemId) {
      setActiveId((prev) => (prev === g.pressedItemId ? null : g.pressedItemId));
    } else if (dist <= TAP_SLOP && isRealMobile) {
      setActiveId(null);
    }

    gestureRef.current = null;
  };

  const hoverEnabled = !isDraggingRef.current && performance.now() > hoverCooldownUntilRef.current;

  // ✅ Packed positions:
  // - baseX/baseY: where the small hitbox stays (never clamped)
  // - hoverX/hoverY: where the big overlay is drawn (clamped to viewport)
  const packed = useMemo<Packed[]>(() => {
    if (!items.length) return [];

    const IMG_ASPECT = 264 / 352;
    const HOVER_SCALE = 2.2;

    const halfW = (box.w || 1200) * 0.5;
    const halfH = (box.h || 600) * 0.5;

    const EDGE_PAD = mode === 'sm' ? 10 : mode === 'md' ? 14 : 16;

    const parOn = !isRealMobile && activeId === null && !isDraggingRef.current;
    const px = parOn ? layout.parallaxPx : 0;
    const nx = parOn ? parRef.current.nx : 0;
    const ny = parOn ? parRef.current.ny : 0;

    return items.map((it) => {
      const worldX = it.baseX + scrollX;
      let x = wrap(worldX, loopWidth) - loopWidth * 0.5;

      const band = Math.floor(hash01(it.id + ':band') * 3);
      const bandOffset =
        band === 0
          ? -layout.halfH * layout.bandSpread
          : band === 1
          ? 0
          : layout.halfH * layout.bandSpread;

      const sizeK = smoothstep01(clamp((it.baseScale - 0.75) / 0.6, 0, 1));

      const bandAmp = band === 1 ? 0.35 : 0.78;
      const amp = bandAmp * (0.62 + (1 - sizeK) * 0.62);

      const dir =
        band === 0 ? -1 : band === 2 ? 1 : hash01(it.id + ':dir') < 0.5 ? -1 : 1;

      const phase = hash01(it.id + ':ph') * Math.PI * 2;
      const perVar = 0.92 + hash01(it.id + ':per') * 0.22;
      const wave = Math.sin(worldX / (1200 * perVar) + phase);

      let y = layout.yBias + bandOffset + dir * wave * amp * layout.waveAmpPx;
      y = clamp(y, -layout.halfH + layout.yClampPad, layout.halfH - layout.yClampPad);

      // Parallax additive (applies to both base + hover positions)
      const parWeight = 0.75 + (1 - sizeK) * 0.45;
      x += nx * px * parWeight;
      y += -ny * px * 0.75 * parWeight;

      const baseX = x;
      const baseY = y;

      // Compute hover (clamped) position
      let hoverX = x;
      let hoverY = y;

      const baseW = layout.maxW * it.baseScale;
      const baseH = baseW * IMG_ASPECT;
      const hoverW = baseW * HOVER_SCALE;
      const hoverH = baseH * HOVER_SCALE;

      const clampX = halfW - hoverW * 0.5 - EDGE_PAD;
      const clampY = halfH - hoverH * 0.5 - EDGE_PAD;

      const xLimit = Math.max(0, clampX);
      const yLimit = Math.max(0, clampY);

      hoverX = clamp(hoverX, -xLimit, xLimit);
      hoverY = clamp(hoverY, -yLimit, yLimit);

      const zBase = Math.floor(it.baseScale * 1000);
      const zHover = zBase + 100_000;

      return { id: it.id, baseX, baseY, hoverX, hoverY, zBase, zHover };
    });
  }, [
    items,
    scrollX,
    loopWidth,
    activeId,
    box.w,
    box.h,
    mode,
    layout.halfH,
    layout.yBias,
    layout.yClampPad,
    layout.bandSpread,
    layout.waveAmpPx,
    layout.maxW,
    layout.parallaxPx,
    isRealMobile,
  ]);

  const packedById = useMemo(() => {
    const m = new Map<string, Packed>();
    for (const p of packed) m.set(p.id, p);
    return m;
  }, [packed]);

  return (
    <div
      ref={containerRef}
      id="climate-book-canvas"
      className="tooltip-climate-book"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative',
        width: '100%',
        height: layout.canvasH,
        overflow: 'hidden',
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        touchAction: 'pan-y',
      }}
    >
      {items.map((it) => {
        const p = packedById.get(it.id);
        if (!p) return null;

        return (
          <ClimateBookItem
            key={it.id}
            item={it}
            hovered={activeId === it.id}
            hoverEnabled={hoverEnabled && !isRealMobile}
            onEnter={() => setActiveId(it.id)}
            onLeave={() => setActiveId((cur) => (cur === it.id ? null : cur))}
            isRealMobile={isRealMobile}
            width={layout.width}
            baseX={p.baseX}
            baseY={p.baseY}
            hoverX={p.hoverX}
            hoverY={p.hoverY}
            zBase={p.zBase}
            zHover={p.zHover}
          />
        );
      })}
    </div>
  );
}
