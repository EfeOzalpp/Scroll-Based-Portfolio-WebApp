import type { DragItem, ImageDemanded } from './types';

export function hash01(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function quantize(n: number, steps: number) {
  return Math.round(n * steps) / steps;
}

export type SeedOptions = {
  gap?: number;
  baseW?: number;

  laneGap?: number;
  laneJitter?: number;
  lanes?: number;

  yMicroJitter?: number;

  scaleMin?: number;
  scaleRange?: number;
  xJitter?: number;
};

export function seededItems(raw: ImageDemanded[], opts: SeedOptions = {}): DragItem[] {
  const items = raw.filter((r) => r?.image);

  const GAP = opts.gap ?? -55;
  const BASE_W = opts.baseW ?? 420;
  const worldStep = BASE_W + GAP;

  const LANE_GAP = opts.laneGap ?? 180;
  const LANE_JITTER = opts.laneJitter ?? 70;
  const LANES = Math.max(1, opts.lanes ?? 2);

  const Y_MICRO = opts.yMicroJitter ?? 0;

  const SCALE_MIN = opts.scaleMin ?? 0.7;
  const SCALE_RANGE = opts.scaleRange ?? 0.65;

  const X_JITTER = opts.xJitter ?? 220;

  return items.map((d, idx) => {
    const id = d.title || `book-${idx}`;

    const r1 = hash01(id + ':a');
    const r2 = hash01(id + ':b');

    // depth for "layer" feel + tie-breaking
    const depth = quantize(0.15 + r1 * 0.85, 7);

    // more size variety (many small, few big)
    const t = Math.pow(r2, 2.35);
    const baseScale = SCALE_MIN + t * SCALE_RANGE;

    const zBand = Math.floor(depth * 10);

    const lane = Math.floor(hash01(id + ':lane') * LANES);
    const denom = Math.max(1, LANES - 1);
    const laneCenter = (lane - (LANES - 1) / 2) * (LANE_GAP / denom);

    const jitter = ((hash01(id + ':y') - 0.5) * 2) * LANE_JITTER;
    const micro = ((hash01(id + ':ym') - 0.5) * 2) * Y_MICRO;

    // horizontal spread
    const xJitter = (r2 - 0.5) * X_JITTER;
    const lanePhase = (lane - (LANES - 1) / 2) * (worldStep * 0.24);

    return {
      id,
      alt: d.alt || d.title || 'Climate Book Art',
      image: d.image,

      baseX: idx * worldStep + xJitter + lanePhase,
      baseY: laneCenter + jitter + micro,

      depth,
      baseScale,
      zBand,
    };
  });
}
