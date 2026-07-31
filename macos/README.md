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

1. Prefer **QR code** in the Mac app — scan with a logged-in phone and approve.
2. Or enter the 6-digit **Devices** code, or sign in with email/username + password.

The session token is stored in the App Group so widgets can call the API with `Authorization: Bearer …`.

## Desktop widgets

| Gallery name | Sizes | Content |
|--------------|-------|---------|
| Balance | S / M / L | Net + income/spend bars, avg/day, weekly chart (Large) |
| Top Categories | M / L | Ranked spending categories this month |
| Recent Activity | M / L | Latest transactions with relative time |
| Spending Activity | M / L | Daily spending intensity grid |

1. Set **Team** on **PayTracker** and **PayTrackerWidget**.
2. App Groups → `group.site.paytracker.mac` on both.
3. Clean Build Folder, then ⌘R.
4. If gallery stale:

```bash
./macos/scripts/register-widget.sh
```

5. Desktop → **Edit Widgets** → search **Pay Tracker**.

**In-widget Add** prompts for amount, Spending/Earning, and optional title, then `POST /api/transactions`. Categories still use companion Quick Add.

## Layout

```
macos/
  project.yml
  scripts/register-widget.sh
  PayTracker/
    App/
    Widget/
    Shared/
    Resources/
```

## API

- Base URL: `https://pay-tracker.site`
- Overview: `GET /api/stats/overview?dateRangeType=month`
- Activity: `GET /api/stats/activity`
- Categories: `GET /api/categories`
- Create: `POST /api/transactions`
- Auth: Better Auth bearer / session token
