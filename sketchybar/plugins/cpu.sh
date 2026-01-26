#!/usr/bin/env bash

source "$CONFIG_DIR/colors.sh"

# Get CPU usage
CPU=$(top -l 1 -n 0 2>/dev/null | grep "CPU usage" | awk '{print int($3)}')
[ -z "$CPU" ] && CPU=0

# Convert to decimal for graph
CPU_DECIMAL=$(awk "BEGIN {printf \"%.2f\", $CPU / 100}")

# Determine color
if [ "$CPU" -ge 80 ]; then
  COLOR="$RED"
elif [ "$CPU" -ge 50 ]; then
  COLOR="$YELLOW"
else
  COLOR="$WHITE"
fi

sketchybar --set "$NAME" label="${CPU}%" label.color="$COLOR"

# Push to graph
sketchybar --push cpu_graph "$CPU_DECIMAL" 2>/dev/null
