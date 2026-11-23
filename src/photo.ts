// Photographic math: colour temperature, stop scales, exposure, depth of field.

/** Kelvin → linear-ish sRGB triple in 0..1 (Tanner Helland approximation). */
export function kelvinToRGB(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

/** Full-stop and third-stop apertures photographers expect to see. */
export const APERTURES = [
  1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22,
];

export const SHUTTERS = [
  2, 1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320,
  1 / 500, 1 / 1000, 1 / 2000, 1 / 4000, 1 / 8000,
];

export const ISOS = [50, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 6400, 12800];

/** Flash power in stops below full power, in thirds: 0 → 1/1, -7 → 1/128. */
export const POWER_STOPS = Array.from({ length: 22 }, (_, i) => -7 + i / 3);

export const FOCAL_LENGTHS = [14, 18, 24, 28, 35, 40, 50, 60, 70, 85, 100, 105, 135, 150, 200];

/** Highest shutter speed at which a strobe fully exposes the frame. */
export const SYNC_SPEED = 1 / 250;

/** Incident-meter calibration constant (lux). */
export const METER_C = 250;

/** Shutter speed used for continuous light when exposure is on Auto. */
export const AUTO_SHUTTER = 1 / 125;

export function formatAperture(n: number): string {
  return `f/${n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n)}`;
}

export function formatShutter(t: number): string {
  if (t >= 1) return `${t}s`;
  return `1/${Math.round(1 / t)}`;
}

export function parseShutter(text: string): number | null {
  const raw = text.trim().toLowerCase();
  const frac = raw.match(/^1\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return 1 / parseFloat(frac[1]);
  const seconds = raw.endsWith('s') || raw.includes('.');
  const v = parseFloat(raw);
  if (!isFinite(v) || v <= 0) return null;
  // A bare whole number like "125" means 1/125, the way it shows on a camera.
  return seconds || v <= 2 ? v : 1 / v;
}

export function formatPower(stops: number): string {
  const whole = Math.floor(stops + 1e-6);
  const thirds = Math.round((stops - whole) * 3);
  const base = whole >= 0 ? '1/1' : `1/${Math.pow(2, -whole)}`;
  return thirds === 0 ? base : `${base} +${(thirds / 3).toFixed(1)}`;
}

export function nearest(list: number[], v: number): number {
  let best = list[0];
  for (const x of list) if (Math.abs(Math.log(x / v)) < Math.abs(Math.log(best / v))) best = x;
  return best;
}

export function nearestIndex(list: number[], v: number): number {
  return list.indexOf(nearest(list, v));
}

/** f-number needed for correct exposure given exposure H (lux·s) at the subject. */
export function meteredAperture(H: number, iso: number): number {
  return Math.sqrt(Math.max(H, 1e-9) * iso / METER_C);
}

export interface DofRange {
  near: number;
  far: number; // Infinity when beyond hyperfocal
  hyperfocal: number;
}

/** Depth of field limits (metres). f in mm, CoC 0.03 mm for full frame. */
export function depthOfField(focalMm: number, N: number, focusM: number, cocMm = 0.03): DofRange {
  const f = focalMm / 1000;
  const c = cocMm / 1000;
  const H = (f * f) / (N * c) + f;
  const s = focusM;
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s);
  return { near, far, hyperfocal: H };
}

export function formatDistance(m: number): string {
  if (!isFinite(m)) return '∞';
  if (m < 1) return `${Math.round(m * 100)} cm`;
  return `${m.toFixed(2)} m`;
}

/** White-balance gains that neutralise a source of the given Kelvin. */
export function whiteBalanceGains(kelvin: number): [number, number, number] {
  const [r, g, b] = kelvinToRGB(kelvin).map(srgbToLinear) as [number, number, number];
  // Normalise to keep overall brightness roughly constant.
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [lum / Math.max(r, 1e-3), lum / Math.max(g, 1e-3), lum / Math.max(b, 1e-3)];
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function stopsToRatio(stops: number): string {
  const r = Math.pow(2, stops);
  return r >= 10 ? `${Math.round(r)}:1` : `${r.toFixed(1).replace(/\.0$/, '')}:1`;
}
