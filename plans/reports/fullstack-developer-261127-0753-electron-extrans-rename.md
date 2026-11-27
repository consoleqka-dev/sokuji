# Electron app rename: Sokuji to ExTrans

Outcome: every user-visible string of the Electron app now says ExTrans. The userData folder (and the macOS logs folder) stay named `Sokuji`, pinned in code, so existing settings, history, sign-in and models carry over. Nothing was committed, stashed or reset.

## Storage paths (the part that could lose user data)

Electron derives `userData`, `sessionData`, `crashDumps` and (macOS) logs from the package.json `productName` at startup. Renaming it would have moved every user to an empty profile. `app.setName()` does not change those paths; this was checked empirically against Electron 44.11.5, so the pin uses `app.setPath`.

- New `electron/app-identity.js`: `PRODUCT_NAME = 'ExTrans'`, `STORAGE_DIR_NAME = 'Sokuji'`, `pinStorageLocations(app)`.
  - `setPath('userData', <appData>/Sokuji)` (sessionData and crashDumps follow; Windows/Linux logs live in userData).
  - macOS only: `setAppLogsPath(~/Library/Logs/Sokuji)`.
- `electron/main.js` calls `pinStorageLocations(app)` before any other local module is required. This matters because `electron-conf` (via `better-auth-adapter.js`) resolves userData at require time.
- `electron/app-identity.test.js` proves it: fake-app tests for userData and the macOS logs path, no logs call off macOS, and a source-order test that the pin comes before the first local `require` and before `./better-auth-adapter`.
- Other name-derived paths: the Squirrel install folder `%LocalAppData%\Sokuji` comes from the Squirrel package id, which is kept as `Sokuji` (`forge.config.js`, `update-manager.js` `installRoot`). Linux PulseAudio/PipeWire names come from `app.setName('sokuji')`, which is unchanged. No other path in `electron/` is derived from `app.getName()`.
- `vite.config.ts` has a new entry `app-identity` (every `electron/*.js` module is its own entry).

## Changed files

Source and config
- `package.json`: `productName`, `build.productName`, `NSDownloadsFolderUsageDescription`.
- `forge.config.js`: `packagerConfig.name` and dmg `name` to ExTrans (comments explain the kept Squirrel id).
- `vite.config.ts`: `app-identity` entry.
- `electron/app-identity.js` (new), `electron/app-identity.test.js` (new).
- `electron/main.js`: app menu, About panel, window title, repair prompt fallback, `get-tcc-display-name` (now returns `PRODUCT_NAME`, which is what System Settings lists), prose comments.
- `electron/caption-share.js` (present window title), `electron/caption-share-server.js` (firewall/wrong-host note), `electron/sandbox-recovery.js` (dialogs, backup header), `electron/update-manager.js` (error text).
- `electron/own-app-source.js`: self identity now holds several app names and always includes `PRODUCT_NAME`. On macOS the capture list shows the bundle as "ExTrans" while `app.name` stays `sokuji`, so without this ExTrans would have been offered as a capture source of itself (the TTS feedback loop this module prevents).
- Comment-only: `single-instance.js`, `mic-users-win.js`, `capture-sources.js`, `ipc-channels.js`, `audio-host.js`, `vb-cable-installer.js`, `pipewire-app-audio.js`, `update-install-windows.js`.
- `electron/update-payload.js`: Linux AppImage download name is `ExTrans-<ver>-<arch>.AppImage` (electron-builder derives it from `productName`).
- `electron/update-install-windows.js`: `isInstallerName` accepts `ExTrans-*.Setup.exe` and still `Sokuji-*.Setup.exe`, so leftover installers from earlier releases are still cleaned up.
- Packaging that follows the product name: `.github/workflows/build.yml` (Setup.exe, store-installer and `.app` names), `pkg-scripts/postinstall` and `preinstall` (`/Applications/ExTrans.app`; the driver path is unchanged), `resources/installer-welcome.html`, `resources/installer-conclusion.html`, three lines of the `README.md` download table.
- `DESIGN.md` Brand and `REVIEW.md` Brand and copy: no longer say the Electron strings keep Sokuji; they now record the kept identifiers and the userData pin.

Screen picker and locales
- `src/components/ScreenContext/SourcePicker.tsx` fallbacks, `SourcePicker.test.tsx`.
- All 30 `src/locales/*/translation.json` (11 lines each, including `screenContext.picker.restart`). Finnish uses `ExTransin`, Swedish `ExTranss`.

Tests updated only because of the rename: `caption-share-server.test.js`, `update-payload.test.js`, `update-install-windows.test.js` (added the ExTrans case, kept the Sokuji one), `store-installer.consistency.test.js`, `macos-developer-id.consistency.test.js`, `macos-driver-install.consistency.test.js`, `own-app-source.test.js` (added cases for multiple names and for the product name outside Electron). No assertion was weakened.

