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

1. Right-click Desktop → **Edit Widgets** (or open Widget gallery).
2. Find **Pay Tracker**.
3. Add Small / Medium / Large.
4. **Add** on the widget opens Quick Add in the companion app.

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
