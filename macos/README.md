# Pay Tracker macOS (WidgetKit)

Native companion app + Desktop widgets for [pay-tracker.site](https://pay-tracker.site).

## Requirements

- macOS 26 (Tahoe) or newer
- Xcode 26+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- Apple Developer team (for App Groups / signing)

## Generate & run

After installing Xcode (first time only):

```bash
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
```

Then:

```bash
cd macos
xcodegen generate
open PayTracker.xcodeproj
```

In Xcode:

1. Select the **PayTracker** target → Signing & Capabilities → choose your Team.
2. Confirm App Group `group.site.paytracker.mac` exists for both App and Widget targets (add the capability if Xcode warns).
3. Run **PayTracker** (⌘R).

## Link account

1. On the web app, open **Devices** and show a login code.
2. In the Mac app, enter the 6-digit code and approve the Mac from a logged-in device.
3. Or use **Email** sign-in (same credentials as the website).

The session token is stored in the App Group so widgets can call the API with `Authorization: Bearer …`.

## Add Desktop widgets

1. In Xcode: set **Team** on **PayTracker** and **PayTrackerWidget** targets.
2. Signing & Capabilities → add **App Groups** → enable `group.site.paytracker.mac` on both targets.
3. Product → Clean Build Folder, then ⌘R (run once).
4. If gallery still empty, register the extension:

```bash
./macos/scripts/register-widget.sh
```

5. Desktop → **Edit Widgets** → search **Pay Tracker**.

Widget shows under app name **Pay Tracker**.

## Layout

```
macos/
  project.yml
  PayTracker/
    App/        # companion UI, Quick Add, link account
    Widget/     # WidgetKit timelines + Swift Charts
    Shared/     # API client, models, SessionStore
    Resources/  # entitlements, URL scheme
```

## API

- Base URL: `https://pay-tracker.site` (override via `SessionStore.baseURL`)
- Overview: `GET /api/stats/overview?dateRangeType=month`
- Categories: `GET /api/categories`
- Create: `POST /api/transactions`
- Auth: Better Auth bearer (`set-auth-token` / session token)
