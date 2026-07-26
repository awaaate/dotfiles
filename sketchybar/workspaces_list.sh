#!/bin/bash
# The workspace list, in ONE place.
#
# It used to be hardcoded as `for ws in B T C X M W O D S` in sketchybarrc and
# again in the refresh script. AeroSpace actually defines ten workspaces
# (B T C X K M W O D S) — K was missing from both copies, so a workspace
# holding real windows was simply invisible in the bar.
#
# Order matters and is NOT alphabetical: `aerospace list-workspaces --all`
# returns B C D K M O S T W X, while the intended order is the one written in
# .aerospace.toml. So the toml is the source of truth, with the live query as a
# fallback if it cannot be parsed.

sb_workspaces() {
  local list
  list=$(sed -n 's/^persistent-workspaces *= *\[\(.*\)\].*/\1/p' "$HOME/.aerospace.toml" 2>/dev/null \
         | tr -d " '\"" | tr ',' ' ')
  if [ -z "$list" ]; then
    list=$(aerospace list-workspaces --all 2>/dev/null | tr '\n' ' ')
  fi
  echo $list
}
