#!/bin/bash
# Refreshes EVERY workspace item in one pass.
#
# This replaces a per-item script that fanned out catastrophically. Each space.*
# item was subscribed to both aerospace_workspace_change and front_app_switched,
# and on front_app_switched each one re-triggered aerospace_workspace_change for
# every workspace — which then ran every item script again. Measured cost of a
# SINGLE app switch: 399 invocations, ~63ms each. That is what made the bar tick.
#
# The whole refresh is now:
#   1 × aerospace list-workspaces   (focused workspace)
#   1 × aerospace list-windows      (every window, every workspace)
#   1 × sketchybar                  (all items set in one batched call)
#
# icon_map.sh is a 927-line case statement; sourcing it once per event instead
# of 399 times is most of the remaining win.

source "$CONFIG_DIR/colors.sh"
source "$CONFIG_DIR/workspaces_list.sh"
source "$CONFIG_DIR/plugins/icon_map.sh"

# Apps the generated icon_map.sh has no entry for. Without this they resolve to
# :default:, get filtered out, and the workspace looks empty — which is what
# happened to cmux, the primary terminal, on every workspace it was in.
# Kept separate so icon_map.sh stays a pristine generated file.
__icon_override() {
  case "$1" in
    cmux) icon_result=":terminal:" ;;
    *) return 1 ;;
  esac
}

FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null)
WINDOWS=$(aerospace list-windows --all --format '%{workspace}|%{app-name}' 2>/dev/null)

args=()

for ws in $(sb_workspaces); do
  apps=$(printf '%s\n' "$WINDOWS" | awk -F'|' -v w="$ws" '$1 == w { print $2 }' | sort -u)

  icon_strip=""
  seen=""
  if [ -n "$apps" ]; then
    while IFS= read -r app; do
      [ -z "$app" ] && continue
      icon_result=""
      __icon_override "$app" || __icon_map "$app"
      [ -z "$icon_result" ] && continue
      [ "$icon_result" = ":default:" ] && continue
      # Two terminals should not draw the same glyph twice. Dedupe on the
      # RESOLVED icon, not the app name — several apps map to one glyph.
      case " $seen " in *" $icon_result "*) continue ;; esac
      seen="$seen $icon_result"
      icon_strip+="$icon_result"
    done <<< "$apps"
  fi

  # An empty, unfocused workspace is not worth the horizontal space.
  if [ -z "$apps" ] && [ "$ws" != "$FOCUSED" ]; then
    args+=(--set "space.$ws" drawing=off)
    continue
  fi

  if [ "$ws" = "$FOCUSED" ]; then
    # Focused: accent ring plus full-contrast text. This is the only place in
    # the bar allowed to use the accent as a border.
    args+=(--set "space.$ws"
      drawing=on
      background.color="$ITEM_BG_ACTIVE"
      background.border_width=2
      background.border_color="$ACCENT"
      icon.color="$WHITE"
      label="$icon_strip"
      label.color="$WHITE")
  else
    # Unfocused: same colours, less contrast. Never a different hue — see
    # docs/DESIGN.md "active / inactive".
    args+=(--set "space.$ws"
      drawing=on
      background.color="$ITEM_BG"
      background.border_width=0
      icon.color="$GREY"
      label="$icon_strip"
      label.color="$GREY")
  fi
done

sketchybar "${args[@]}"
