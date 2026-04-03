# Fun with Computer Vision Launcher

An Electron desktop launcher that wraps all of the camera-driven tutorials in this repository. The launcher presents each experience as a card with artwork, description, and one-click access.

## Getting Started

```bash
cd launcher
npm install
npm start
```

The launcher opens in a native window. Click any card to spawn the corresponding tutorial in its own window with camera access handled by Electron.

> **Note:** The first time you launch a tutorial, macOS, Windows, or Linux will prompt for webcam/microphone permission. Grant access so the computer-vision demos can run.

### Development tips

- To open DevTools automatically, run `OPEN_DEVTOOLS=true npm start`. It is off by default to avoid noisy DevTools autofill warnings in recent Chromium builds.

## Packaging Targets

The project is pre-configured with `electron-builder` to emit three installable artifacts:

- macOS `.dmg`
- Windows `.exe` (NSIS installer)
- Linux `.AppImage`

Build them with:

```bash
npm run dist
```

Artifacts are generated in `launcher/dist` and grouped by platform. All tutorial folders are bundled as resources, so the packaged builds run offline without needing a browser.

The macOS build is left unsigned by default (`identity: null`) so it finishes without needing a Developer ID certificate. For distribution you can either notarize/sign manually or set `build.mac.identity` to your signing identity.

### Helpful build flags

- `npm run dist -- --mac` &mdash; build only the `.dmg`
- `npm run dist -- --win` &mdash; build only the Windows installer
- `npm run dist -- --linux` &mdash; build only the Linux AppImage

### Custom icons

Drop your platform icons into the new `build/icons` directory before packaging:

- `build/icons/mac/icon.icns` (1024x1024 recommended) for the macOS `.app` / `.dmg`
- `build/icons/win/icon.ico` (multi-size, include 256x256) for the Windows installer
- `build/icons/linux/icon.png` (512x512) for the Linux AppImage

Electron Builder picks these up automatically via `build.mac.icon`, `build.win.icon`, and `build.linux.icon`. If you regenerate icons later, just replace the files and rerun `npm run dist`.

## Structure Highlights

- `apps.json` &mdash; metadata and routing for each tutorial (title, description, thumbnail, entry file).
- `main.js` &mdash; Electron main process: creates the launcher window, serves assets, and spawns tutorial windows on demand.
- `renderer.js` &mdash; Renders the card layout, performs search/filtering, and invokes main-process IPC to launch tutorials.
- `package.json#build.extraResources` &mdash; lists the tutorial folders that should be copied next to the packaged app so the experiences are available at runtime.

To add a new tutorial:

1. Drop the new folder at the repository root.
2. Append its metadata to `apps.json` (use existing entries as a template).
3. Add the folder name to the `extraResources.filter` array in `package.json`.

Feel free to tweak the artwork, copy, or layout in `styles.css` and `index.html` to better match your branding. When you update icons later, just replace the files in `launcher/build/icons`.
