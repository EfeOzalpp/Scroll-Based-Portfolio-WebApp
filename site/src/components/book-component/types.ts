// src/components/book-component/types.ts
export type ImageDemanded = {
  title?: string;
  alt?: string;
  image?: any;
};

export type DragItem = {
  id: string;
  alt: string;
  image: any;

  // base layout in "world space"
  baseX: number;
  baseY: number;

  // 0..1 (0 far, 1 near)
  depth: number;

  // rendered size proxy
  baseScale: number;

  // quantized band for z-index
  zBand: number;
};
