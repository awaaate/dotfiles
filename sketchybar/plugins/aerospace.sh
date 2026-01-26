#!/bin/bash

source "$CONFIG_DIR/plugins/icon_map.sh"
source "$CONFIG_DIR/colors.sh"

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

# Check if focused
if [ "$1" = "$FOCUSED_WORKSPACE" ]; then
  # ACTIVE: bright background, white text, accent border
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
  # INACTIVE with windows: dimmed
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
    # Empty: hide it
    sketchybar --set "$NAME" drawing=off
  fi
fi
