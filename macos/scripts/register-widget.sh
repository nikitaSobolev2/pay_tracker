#!/usr/bin/env bash
# Register Pay Tracker WidgetKit extension with PlugInKit after an Xcode build.
set -euo pipefail

APP="${1:-}"
if [[ -z "$APP" ]]; then
  APP="$(mdfind "kMDItemCFBundleIdentifier == 'site.paytracker.mac'" 2>/dev/null | head -1 || true)"
fi
if [[ -z "$APP" || ! -d "$APP" ]]; then
  APP="$(ls -d "$HOME"/Library/Developer/Xcode/DerivedData/PayTracker-*/Build/Products/Debug/PayTracker.app 2>/dev/null | head -1 || true)"
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

echo "Registering: $APPEX"
pluginkit -a "$APPEX"
pluginkit -e use -i site.paytracker.mac.widget
killall chronod 2>/dev/null || true
echo "Done. Open Desktop → Edit Widgets → search Pay Tracker."
pluginkit -m -p com.apple.widgetkit-extension -i site.paytracker.mac.widget -vv | head -40
