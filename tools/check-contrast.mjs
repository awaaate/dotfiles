#!/usr/bin/env node
// Validation gate for the Iris palette.
// Exits non-zero if any rule fails, so it can run in CI or a pre-commit hook.
//
//   node tools/check-contrast.mjs          report + gate
//   node tools/check-contrast.mjs --ramp   also dump the resolved ramp

import { readFileSync } from 'node:fs';
import { contrast, deltaEOk, hexToOklch } from './color.mjs';
import { ink, accent, state, semantic, ansi, bgChrome, stateOnChrome } from './tokens.mjs';

let failures = 0;
const rows = [];

const fmt = (n, d = 2) => n.toFixed(d).padStart(d === 2 ? 5 : 6);

function gate(label, actual, min, unit = ':1') {
  const pass = actual >= min;
  if (!pass) failures++;
  rows.push(
    `${pass ? '  ok ' : ' FAIL'}  ${label.padEnd(46)} ${fmt(actual)}${unit}  (min ${min}${unit})`,
  );
}

// ── Text legibility on every background it can land on ──────────────────────
// WCAG AA is 4.5:1 for normal text. Terminal text is small and read for hours,
// so body text is held to AAA (7:1) instead.
console.log('\n── text on surfaces ' + '─'.repeat(56));
const surfaces = {
  bgBase: semantic.bgBase,
  bgRaised: semantic.bgRaised,
  bgPanel: semantic.bgPanel,
  bgSelected: semantic.bgSelected,
  bgAccent: semantic.bgAccent,
};
const texts = {
  text: [semantic.text, 7.0], //        body — AAA
  textBright: [semantic.textBright, 7.0],
  textMuted: [semantic.textMuted, 4.5], // secondary — AA
  textDim: [semantic.textDim, 3.0], //    comments — recessive by design,
  //                                      held to AA-large / non-text minimum
};
for (const [sn, sv] of Object.entries(surfaces)) {
  for (const [tn, [tv, min]] of Object.entries(texts)) {
    gate(`${tn} on ${sn}`, contrast(tv, sv), min);
  }
}
console.log(rows.splice(0).join('\n'));

// ── State colours must be readable wherever they are used ───────────────────
console.log('\n── state colours on surfaces ' + '─'.repeat(48));
for (const [n, v] of Object.entries(state)) {
  gate(`${n} on bgBase`, contrast(v, semantic.bgBase), 4.5);
  gate(`${n} on bgPanel`, contrast(v, semantic.bgPanel), 4.5);
}
gate('accent.base on bgBase', contrast(accent.base, semantic.bgBase), 4.5);
gate('accent.bright on bgBase', contrast(accent.bright, semantic.bgBase), 4.5);
gate('accent.bright on bgAccent', contrast(accent.bright, semantic.bgAccent), 4.5);
console.log(rows.splice(0).join('\n'));

// ── Non-text contrast (WCAG 1.4.11 requires 3:1 for UI affordances) ─────────
console.log('\n── borders & affordances ' + '─'.repeat(51));
gate('borderFocus on bgBase', contrast(semantic.borderFocus, semantic.bgBase), 3.0);
gate('borderFocus on bgRaised', contrast(semantic.borderFocus, semantic.bgRaised), 3.0);
gate('border on bgBase', contrast(semantic.border, semantic.bgBase), 1.5);
gate('borderMuted on bgBase', contrast(semantic.borderMuted, semantic.bgBase), 1.2);
// The focused pane must clearly out-rank the unfocused one, or the focus
// hierarchy collapses and every edge competes for attention.
gate('focus vs default border', contrast(semantic.borderFocus, semantic.border), 2.5);
console.log(rows.splice(0).join('\n'));

// ── Semantic separation ─────────────────────────────────────────────────────
// Contrast ratio cannot see hue, so two colours can both pass contrast and
// still be indistinguishable. OKLab ΔE catches that.
console.log('\n── semantic separation (OKLab ΔE) ' + '─'.repeat(42));
// The load-bearing one: identity must never be mistaken for failure.
gate('accent.base vs state.error', deltaEOk(accent.base, state.error), 0.1, 'ΔE');
gate('accent.bright vs state.error', deltaEOk(accent.bright, state.error), 0.1, 'ΔE');
gate('accent.base vs state.warning', deltaEOk(accent.base, state.warning), 0.1, 'ΔE');
// Diff readability: added vs removed is the most consequential pair on screen.
gate('success vs error', deltaEOk(state.success, state.error), 0.25, 'ΔE');
// Every state pair must be tellable apart at a glance.
const st = Object.entries(state);
for (let i = 0; i < st.length; i++) {
  for (let j = i + 1; j < st.length; j++) {
    gate(`${st[i][0]} vs ${st[j][0]}`, deltaEOk(st[i][1], st[j][1]), 0.1, 'ΔE');
  }
}
console.log(rows.splice(0).join('\n'));

