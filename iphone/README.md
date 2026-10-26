# Sodalis Collective iPhone app (SwiftUI)

The native iPhone app. It uses the same club rules (`app/rules.json`) and brand
settings (`app/brand.json`) as the web app, and will use the same Supabase database.

## Run it on your iPhone (free, with Xcode)

1. Install **Xcode** from the Mac App Store and open it once so it can finish setting up.
2. On GitHub, open this repository, click the green **Code** button, then **Download ZIP**. Unzip it.
3. Open the `iphone` folder and double-click **Sodalis.xcodeproj**.
4. Plug your iPhone into the Mac with a cable. On the phone, tap **Trust**.
5. In Xcode, click **Sodalis** in the left sidebar, then **Signing & Capabilities**,
   and pick your Apple ID under **Team** (Add an Account… if it's empty).
6. At the top of the window, choose your iPhone from the device list, then press the ▶ Play button.
7. The first time, on the phone go to **Settings › General › VPN & Device Management**,
   tap your Apple ID and tap **Trust**. Then open the app.

Apps installed this way stop opening after 7 days; repeat step 6 to refresh.

## Screenshots without a Mac

Every change to this folder is built on GitHub's Mac machines (workflow
"Native iPhone app"). Simulator screenshots land on the `iphone-screenshots` branch.

## Previewing a screen

Launch with `-screen <name>` to open straight to a screen, e.g. `-screen filters`.
Names are listed in `DemoScreen` in `Sodalis/App/SodalisApp.swift`.

## Fonts

Newsreader, Figtree, Instrument Serif and Great Vibes, all under the SIL Open Font License.
