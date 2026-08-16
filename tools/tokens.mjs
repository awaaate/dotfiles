// ═══════════════════════════════════════════════════════════════════════════
// Design tokens (single source of truth) — multi-theme
// ═══════════════════════════════════════════════════════════════════════════
//
// Authored in OKLCH so lightness steps are perceptually even, then resolved to
// sRGB hex. Every token below has ONE semantic job, documented inline. If a
// colour has no semantic job, it does not belong here.
//
// THE CENTRAL RULE
// ────────────────
// The accent is IDENTITY and FOCUS. It is never a STATE.
//   • Accent answers "where am I / what is active / whose thing is this".
//   • Green / amber / crimson / teal answer "what happened".
//
// HOW THEMES WORK
// ───────────────
// A theme is two hues: the accent, and the near-neutral cast of the ink ramp
// (by convention accent − 13°, the offset the original iris shipped with).
// Everything else — lightness stops, chroma taper, the five state colours,
// the tinted surfaces — is IDENTICAL across themes, so switching themes can
// never change what a colour MEANS, only what the identity looks like.
//
// `ACTIVE` picks the theme. Switching is a one-line edit here, then:
//     node tools/build.mjs && node tools/wallpaper.mjs && ./install.sh
//
// Every candidate in THEMES has been swept against the ΔE gates in
// check-contrast.mjs (accent vs every state ≥ 0.10 in OKLab), and the checker
// re-verifies ALL of them on every run — an entry that regresses fails the
// build even while inactive.

import { hex } from './color.mjs';

// ── Themes ──────────────────────────────────────────────────────────────────
// minΔE = distance to the nearest state colour at the accent's L/C, from a
// full-wheel sweep. The floor is 0.10; coral (hue 32°) died at 0.07-0.09,
// which is why nothing here sits in the 5°-40° band.
export const THEMES = {
  // Warm band. Sits BETWEEN error (22°) and warning (85°) but clears both
  // gates — chosen by preference for warmth, with the maths checked after.
  ember: { name: 'Ember', accentHue: 55 }, //   minΔE 0.128 vs error
  // The mathematical sweet spot: the highest minΔE anywhere on the wheel.
  fucsia: { name: 'Fucsia', accentHue: 330 }, // minΔE 0.171 vs special
  // The original. Chosen by measurement when the repo was redesigned.
  iris: { name: 'Iris', accentHue: 305 }, //    minΔE 0.120 vs special
  // Bubblegum. The warmest of the cool side; leans toward error emotionally.
  rosa: { name: 'Rosa', accentHue: 348 }, //    minΔE 0.130 vs error
  // Acid chartreuse, terminal-phosphor retro. Best contrast of the set.
  lima: { name: 'Lima', accentHue: 110 }, //    minΔE 0.122 vs success
  // The ONLY viable blue. At the standard accent lightness the whole
  // 195°-265° arc belongs to info (teal) and special (blue): a numeric
  // search over (hue, L, C) against every gate found a single pocket,
  // cyan-azure at 225° with the base dropped to L 0.68 — the darkest the
  // 4.5:1 text gate allows on bgBase. Deeper blues cannot exist under this
  // system without redesigning the state colours themselves.
  azur: { name: 'Azur', accentHue: 225, stops: { base: [0.68, 0.16] } }, // minΔE 0.117 vs special
};

export const ACTIVE = 'azur';

// ── States (shared by every theme) ──────────────────────────────────────────
// Each answers "what happened". None may be confused with any theme's accent,
// and the ΔE gates in check-contrast.mjs enforce that for every THEMES entry.
export const state = {
  success: hex(0.780, 0.150, 150), // green   — added lines, passing, connected
  info: hex(0.780, 0.110, 195), //    teal    — links, bash mode, ports, neutral info
  warning: hex(0.830, 0.140, 85), //  amber   — modified, pending, degraded
  // A true red (22°), not the rose-red the old coral accent forced it into.
  // Lightness is held high enough for 4.5:1 on bgPanel.
  error: hex(0.655, 0.200, 22), //    red     — removed lines, failing, errors
  special: hex(0.760, 0.130, 265), // blue    — meta, keywords, untracked
};

// ── Tinted surfaces (shared) ────────────────────────────────────────────────
// A block background that carries state (a failed tool call, a pending diff).
// Same lightness as bgPanel so blocks sit at one elevation; only the hue moves.
// Low enough chroma that body text still clears AAA on top.
export const tint = (hue) => hex(0.235, 0.032, hue);

export const surfaceTint = {
  pending: tint(85), //   amber   — running / queued
  success: tint(150), //  green   — completed
  error: tint(22), //     red     — failed
  special: tint(265), //  blue    — injected / meta
};