// ── ANSI palette sanity ─────────────────────────────────────────────────────
console.log('\n── ansi palette on terminal bg ' + '─'.repeat(45));
for (const [n, v] of Object.entries(ansi)) {
  // black/brightBlack are background-ish slots; they are exempt from the text
  // gate but must still be visible as block fills.
  const min = n === 'black' || n === 'brightBlack' ? 1.2 : 4.5;
  gate(`ansi.${n}`, contrast(v, semantic.bgBase), min);
}
console.log(rows.splice(0).join('\n'));

// ── Ramp evenness ───────────────────────────────────────────────────────────
// A ramp with uneven steps produces surfaces that look arbitrarily stacked.
console.log('\n── neutral ramp monotonicity ' + '─'.repeat(47));
const Ls = Object.values(ink).map((h) => hexToOklch(h).L);
let monotonic = true;
for (let i = 1; i < Ls.length; i++) if (Ls[i] <= Ls[i - 1]) monotonic = false;
if (!monotonic) failures++;
console.log(`${monotonic ? '  ok ' : ' FAIL'}  ink ramp is strictly increasing in lightness`);

// ── Chrome surface ──────────────────────────────────────────────────────────
console.log('\n── chrome surface (bar + notch island) ' + '─'.repeat(37));
// The whole point of bgChrome is that it out-lightens the border tone. If the
// ramp is ever nudged the wrong way this inverts silently, so assert it.
gate('bgChrome vs borderMuted', hexToOklch(bgChrome).L / hexToOklch(semantic.borderMuted).L, 1.05, 'x');
gate('text on bgChrome', contrast(semantic.text, bgChrome), 4.5);
gate('textBright on bgChrome', contrast(semantic.textBright, bgChrome), 7.0);
gate('textDim on bgChrome', contrast(semantic.textDim, bgChrome), 1.4);
for (const [n, v] of Object.entries(stateOnChrome)) gate(`${n} on bgChrome`, contrast(v, bgChrome), 3.0);
gate('accent.bright on bgChrome', contrast(accent.bright, bgChrome), 3.0);
console.log(rows.splice(0).join('\n'));

// ── Documentation drift ─────────────────────────────────────────────────────
// The configs are generated, so they cannot drift — but the docs are written
// by hand and quote hex values, and they DID drift once: DESIGN.md carried an
// error colour from before a lightness adjustment. Any hex in the docs must
// resolve to a real token.
console.log('\n── documented hex values match tokens ' + '─'.repeat(38));
{
  const known = new Set(
    [...Object.values(ink), ...Object.values(accent), ...Object.values(state)].map((h) =>
      h.toLowerCase(),
    ),
  );
  const docsDir = new URL('../docs/', import.meta.url);
  let stale = 0;
  for (const file of ['DESIGN.md', 'AUDIT.md']) {
    let text;
    try {
      text = readFileSync(new URL(file, docsDir), 'utf8');
    } catch {
      continue;
    }
    // Only check hexes presented as OUR tokens — inside backticks in a table
    // row. AUDIT.md deliberately quotes foreign palettes (Kanagawa, TokyoNight)
    // and those must not be flagged.
    for (const [, hexVal] of text.matchAll(/^\|[^|]*\|\s*`(#[0-9a-fA-F]{6})`\s*\|/gm)) {
      if (!known.has(hexVal.toLowerCase())) {
        stale++;
        failures++;
        console.log(` FAIL  docs/${file}: ${hexVal} is not a current token value`);
      }
    }
  }
  if (stale === 0) console.log('  ok   every hex quoted as a token in docs/ resolves');
}

if (process.argv.includes('--ramp')) {
  console.log('\n── resolved values ' + '─'.repeat(57));
  const dump = (label, obj) => {
    console.log(`\n  ${label}`);
    for (const [k, v] of Object.entries(obj)) {
      const { L, C, H } = hexToOklch(v);
      console.log(
        `    ${k.padEnd(12)} ${v}   L ${L.toFixed(3)}  C ${C.toFixed(3)}  H ${H.toFixed(0).padStart(3)}°`,
      );
    }
  };
  dump('ink', ink);
  dump('accent', accent);
  dump('state', state);
  dump('ansi', ansi);
}

console.log(
  '\n' + '═'.repeat(76) + `\n${failures === 0 ? 'PASS' : `FAIL — ${failures} rule(s) violated`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
