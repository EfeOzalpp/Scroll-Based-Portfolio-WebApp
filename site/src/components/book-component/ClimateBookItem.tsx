import React, { useMemo } from 'react';
import type { DragItem } from './types';
import MediaLoader from '../../utils/media-providers/media-loader';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

type Props = {
  item: DragItem;
  hovered: boolean;

  onEnter: () => void;
  onLeave: () => void;

  isRealMobile: boolean;
  hoverEnabled?: boolean;

  width: string;

  // NEW: base position (stable hitbox)
  baseX: number;
  baseY: number;
  zBase: number;

  // NEW: hover position (clamped overlay)
  hoverX: number;
  hoverY: number;
  zHover: number;

  tiltX?: number;
  tiltY?: number;
  onPointerMoveItem?: (e: React.PointerEvent) => void;
};

export function ClimateBookItem({
  item,
  hovered,
  onEnter,
  onLeave,
  isRealMobile,
  hoverEnabled = true,
  width,
  baseX,
  baseY,
  zBase,
  hoverX,
  hoverY,
  zHover,
  tiltX = 0,
  tiltY = 0,
  onPointerMoveItem,
}: Props) {
  const HOVER_SCALE = 2.2;

  const baseCenter = 'translate(-50%, -50%)';

  // Stable base transform (never moves when hovered)
  const baseTransform = `${baseCenter} translate3d(${baseX}px, ${baseY}px, 0) scale(${
    item.baseScale
  })`;

  // Hover overlay transform (clamped inward, scaled up)
  const hoverTransform = `${baseCenter} translate3d(${hoverX}px, ${hoverY}px, 0) perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${
    item.baseScale * HOVER_SCALE
  })`;

  const img = useMemo(() => {
    const dpr =
      typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 2;

    const approxRenderedW = 420;
    const hoverW = clamp(Math.ceil(approxRenderedW * HOVER_SCALE * item.baseScale * dpr), 1600, 4032);
    const highW = clamp(Math.ceil(approxRenderedW * 1.15 * item.baseScale * dpr), 1200, 2600);

    return { highW, hoverW };
  }, [item.baseScale]);

  return (
    <>
      {/* ✅ Stable hitbox (controls hover). DOES NOT MOVE when hovered. */}
      <div
        data-climate-book-hitbox="1"
        data-item-id={item.id}
        onPointerEnter={(e) => {
          if (isRealMobile) return;
          if (!hoverEnabled) return;
          e.stopPropagation();
          onEnter();
        }}
        onPointerLeave={(e) => {
          if (isRealMobile) return;
          if (!hoverEnabled) return;
          e.stopPropagation();
          onLeave();
        }}
        onPointerMove={(e) => {
          if (!hovered) return;
          if (isRealMobile) return;
          onPointerMoveItem?.(e);
        }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width,
          zIndex: zBase,
          transform: baseTransform,
          transformOrigin: 'center center',
          willChange: 'transform',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: 'default',
          pointerEvents: 'auto',
          transition: 'none',
          transformStyle: 'flat',
        }}
      >
        {/* Base image uses normal/high */}
        <MediaLoader
          type="image"
          src={item.image}
          alt={item.alt}
          className="tooltip-none"
          objectPosition="center center"
          hovered={false as any}
          imgHighWidth={img.highW}
          imgHighQuality={96}
          imgHoverWidth={img.hoverW as any}
          imgHoverQuality={100 as any}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            pointerEvents: 'none',
            borderRadius: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
          }}
        />
      </div>

      {/* ✅ Hover overlay (visual only). Pointer events disabled so hover can't break. */}
      {hovered && !isRealMobile && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width,
            zIndex: zHover,
            transform: hoverTransform,
            transformOrigin: 'center center',
            willChange: 'transform',
            pointerEvents: 'none', // ✅ critical
            transition: 'none',
            transformStyle: 'preserve-3d',
          }}
        >
          <MediaLoader
            type="image"
            src={item.image}
            alt={item.alt}
            className="tooltip-none"
            objectPosition="center center"
            hovered={true as any} // triggers your hi-res/hover variant
            imgHighWidth={img.highW}
            imgHighQuality={96}
            imgHoverWidth={img.hoverW as any}
            imgHoverQuality={100 as any}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              pointerEvents: 'none',
              borderRadius: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          />
        </div>
      )}
    </>
  );
}