// Status colours for use ON bgChrome (shared).
//
// The normal set is tuned for a near-black terminal; on a surface as light as
// the chrome the darkest of them (error, L 0.65) falls to 2.6:1, under the
// 3:1 WCAG non-text minimum. A low-battery icon or an error dot on the bar
// has to be *seen*, so the chrome surface gets lifted variants rather than
// the surface being darkened back down to accommodate them.
//
// Same hues, same meanings — only lightness moves.
export const stateOnChrome = {
  success: hex(0.860, 0.140, 150),
  info: hex(0.860, 0.095, 195),
  warning: hex(0.900, 0.120, 85),
  error: hex(0.780, 0.170, 22),
  special: hex(0.850, 0.110, 265),
};

// ── Categorical wheel (shared pool) ─────────────────────────────────────────
// For labelling things that are merely DIFFERENT, not better or worse — cmux
// workspaces, and nothing else. Even hue spacing at fixed L and C means no
// entry is louder than its neighbours, so a workspace never looks more urgent
// than another just because of the colour it drew.
const CATEGORICAL_L = 0.72;
const CATEGORICAL_C = 0.145;
const WHEEL = [
  ['Rose', 340],
  ['Red', 22],
  ['Ember', 55],
  ['Amber', 85],
  ['Lime', 120],
  ['Green', 150],
  ['Jade', 175],
  ['Teal', 198],
  ['Sky', 225],
  ['Blue', 262],
  ['Iris', 305],
];

// ── Theme factory ───────────────────────────────────────────────────────────
// Everything hue-dependent is built here from the two theme hues. Lightness
// and chroma stops are constants of the SYSTEM, not of any one theme: that is
// what guarantees a theme switch preserves every contrast relationship the
// checker asserts.
export function makeTheme(slug) {
  const def = THEMES[slug];
  if (!def) throw new Error(`unknown theme "${slug}" — known: ${Object.keys(THEMES).join(', ')}`);
  const H_ACCENT = def.accentHue;
  // The ink cast follows the accent family at very low chroma, offset −13°
  // (the relationship the original iris shipped with). A warm accent on a
  // cold substrate looks dropped on top; on in-family near-neutrals it looks
  // chosen. Faint enough that text resolves to near-neutral and syntax
  // colours stay honest.
  const H_INK = (H_ACCENT - 13 + 360) % 360;

  // Neutral ramp. Chroma tapers as lightness rises: dark surfaces carry the
  // cast, text resolves to near-neutral.
  const ink = {
    0: hex(0.145, 0.012, H_INK), // deepest — terminal bg, app bg, wallpaper floor
    1: hex(0.190, 0.014, H_INK), // raised — sidebar, cards, statusline
    2: hex(0.235, 0.015, H_INK), // panel — tool blocks, floats, popups
    3: hex(0.285, 0.016, H_INK), // selection bg, hover, active row
    4: hex(0.355, 0.016, H_INK), // border muted — subtle dividers, indent guides
    5: hex(0.450, 0.015, H_INK), // border default — pane dividers, inactive edge
    6: hex(0.560, 0.013, H_INK), // dim — comments, timestamps, disabled
    7: hex(0.700, 0.011, H_INK), // muted — secondary text, labels, tool output
    8: hex(0.845, 0.008, H_INK), // body — primary text
    9: hex(0.955, 0.005, H_INK), // emphasis — headings, cursor, high contrast
  };

  // Identity. One hue, seven stops. `base` is THE accent; everything else
  // exists so hover, borders and washes stay in-family instead of reaching
  // for a new colour.
  //
  // The L/C ladder is a system default that a theme may override per-stop
  // (def.stops) — blue hues need it, because sRGB gives them their chroma at
  // a lower lightness than warm hues. The stops remain subject to every gate
  // in check-contrast.mjs (ramp climbs in L, one hue, contrast floors), so an
  // override can shift where a stop sits but never break what it guarantees.
  const STOPS = {
    // wash sits just below ink[3] in lightness with noticeably more chroma,
    // so a selected-and-focused row reads as "same elevation, the accent
    // owns it" while still clearing 3:1 against textDim.
    wash: [0.275, 0.070], //   tinted bg behind selected items
    deep: [0.450, 0.130], //   inactive-but-owned edges, underlines
    dim: [0.620, 0.160], //    secondary accent text, muted borders
    base: [0.720, 0.175], //   THE accent — focus ring, active pane, cursor
    bright: [0.835, 0.120], // hover, headings, emphasis-on-accent
    // Two stops above `bright`, so an intensity ramp can climb past the
    // accent without leaving its hue. Used by the reasoning-effort scale — a
    // hue change reads as a change of KIND, not of degree.
    pale: [0.905, 0.075],
    lit: [0.960, 0.035],
    ...def.stops,
  };
  const accent = Object.fromEntries(
    Object.entries(STOPS).map(([name, [L, C]]) => [name, hex(L, C, H_ACCENT)]),
  );

  // Chrome surface: the system bar and the notch island. Deliberately LIGHTER
  // than the border tone (ink[4], what JankyBorders draws for an inactive
  // window) so the desktop furniture reads as a distinct layer sitting above
  // the windows, rather than as another near-black slab merging into them.
  // The relationship is the point, not the value: check-contrast.mjs asserts
  // bgChrome is lighter than borderMuted, so nudging the ramp cannot silently
  // invert it.
  const bgChrome = hex(0.375, 0.014, H_INK);

  // Semantic surface / text assignments. Apps consume THESE, not the raw
  // ramp. One name, one job.
  const semantic = {
    bgBase: ink[0], //      window / terminal background
    bgRaised: ink[1], //    sidebar, statusline, tab bar
    bgPanel: ink[2], //     floating windows, tool call blocks, completion menu
    bgSelected: ink[3], //  selected row, visual selection, current line
    bgAccent: accent.wash, //selected-and-focused row

    borderMuted: ink[4], // indent guides, table rules, inactive dividers
    border: ink[5], //      pane dividers, float borders, inactive window edge
    borderFocus: accent.base, // focused pane, active window, focus ring

    textDim: ink[6], //     comments, timestamps, disabled, line numbers
    textMuted: ink[7], //   secondary text, labels, tool output, paths
    text: ink[8], //        body text
    textBright: ink[9], //  headings, cursor, emphasised text
    textAccent: accent.bright, // headings that carry identity, active labels
  };

  // ANSI 16. Normal = readable on bgBase; bright = emphasis, not noise.
  // black/white slots come from the ramp so terminal apps blend with the
  // chrome.
  const ansi = {
    // ink[3] rather than ink[2]: apps that print ANSI black as *foreground*
    // need it to be visible against the terminal background at all.
    black: ink[3],
    red: state.error,
    green: state.success,
    yellow: state.warning,
    blue: state.special, //    true blue 265°
    magenta: accent.base, //   the accent owns the magenta slot
    cyan: state.info, //       teal 195°
    white: ink[7],
    brightBlack: ink[5],
    brightRed: hex(0.750, 0.175, 22),
    brightGreen: hex(0.860, 0.140, 150),
    brightYellow: hex(0.900, 0.120, 85),
    brightBlue: hex(0.850, 0.110, 265),
    brightMagenta: accent.bright,
    brightCyan: hex(0.860, 0.095, 195),
    brightWhite: ink[9],
  };

  // Categorical palette: the theme's accent leads (it reads as "the default
  // one"); the rest of the wheel follows, minus anything within 12° of the
  // accent so the list never carries a near-duplicate.
  const dist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const categorical = Object.fromEntries(
    [
      [def.name, H_ACCENT],
      ...WHEEL.filter(([, hue]) => dist(hue, H_ACCENT) > 12),
    ].map(([name, hue]) => [name, hex(CATEGORICAL_L, CATEGORICAL_C, hue)]),
  );
  // One deliberately colourless entry, for workspaces that should not shout.
  categorical.Slate = ink[5];

  const meta = {
    name: def.name,
    slug,
    accent: accent.base,
    accentHue: H_ACCENT,
    inkHue: H_INK,
    appearance: 'dark',
  };

  return { ink, accent, bgChrome, semantic, ansi, categorical, meta };
}

