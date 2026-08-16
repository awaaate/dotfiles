#!/usr/bin/env node
// Validates the pi configuration against the INSTALLED pi, not against the
// online docs. Exits non-zero on any problem.
//
//   node tools/check-pi.mjs
//
// This exists because pi fails silently in several places, each of which cost
// real debugging time:
//
//   • keybindings.json is read with a bare JSON.parse inside
//     `catch { return undefined }`. One trailing comma or one // comment and
//     the WHOLE file is discarded — every custom binding gone, no error, no
//     warning, no log line. JSONC is not supported despite the file being
//     hand-edited config.
//   • Unknown keybinding ids are kept as "extras" rather than rejected, so a
//     typo'd id looks fine and simply never fires.
//   • A typo in a theme `vars` name falls back to the stock dark theme
//     silently.
//
// So: parse it the same way pi does, then check every id actually exists.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { meta } from './tokens.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => {
  failures++;
  console.log(` FAIL  ${m}`);
};

// ── Locate the installed pi ─────────────────────────────────────────────────
const PI_ROOT = '/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent';
if (!existsSync(PI_ROOT)) {
  console.log(`  skip  pi not installed at ${PI_ROOT}`);
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(join(PI_ROOT, 'package.json'), 'utf8'));
console.log(`\n── pi ${pkg.version} ${'─'.repeat(58)}`);

// ── Theme ───────────────────────────────────────────────────────────────────
{
  const schemaPath = join(
    PI_ROOT,
    'dist/modes/interactive/theme/theme-schema.json',
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const valid = new Set(Object.keys(schema.properties.colors.properties));
  const theme = JSON.parse(readFileSync(join(ROOT, `pi/themes/${meta.slug}.json`), 'utf8'));
  const mine = Object.keys(theme.colors);

  const extra = mine.filter((k) => !valid.has(k));
  const missing = [...valid].filter((k) => !mine.includes(k));

  // additionalProperties:false — an unknown key is a hard load error.
  if (extra.length) bad(`theme has ${extra.length} invalid key(s): ${extra.join(', ')}`);
  else ok(`theme: ${mine.length}/${valid.size} keys, none invalid`);
  if (missing.length) bad(`theme missing ${missing.length} key(s): ${missing.join(', ')}`);

  // Literal hex only. `vars` indirection is the silent-fallback trap.
  const nonHex = Object.entries(theme.colors).filter(([, v]) => !/^#[0-9a-f]{6}$/i.test(v));
  if (nonHex.length) bad(`theme has non-literal colours: ${nonHex.map(([k]) => k).join(', ')}`);
  else ok('theme: every value is a literal hex, no vars indirection to mistype');
}

// ── Keybindings ─────────────────────────────────────────────────────────────
{
  const path = join(ROOT, 'pi/keybindings.json');
  const raw = readFileSync(path, 'utf8');

  // Exactly how pi parses it: strict JSON, no comments, no trailing commas.
  let parsed;
  try {
    parsed = JSON.parse(raw);
    ok('keybindings: strict JSON (pi discards the whole file on a parse error)');
  } catch (e) {
    bad(`keybindings: JSON.parse failed — pi would SILENTLY ignore every binding. ${e.message}`);
    parsed = null;
  }

  if (parsed) {
    // KEYBINDINGS is not exported, so the id list is read out of the built
    // sources — and it lives in TWO packages: `app.*` ids in the agent,
    // `tui.*` ids in pi-tui, which KeybindingsManager inherits from. Reading
    // only the first reports every editor binding as unknown.
    const sources = [
      join(PI_ROOT, 'dist/core/keybindings.js'),
      join(PI_ROOT, 'node_modules/@earendil-works/pi-tui/dist/keybindings.js'),
    ].filter(existsSync);

    const ids = new Set();
    for (const f of sources) {
      const src = readFileSync(f, 'utf8');
      // Require a dotted segment after the namespace so filenames like
      // "tui.d.ts" cannot masquerade as ids.
      for (const m of src.matchAll(/["']((?:app|tui)\.[a-zA-Z]+\.[a-zA-Z.]+)["']/g)) {
        ids.add(m[1]);
      }
    }

    if (ids.size < 20) {
      bad(`could not extract the keybinding id list (found ${ids.size}) — check the parser`);
    } else {
      const unknown = Object.keys(parsed).filter((k) => !ids.has(k));
      if (unknown.length) {
        // Kept as "extras" by pi and never fired: looks configured, does nothing.
        bad(`keybindings: unknown id(s), these will silently never fire: ${unknown.join(', ')}`);
      } else {
        ok(`keybindings: all ${Object.keys(parsed).length} ids exist in pi ${pkg.version}`);
      }

      // A binding that shadows a default the user relies on is worse than none.
      const RESERVED = { 'ctrl+p': 'app.model.cycleForward', 'ctrl+t': 'app.thinking.toggle' };
      for (const [id, keys] of Object.entries(parsed)) {
        for (const k of [].concat(keys)) {
          if (RESERVED[k] && RESERVED[k] !== id) {
            bad(`keybindings: ${id} binds ${k}, which pi uses for ${RESERVED[k]}`);
          }
        }
      }
    }

  }
}

// ── Settings ────────────────────────────────────────────────────────────────
{
  const s = JSON.parse(readFileSync(join(ROOT, 'pi/settings.json'), 'utf8'));

  // Ephemeral state pi writes itself; committing it creates pointless churn.
  const EPHEMERAL = ['lastChangelogVersion', 'trackingId'];
  const leaked = EPHEMERAL.filter((k) => k in s);
  if (leaked.length) bad(`settings: ephemeral key(s) committed: ${leaked.join(', ')}`);
  else ok('settings: no ephemeral state committed');

  // Credentials live in auth.json and must never reach the repo.
  const SECRETISH = /apiKey|api_key|token|secret|password/i;
  const secrets = Object.keys(s).filter((k) => SECRETISH.test(k));
  if (secrets.length) bad(`settings: possible credential key(s): ${secrets.join(', ')}`);
  else ok('settings: no credential-shaped keys');

  if (s.theme) {
    const themeFile = join(ROOT, `pi/themes/${s.theme}.json`);
    if (existsSync(themeFile)) ok(`settings: theme "${s.theme}" resolves to a file in the repo`);
    else bad(`settings: theme "${s.theme}" has no pi/themes/${s.theme}.json`);
  }
}

console.log('\n' + '═'.repeat(76));
console.log(failures === 0 ? 'PASS\n' : `FAIL — ${failures} problem(s)\n`);
process.exit(failures === 0 ? 0 : 1);
