#!/usr/bin/env bash

# ═══════════════════════════════════════════════════════════════════════════
# WIFI PLUGIN
# Shows WiFi status and network name
# ═══════════════════════════════════════════════════════════════════════════

source "$CONFIG_DIR/colors.sh"

# Get WiFi info
WIFI_DEVICE=$(networksetup -listallhardwareports | awk '/Wi-Fi|AirPort/{getline; print $NF}')
SSID=$(networksetup -getairportnetwork "$WIFI_DEVICE" 2>/dev/null | awk -F': ' '{print $2}')

if [ -n "$SSID" ] && [ "$SSID" != "You are not associated with an AirPort network." ]; then
  ICON="󰤨"
  LABEL="$SSID"
  COLOR="$WHITE"
else
  ICON="󰤭"
  LABEL="Off"
  COLOR="$GREY"
fi

sketchybar --set "$NAME" \
  icon="$ICON" \
  icon.color="$COLOR" \
  label="$LABEL" \
  label.color="$COLOR"