// ── Active theme bindings ───────────────────────────────────────────────────
// Everything below is the ACTIVE theme, exported under the names the rest of
// the tooling has always imported. Consumers that need every theme (build,
// checker) import { THEMES, makeTheme } instead.
const T = makeTheme(ACTIVE);
export const ink = T.ink;
export const accent = T.accent;
export const bgChrome = T.bgChrome;
export const semantic = T.semantic;
export const ansi = T.ansi;
export const categorical = T.categorical;
export const meta = T.meta;

// ── Non-colour scales ───────────────────────────────────────────────────────
// Spacing is a 4px base with a 2px half-step for dense terminal chrome.
export const space = { xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24 };

// Radius: one soft value for large surfaces, one tight value for chips/pills.
// Anything smaller than 4px reads as an artefact at HiDPI, so there is no 2px.
export const radius = { tight: 4, soft: 8, round: 12, pill: 999 };

// Border widths. Only ONE surface may use `focus` at a time — see
// docs/DESIGN.md "focus hierarchy".
export const stroke = { hairline: 1, regular: 2, focus: 3, window: 4 };

// Motion: terminal chrome should feel instant. Anything above 180ms reads as
// lag when it sits next to text you are actively reading.
export const motion = {
  instant: 0,
  fast: 90, // hover, selection change
  base: 140, // pane focus change, notification in
  slow: 180, // window/workspace transitions
  easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
};

// Type scale for GUI surfaces (cmux markdown, sketchybar). Terminal type size
// is owned by Ghostty's font-size and is deliberately not duplicated here.
export const type = {
  micro: 10, // sketchybar secondary labels
  small: 11, // sketchybar primary labels
  body: 13, // cmux sidebar, UI body
  reading: 15, // cmux markdown body — long-form reading
  heading: 18,
};
