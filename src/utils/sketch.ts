/**
 * El-çizimi (wobbly) SVG yol üreticileri.
 * Rastgelelik YOK — koordinata bağlı deterministik küçük sapmalar (sin tabanlı),
 * böylece her render'da titremez ama "elle çizilmiş" hissi verir.
 */

function wobble(seed: number, amplitude: number): number {
  // 0 etrafında salınan deterministik küçük offset
  return Math.sin(seed * 12.9898) * amplitude;
}

/**
 * Hafif kusurlu, köşeleri yumuşak bir dikdörtgen yolu üretir.
 * Kenarların ortasında küçük quadratic sapmalar var.
 */
export function wobblyRectPath(w: number, h: number, inset = 4): string {
  if (w <= 0 || h <= 0) return '';
  const a = 1.5; // sapma genliği
  const x0 = inset + wobble(1, a);
  const y0 = inset + wobble(2, a);
  const x1 = w - inset + wobble(3, a);
  const y1 = h - inset + wobble(4, a);

  const midTopX = w / 2 + wobble(5, a);
  const midTopY = y0 + wobble(6, a);
  const midRightX = x1 + wobble(7, a);
  const midRightY = h / 2 + wobble(8, a);
  const midBotX = w / 2 + wobble(9, a);
  const midBotY = y1 + wobble(10, a);
  const midLeftX = x0 + wobble(11, a);
  const midLeftY = h / 2 + wobble(12, a);

  return [
    `M ${x0.toFixed(1)},${y0.toFixed(1)}`,
    `Q ${midTopX.toFixed(1)},${midTopY.toFixed(1)} ${x1.toFixed(1)},${y0.toFixed(1)}`,
    `Q ${midRightX.toFixed(1)},${midRightY.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`,
    `Q ${midBotX.toFixed(1)},${midBotY.toFixed(1)} ${x0.toFixed(1)},${y1.toFixed(1)}`,
    `Q ${midLeftX.toFixed(1)},${midLeftY.toFixed(1)} ${x0.toFixed(1)},${y0.toFixed(1)}`,
    'Z',
  ].join(' ');
}

/**
 * Yazar adı altına çizilecek dalgalı (S-eğrili) çizgi yolu.
 */
export function wavyLinePath(w: number, amplitude = 2.5): string {
  if (w <= 0) return '';
  const y = amplitude + 1;
  const q = w / 4;
  return [
    `M 0,${y}`,
    `Q ${q.toFixed(1)},${(y - amplitude).toFixed(1)} ${(q * 2).toFixed(1)},${y}`,
    `Q ${(q * 3).toFixed(1)},${(y + amplitude).toFixed(1)} ${w.toFixed(1)},${y}`,
  ].join(' ');
}

/**
 * Kalemle çiziktirilmiş gibi köşeli/titrek dikdörtgen (karakalem his).
 * Her kenarda birkaç ara nokta + deterministik jitter. `phase` farklı geçiş üretir.
 */
export function roughRectPath(w: number, h: number, inset = 5, phase = 0): string {
  if (w <= 0 || h <= 0) return '';
  const a = 2.4;
  const j = (n: number) => wobble(n + phase * 7.3, a);
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const tx = (f: number) => x0 + (x1 - x0) * f;
  const ty = (f: number) => y0 + (y1 - y0) * f;
  const p = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
  return [
    `M ${p(x0 + j(1), y0 + j(2))}`,
    `L ${p(tx(0.34) + j(3), y0 + j(4))}`,
    `L ${p(tx(0.67) + j(5), y0 + j(6))}`,
    `L ${p(x1 + j(7), y0 + j(8))}`,
    `L ${p(x1 + j(9), ty(0.34) + j(10))}`,
    `L ${p(x1 + j(11), ty(0.67) + j(12))}`,
    `L ${p(x1 + j(13), y1 + j(14))}`,
    `L ${p(tx(0.67) + j(15), y1 + j(16))}`,
    `L ${p(tx(0.34) + j(17), y1 + j(18))}`,
    `L ${p(x0 + j(19), y1 + j(20))}`,
    `L ${p(x0 + j(21), ty(0.67) + j(22))}`,
    `L ${p(x0 + j(23), ty(0.34) + j(24))}`,
    'Z',
  ].join(' ');
}

/**
 * Bir bölgenin dört köşesine "elle çizilmiş köşe parantezi" ( ⌐ ¬ ) yolları.
 */
export function cornerBracketPaths(w: number, h: number, len = 18, inset = 2): string[] {
  if (w <= 0 || h <= 0) return [];
  const a = 1.2;
  const j = (n: number) => wobble(n, a);
  const xl = inset;
  const xr = w - inset;
  const yt = inset;
  const yb = h - inset;
  return [
    // sol-üst
    `M ${xl + len + j(1)},${yt + j(2)} L ${xl + j(3)},${yt + j(4)} L ${xl + j(5)},${yt + len + j(6)}`,
    // sağ-üst
    `M ${xr - len + j(7)},${yt + j(8)} L ${xr + j(9)},${yt + j(10)} L ${xr + j(11)},${yt + len + j(12)}`,
    // sol-alt
    `M ${xl + j(13)},${yb - len + j(14)} L ${xl + j(15)},${yb + j(16)} L ${xl + len + j(17)},${yb + j(18)}`,
    // sağ-alt
    `M ${xr + j(19)},${yb - len + j(20)} L ${xr + j(21)},${yb + j(22)} L ${xr - len + j(23)},${yb + j(24)}`,
  ];
}

/** Splash için yatay fırça-darbesi yolu (soldan sağa çizilir). */
export function brushStrokePath(w: number, h: number): string {
  if (w <= 0) return '';
  const midY = h / 2;
  const q = w / 6;
  return [
    `M 2,${(midY + 2).toFixed(1)}`,
    `Q ${q.toFixed(1)},${(midY - 3).toFixed(1)} ${(q * 2).toFixed(1)},${midY.toFixed(1)}`,
    `Q ${(q * 3).toFixed(1)},${(midY + 3).toFixed(1)} ${(q * 4).toFixed(1)},${(midY - 1).toFixed(1)}`,
    `Q ${(q * 5).toFixed(1)},${(midY - 4).toFixed(1)} ${(w - 2).toFixed(1)},${midY.toFixed(1)}`,
  ].join(' ');
}

/** Deterministik grain noktaları (PaperBackground için). */
export function grainDots(
  w: number,
  h: number,
  count = 80
): { x: number; y: number; r: number; o: number }[] {
  const dots: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < count; i++) {
    const sx = Math.abs(Math.sin(i * 12.9898) * 43758.5453);
    const sy = Math.abs(Math.sin(i * 78.233) * 43758.5453);
    const so = Math.abs(Math.sin(i * 4.123) * 1000);
    dots.push({
      x: (sx % 1) * w,
      y: (sy % 1) * h,
      r: 0.6 + (so % 1) * 0.7,
      o: 0.04 + (so % 1) * 0.07,
    });
  }
  return dots;
}
