#!/usr/bin/env bash
# Builds CmuxDock.app with swiftc and a hand-assembled bundle.
#
# No Xcode and no SwiftPM: the Command Line Tools ship swiftc, and an AppKit app
# bundle is just a directory with an Info.plist and a binary. Adding SwiftPM here
# would buy a Package.swift and a .build tree for a single-file target.
#
#   ./build.sh            build into ./dist
#   ./build.sh --install  build, then copy to /Applications
set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="CmuxDock"
DIST="dist"
BUNDLE="$DIST/$APP_NAME.app"
MACOS="$BUNDLE/Contents/MacOS"

if ! command -v swiftc >/dev/null; then
	echo "error: swiftc not found. Install the Command Line Tools: xcode-select --install" >&2
	exit 1
fi

# IrisTokens.swift is generated. Building against a stale copy would put the
# wrong palette in the tile, which is the whole failure mode this repo exists
# to prevent — so refuse rather than build something subtly wrong.
if [ ! -f Sources/IrisTokens.swift ]; then
	echo "error: Sources/IrisTokens.swift is missing. Run: node ../../tools/build.mjs" >&2
	exit 1
fi

rm -rf "$DIST"
mkdir -p "$MACOS"

echo "==> compiling"
# -swift-version 5: the app is single-threaded AppKit code and Swift 6's strict
# concurrency checking adds nothing here except noise about @objc selectors.
swiftc \
	-swift-version 5 \
	-O \
	-target "$(uname -m)-apple-macosx13.0" \
	-framework AppKit \
	-o "$MACOS/$APP_NAME" \
	Sources/IrisTokens.swift \
	Sources/Island.swift \
	Sources/main.swift

cp Info.plist "$BUNDLE/Contents/Info.plist"

# Ad-hoc signature. Unsigned AppKit bundles are killed on launch on Apple
# silicon; ad-hoc is enough for a locally built tool.
echo "==> signing (ad-hoc)"
codesign --force --sign - "$BUNDLE"

echo "==> built $BUNDLE"

if [ "${1:-}" = "--install" ]; then
	echo "==> installing to /Applications"
	rm -rf "/Applications/$APP_NAME.app"
	cp -R "$BUNDLE" /Applications/
	echo "    installed. Launch with: open -a $APP_NAME"
fi
