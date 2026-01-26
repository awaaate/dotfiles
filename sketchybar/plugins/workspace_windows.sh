#!/usr/bin/env bash

# ═══════════════════════════════════════════════════════════════════════════
# WORKSPACE WINDOWS PLUGIN
# Updates all workspace items when windows change
# ═══════════════════════════════════════════════════════════════════════════

source "$CONFIG_DIR/colors.sh"

# Trigger update for all workspace items
for ws in B T C F M W N S D X; do
  sketchybar --trigger aerospace_workspace_change FOCUSED_WORKSPACE="$FOCUSED_WORKSPACE" --set "space.$ws" script="$CONFIG_DIR/plugins/aerospace.sh $ws"
done
