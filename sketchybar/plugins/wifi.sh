#!/usr/bin/env bash

# ═══════════════════════════════════════════════════════════════════════════
# WIFI — link state, and the SSID only when macOS will actually hand it over
# ═══════════════════════════════════════════════════════════════════════════
#
# This used to decide "connected" from `networksetup -getairportnetwork`, which
# is deprecated: on current macOS it answers "You are not associated with an
# AirPort network." even while the link is up, so the bar showed "Off" on a
# working connection.
#
# Worse, the SSID itself is gated behind Location Services. Without that
# permission every method (networksetup, ipconfig getsummary, system_profiler)
# returns "<redacted>". That is a privacy control, not something a script can
# work around — so link state comes from the interface, and the SSID is treated
# as a bonus that may never arrive.

source "$CONFIG_DIR/colors.sh"

DEVICE=$(networksetup -listallhardwareports 2>/dev/null | awk '/Wi-Fi|AirPort/{getline; print $NF}')
DEVICE=${DEVICE:-en0}

# Interface state is always readable and is the fact that actually matters.
if ifconfig "$DEVICE" 2>/dev/null | grep -q "status: active"; then
  ICON="󰤨" # nf-md-wifi
  SSID=$(ipconfig getsummary "$DEVICE" 2>/dev/null | awk -F' SSID : ' '/ SSID : / {print $2}' | head -1)
  case "$SSID" in
    ''|'<redacted>') LABEL="" ;; # icon alone already says "connected"
    *) LABEL="$SSID" ;;
  esac
else
  ICON="󰤭" # nf-md-wifi-off
  LABEL="off"
fi

# Neutral either way: being off Wi-Fi is normal on ethernet, so it is a level,
# not a fault. Colour stays reserved for things that need attention.
if [ -n "$LABEL" ]; then
  sketchybar --set "$NAME" icon="$ICON" icon.color="$GREY" label="$LABEL" label.color="$WHITE" label.drawing=on
else
  sketchybar --set "$NAME" icon="$ICON" icon.color="$GREY" label.drawing=off
fi
