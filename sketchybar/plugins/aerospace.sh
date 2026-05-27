#!/bin/bash

source "$CONFIG_DIR/plugins/icon_map.sh"
source "$CONFIG_DIR/colors.sh"

# On front_app_switched, refresh ALL workspaces (app may have moved/opened/closed)
if [ "$SENDER" = "front_app_switched" ]; then
  for ws in B T C X M W O D S; do
    sketchybar --trigger aerospace_workspace_change FOCUSED_WORKSPACE="$FOCUSED_WORKSPACE" AEROSPACE_PREV_WORKSPACE="" --set "space.$ws" script="$CONFIG_DIR/plugins/aerospace.sh $ws"
  done
  exit 0
fi

WORKSPACE_ID="$1"

# Get apps in this workspace
apps=$(aerospace list-windows --workspace "$WORKSPACE_ID" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/, "", $2); print $2}' | sort -u)

# Build icon string
icon_strip=""
if [ -n "$apps" ]; then
  while IFS= read -r app; do
    [ -z "$app" ] && continue
    __icon_map "$app"
    if [ -n "$icon_result" ] && [ "$icon_result" != ":default:" ]; then
      icon_strip+="$icon_result"
    fi
  done <<< "$apps"
fi

# Get focused workspace
FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null)

# Check if focused
if [ "$WORKSPACE_ID" = "$FOCUSED" ]; then
  sketchybar --set "$NAME" \
    drawing=on \
    background.color="$ITEM_BG_ACTIVE" \
    background.border_width=2 \
    background.border_color="$ACCENT" \
    icon.color="$WHITE" \
    icon.font="SF Pro:Black:13.0"

  if [ -n "$icon_strip" ]; then
    sketchybar --set "$NAME" label="$icon_strip" label.color="$WHITE"
  else
    sketchybar --set "$NAME" label=""
  fi
else
  if [ -n "$icon_strip" ]; then
    sketchybar --set "$NAME" \
      drawing=on \
      background.color="$ITEM_BG" \
      background.border_width=0 \
      icon.color="$GREY" \
      icon.font="SF Pro:Bold:13.0" \
      label="$icon_strip" \
      label.color="$GREY"
  else
    sketchybar --set "$NAME" drawing=off
  fi
fi
