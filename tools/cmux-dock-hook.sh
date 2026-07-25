#!/usr/bin/env bash
# Writes ~/.cmux/dock-state.json for the CmuxDock tile.
#
# WHY THIS RUNS HERE AND NOT IN THE APP
# ------------------------------------
# cmux refuses socket connections from outside itself under
# `socketControlMode: cmuxOnly` — verified on cmux 0.64.20, where ping,
# capabilities, list-windows, identify and current-window all answer
# "Access denied - only processes started inside cmux can connect". Only
# `cmux version` works without the socket.
#
# So the Dock app, launched by launchd, can never query cmux. This script is
# spawned BY cmux via notifications.command, which is the one context that can.
# It queries, and the app only ever reads the resulting file.
#
# ATOMIC WRITES
# -------------
# temp + rename, always. The app watches the containing DIRECTORY precisely
# because a rename swaps the inode and would leave a file-level watcher deaf.
#
# PROBE MODE
# ----------
# cmux does not document what it passes to notifications.command — env vars,
# stdin, neither. Until that is pinned down, the first runs append what they
# actually received to ~/.cmux/dock-probe.log. Read it, then set PROBE_RUNS=0.

set -uo pipefail

CMUX="/Applications/cmux.app/Contents/MacOS/cmux"
DIR="$HOME/.cmux"
STATE="$DIR/dock-state.json"
PROBE="$DIR/dock-probe.log"
PROBE_RUNS=25

mkdir -p "$DIR"

# ── probe ───────────────────────────────────────────────────────────────────
if [ "$PROBE_RUNS" -gt 0 ] && [ "$(grep -c '^=== run' "$PROBE" 2>/dev/null || echo 0)" -lt "$PROBE_RUNS" ]; then
	{
		echo "=== run $(date -Iseconds) ==="
		echo "-- argv --"
		printf '  [%s]\n' "$@"
		echo "-- cmux/notification env --"
		env | grep -iE '^(CMUX|NOTIF|WORKSPACE|SURFACE|PANE|AGENT)' | sed 's/^/  /' \
			|| echo "  (none)"
		echo "-- stdin (1s timeout) --"
		if [ ! -t 0 ]; then
			# Never block the notification path: cmux may pass nothing at all.
			if IFS= read -r -t 1 line; then
				echo "  $line"
				while IFS= read -r -t 1 line; do echo "  $line"; done
			else
				echo "  (empty or no stdin within 1s)"
			fi
		else
			echo "  (stdin is a tty)"
		fi
		echo "-- socket reachable from here? --"
		if out=$(CMUX_QUIET=1 "$CMUX" workspace list --json 2>&1); then
			echo "  YES"
			printf '%s\n' "$out" | head -20 | sed 's/^/    /'
		else
			echo "  NO: $(printf '%s' "$out" | head -1)"
		fi
	} >>"$PROBE" 2>&1
fi

# ── state ───────────────────────────────────────────────────────────────────
# Query cmux for workspaces. If the socket is unreachable even from here, fall
# back to a single synthetic "attention" entry: a notification just fired, so
# something wants the user, even if we cannot say which workspace.
workspaces_json="[]"

# `workspace list` is the canonical form; the legacy `list-workspaces` prints a
# deprecation hint that contaminates stdout. CMUX_QUIET silences the rest.
if raw=$(CMUX_QUIET=1 "$CMUX" workspace list --json 2>/dev/null); then
	workspaces_json=$(printf '%s' "$raw" | python3 -c '
import json, sys

# The exact field names are not documented and vary by version, so probe a few
# plausible keys instead of assuming a shape. Anything unrecognised is idle,
# which is the safe direction: it under-reports rather than crying wolf.
NAME_KEYS = ("name", "title", "ref", "id")
BUSY = ("running", "working", "busy", "active")
WANTS = ("attention", "waiting", "unread", "needs_input", "blocked")
BAD = ("error", "failed", "failure", "crashed")

def classify(ws):
    blob = json.dumps(ws).lower()
    if any(k in blob for k in BAD):
        return "error"
    if any(k in blob for k in WANTS):
        return "attention"
    if any(k in blob for k in BUSY):
        return "working"
    return "idle"

try:
    data = json.load(sys.stdin)
except Exception:
    print("[]"); raise SystemExit

rows = data if isinstance(data, list) else (
    data.get("workspaces") or data.get("items") or data.get("rows") or [])

out = []
for ws in rows:
    if not isinstance(ws, dict):
        continue
    name = next((str(ws[k]) for k in NAME_KEYS if ws.get(k)), None)
    if not name:
        continue
    out.append({"name": name, "status": classify(ws)})
print(json.dumps(out))
' 2>/dev/null) || workspaces_json="[]"
fi

if [ "$workspaces_json" = "[]" ] || [ -z "$workspaces_json" ]; then
	workspaces_json='[{"name":"cmux","status":"attention"}]'
fi

tmp="$DIR/.dock-state.$$.tmp"
printf '{"workspaces":%s}\n' "$workspaces_json" >"$tmp"
mv -f "$tmp" "$STATE"

exit 0
