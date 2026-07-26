// Color math for the Coral Ember design system.
// OKLCH is the authoring space (perceptually even lightness steps);
// sRGB hex is the output space. WCAG 2.1 is used for contrast gates.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ── OKLCH → sRGB ────────────────────────────────────────────────────────────

function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearSrgbToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const degamma = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function inGamut([r, g, b]) {
  const eps = 1e-5;
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
}

// Reduce chroma until the colour fits sRGB. Preserves L and H, which is what
// keeps a ramp perceptually even after clipping.
export function oklch(L, C, Hdeg) {
  const H = (Hdeg * Math.PI) / 180;
  let lo = 0;
  let hi = C;
  let rgb = oklabToLinearSrgb(L, C * Math.cos(H), C * Math.sin(H));
  if (!inGamut(rgb)) {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      rgb = oklabToLinearSrgb(L, mid * Math.cos(H), mid * Math.sin(H));
      if (inGamut(rgb)) lo = mid;
      else hi = mid;
    }
    rgb = oklabToLinearSrgb(L, lo * Math.cos(H), lo * Math.sin(H));
  }
  return rgb.map((c) => clamp01(gamma(c)));
}

export const hex = (L, C, H) =>
  '#' +
  oklch(L, C, H)
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('');

// ── sRGB → OKLCH (for auditing existing colours) ────────────────────────────

export function parseHex(s) {
  const h = s.trim().replace(/^#/, '').replace(/^0x/i, '');
  const rgb = h.length === 8 ? h.slice(2) : h; // tolerate 0xAARRGGBB
  return [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16) / 255);
}

export function hexToOklch(s) {
  const [r, g, b] = parseHex(s).map(degamma);
  const [L, a, bb] = linearSrgbToOklab(r, g, b);
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

// ── WCAG 2.1 contrast ───────────────────────────────────────────────────────

export function luminance(s) {
  const [r, g, b] = parseHex(s).map(degamma);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Perceptual distance in OKLab — used to prove two semantic colours are
// actually distinguishable, which plain contrast ratio does not capture.
export function deltaEOk(x, y) {
  const A = hexToOklch(x);
  const B = hexToOklch(y);
  const [a1, b1] = [A.C * Math.cos((A.H * Math.PI) / 180), A.C * Math.sin((A.H * Math.PI) / 180)];
  const [a2, b2] = [B.C * Math.cos((B.H * Math.PI) / 180), B.C * Math.sin((B.H * Math.PI) / 180)];
  return Math.hypot(A.L - B.L, a1 - a2, b1 - b2);
}

// ── Output helpers ──────────────────────────────────────────────────────────

/** #rrggbb → 0xAARRGGBB (sketchybar / borders format) */
export const argb = (h, alpha = 1) =>
  '0x' +
  Math.round(clamp01(alpha) * 255).toString(16).padStart(2, '0') +
  h.replace('#', '').toLowerCase();

/** #rrggbb → rrggbb (ghostty bare-hex format) */
export const bare = (h) => h.replace('#', '').toLowerCase();
