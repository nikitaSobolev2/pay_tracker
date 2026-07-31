#!/usr/bin/env bash
# Register Pay Tracker WidgetKit extension with PlugInKit after an Xcode build.
set -euo pipefail

APP="${1:-}"

newest_debug_app() {
  ls -dt "$HOME"/Library/Developer/Xcode/DerivedData/PayTracker-*/Build/Products/Debug/PayTracker.app 2>/dev/null | head -1 || true
}

if [[ -z "$APP" ]]; then
  # Prefer the latest Xcode Debug build — mdfind often hits a stale ~/Applications copy.
  APP="$(newest_debug_app)"
fi
if [[ -z "$APP" || ! -d "$APP" ]]; then
  APP="$(mdfind "kMDItemCFBundleIdentifier == 'site.paytracker.mac'" 2>/dev/null | head -1 || true)"
fi
if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "PayTracker.app not found. Run the app from Xcode first, or pass the .app path."
  exit 1
fi

APPEX="$APP/Contents/PlugIns/PayTrackerWidget.appex"
if [[ ! -d "$APPEX" ]]; then
  echo "Missing widget extension at: $APPEX"
  exit 1
fi

echo "Unregistering old plugin (if any)…"
pluginkit -r "$APPEX" 2>/dev/null || true
pluginkit -r "/Users/nikita/Applications/PayTracker.app/Contents/PlugIns/PayTrackerWidget.appex" 2>/dev/null || true

echo "Clearing WidgetKit caches…"
rm -rf "$HOME/Library/Caches/com.apple.chrono/widget-relevance-cache" 2>/dev/null || true
rm -rf "$HOME/Library/Caches/com.apple.chrono/snapshot-cache" 2>/dev/null || true
mkdir -p "$HOME/Library/Caches/com.apple.chrono/widget-relevance-cache"
mkdir -p "$HOME/Library/Caches/com.apple.chrono/snapshot-cache"

killall chronod 2>/dev/null || true
killall PayTrackerWidget 2>/dev/null || true
sleep 1

echo "Registering: $APPEX"
pluginkit -a "$APPEX"
pluginkit -e use -i site.paytracker.mac.widget

# Keep ~/Applications in sync so Spotlight/PlugInKit don't serve an old binary.
INSTALL_DIR="$HOME/Applications"
if [[ -d "$INSTALL_DIR" && "$APP" != "$INSTALL_DIR/PayTracker.app" ]]; then
  mkdir -p "$INSTALL_DIR"
  rm -rf "$INSTALL_DIR/PayTracker.app"
  cp -R "$APP" "$INSTALL_DIR/PayTracker.app"
  xattr -cr "$INSTALL_DIR/PayTracker.app" 2>/dev/null || true
  pluginkit -a "$INSTALL_DIR/PayTracker.app/Contents/PlugIns/PayTrackerWidget.appex"
  echo "Synced: $INSTALL_DIR/PayTracker.app"
fi

killall chronod 2>/dev/null || true
sleep 1

echo ""
echo "Done. Quit Edit Widgets if open, then Desktop → Edit Widgets → search Pay Tracker."
echo "Expected gallery entries (4):"
echo "  • Balance"
echo "  • Top Categories"
echo "  • Recent Activity"
echo "  • Spending Activity"
echo ""
pluginkit -m -p com.apple.widgetkit-extension -i site.paytracker.mac.widget -vv | head -40
echo ""
echo "Kinds in binary:"
strings "$APPEX/Contents/MacOS/PayTrackerWidget" \
  | grep -E 'PayTracker[[:alnum:]]+Widget\.v2|Income vs|Top Categories|Recent Transactions|Activity Heatmap|^Quick Add$' \
  | head -20