## "Sokuji" kept, with reasons

`grep -rn "Sokuji" electron/ src/locales package.json forge.config.js` (non-test) leaves only:
- `package.json` `name: sokuji` and `build.appId` `ai.kizunaai.sokuji` (the grep is case-sensitive so they are not listed; both kept): the app id keeps macOS permission grants and updates; `name` is the deb package id and the electron-builder `${name}`.
- `forge.config.js` Squirrel `name: 'Sokuji'`, `exe: 'sokuji.exe'`, `executableName: 'sokuji'`: package id and install folder, so installed copies keep updating.
- `electron/app-identity.js` `STORAGE_DIR_NAME`: the pinned user-data folder.
- `electron/update-manager.js` `installRoot` and `squirrel-update.js`, `update-manager.js` comments: the `%LocalAppData%\Sokuji` Squirrel folder.
- `electron/update-install-windows.js` `isInstallerName` and its doc: pre-rename installers.
- `[Sokuji]` log tags everywhere and the `Sokuji/<version>` User-Agent token: identifiers, not shown to users.
- `SokujiVirtualAudio`, `Sokuji Virtual Audio`, `isSokujiVirtualAudioInstalled`, `/Library/Audio/Plug-Ins/HAL/SokujiVirtualAudio.driver`, `devices contains "Sokuji"` (`macos-audio-utils.js`, `main.js` driver status messages): the installed macOS driver and the real device name the OS reports; matching code depends on them. Also quoted in the two installer HTML pages for the same reason.
- `Sokuji_App_Capture`, `Sokuji_Virtual_Speaker`, `Sokuji_Virtual_Mic`, `sokuji_*` sink names, `SokujiVerifyProbe` (`pipewire-app-audio.js`, `pulseaudio-utils.js`, `pipewire-app-audio.verify.js`): PulseAudio/PipeWire device descriptions the renderer and the process matcher look for.
- `src/locales/index.ts`: `[Sokuji]` console log tags. `newScreens.translated.test.ts`: the pattern already lists both names.
- `electron/__fixtures__/*`: recorded device fixtures with real device names.

`electron/app-identity.test.js` has a scan of non-test `electron/*.js` that fails on any other "Sokuji" prose, so these stay the only ones.

## Not changed (listed for follow-up)

- `scripts/verify-macos-selfsigned.sh` still checks `/Applications/Sokuji.app`, and `native/audio-host` comments/README mention `Sokuji.app`. These are dev-time scripts and comments; the bundle is now `ExTrans.app`, so the script's path should be updated by whoever owns it.
- `src/components/ScreenContext/SourcePicker.scss` line 148: comment says "Restart Sokuji"; left because other sessions are editing `src/**/*.scss`.
- A release-hosting backend route that pins asset names (`sokuji-backend` is referenced in `build.yml`) was not reviewed: Windows installer, macOS pkg and AppImage file names are now `ExTrans-...`. The updater feed (`latest.yml`) globbing is name-agnostic, and the Squirrel nupkg id (hence RELEASES/nupkg names) is unchanged.
- The pre-existing `ExTransssa` in `fi/translation.json` line 1068 was left.
- The git status also shows deleted `docs/user-guide/images/*`, a modified `scripts/dev/record-user-guide.mjs` and two `plans/reports` files; those are other sessions' work, not mine.

## Test results

All run with `NODE_OPTIONS=--no-experimental-webstorage npx vitest run ... --testTimeout=120000`:
- `electron` + `src/locales` + `src/components/ScreenContext`: 79 files, 1668 tests, all passed.
- `src/app` + `src/viewer` + `src/components/Settings` + `src/components/ScreenContext`: 127 files, 1647 tests, all passed.
- `node --check electron/main.js`, `require('./forge.config.js')` and `bash -n pkg-scripts/*` are clean; `tsc --noEmit` reported nothing for `vite.config.ts`. `build.yml` was not parsed (no PyYAML here); its edits are plain string substitutions and `store-installer.consistency.test.js` pins them.
- Not run: an actual packaged build or an Electron launch of the renamed app.

Status: DONE_WITH_CONCERNS
Summary: Electron user-visible strings, packaging names, locales and the DESIGN/REVIEW notes now say ExTrans, and userData plus the macOS logs folder are pinned to the old `Sokuji` folder with tests; all touched and related tests pass.
Concerns/Blockers: No packaged build was run, so the installer and bundle names are verified only by tests and reading. Release artifact names changed (`ExTrans-*.Setup.exe`, `.pkg`, `.AppImage`); check any backend route that pins them. `scripts/verify-macos-selfsigned.sh` and one SCSS comment still say Sokuji.
