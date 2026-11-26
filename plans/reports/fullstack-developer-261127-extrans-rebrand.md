# ExTrans rebrand: implementation notes

Date: 2026-11-27. Branch `ui-exchain-theme`. Nothing committed.

## Files changed

**Extension manifest, pages and scripts**
- `extension/manifest.json` (`default_title`)
- `extension/popup.html` (title, logo alt text, `<h1>`, button text; the `data-i18n="openSokuji"` key is unchanged), `extension/popup.js` (alert text)
- `extension/fullpage.html`, `extension/subtitle-overlay.html` (title, meta description)
- `extension/content/site-plugins.js` (every on-page title and guidance string), `extension/content/zoom-content.js` (label match, banner title), `extension/content/virtual-microphone.js` (`VIRTUAL_MIC_LABEL`)
- Outside `extension/` and `src/`, one title each: `index.html` (title, meta description) and `viewer.html` (title). Both are shown to users as page titles.

**Locales (values only; formatting and key order preserved, each file round-trips byte-for-byte)**
- All 55 `extension/_locales/*/messages.json`: 1265 values. Keys such as `openSokuji` and `sokujiAvailable` unchanged.
- All 30 `src/locales/*/translation.json`: 1261 values, minus the kept strings below.
- `src/viewer/strings.generated.ts` regenerated with `node scripts/gen-viewer-strings.mjs` (it is built from the catalogs).
- No catalog uses katakana, hangul, Chinese-character or Cyrillic forms of the name in UI strings. All 30 use Latin "Sokuji". The only matches were word-list test fixtures (`速记`, `ソクジ`), which are not display text and stay.
  - ja `tour.steps.participant-source.content_extension` and zh_CN/zh_TW `setup.credentials.offlineHardware` already omit the name. I did not add it.

**`src/` components and libs (fallback text)**
- `TitleBar.tsx`, `SubtitleBar.tsx`, `AccountPopover.tsx`, `SetupWizard.tsx`, `StepLanguage.tsx`, `StepCredentials.tsx`
- `SpeechSection.tsx`, `VoiceCreateModal.tsx`, `LicenseConsentModal.tsx`, `GpuAccelerationNotice.tsx`, `WarningModal.tsx` (loopback paragraph only), `SourcePicker.tsx` (Restart button only)
- `HistoryList.tsx`, `HistoryCategory.tsx`, `RecordNotes.tsx`
- `lib/export/exporter.ts` (export header), `lib/view/noticeText.ts`, `lib/view/echoWords.ts`
- `lib/audio/capture/tab.ts`, `lib/audio/capture/systemAudio.ts`, `lib/audio/devices.ts`, `lib/modern-audio/microphoneCaptureError.ts` (browser branch only)
- `providers/fake/*.ts` (`vendor`, shown as "powered by" in the dev-only picker)

**Store copy and READMEs**
- `extension/docs/chrome-web-store-overview*.txt` (13 files)
- `extension/README.md` and `README.md`: product renamed, one attribution line added to each ("ExTrans is based on [Sokuji](https://github.com/kizuna-ai-lab/sokuji) by Kizuna AI Lab, licensed under AGPL-3.0."). `LICENSE`, `THIRD_PARTY_NOTICES.md` and every copyright notice untouched.

**Icon**
- `extension/icons/source/extrans-icon.svg` (new): rounded square, 135° gradient `#1c46ab` to `#1572b8`, white bold "Ex" drawn as paths (no font dependency).
- `extension/icons/icon16.png`, `icon48.png`, `icon128.png`: rendered from the SVG at exact sizes (16, 48, 128; RGBA, transparent corners) by Playwright with Chrome for Testing, headless. The temp profile under `/tmp/extrans-icon-*` was deleted. I checked the 16px and 128px renders by eye: the "Ex" stays readable at 16px. The script is in `/tmp/extrans-work/render-icon.mjs`, outside the repo and not kept. No exchain artwork was used.

**Tests (assertions on changed brand text only)**
- `PresentApp.test.tsx`, `viewer/strings.test.ts`, `SpeechSection.test.tsx`, `SourcePicker.test.tsx` (button name only), `HistoryCategory.test.tsx`, `HistoryList.test.tsx`, `RecordNotes.test.tsx`, `RecordPage.test.tsx`, `autoSave.test.ts`, `exporter.test.ts`, `appAutoSave.test.ts`, `tab.test.ts`, `noticeText.test.ts`, `Conversation.test.ts`, `ProviderPicker.test.tsx` (fake vendor, and the managed twin cloned from it)
- `locales/newScreens.translated.test.ts`: `ExTrans` added to the `KEPT` brand allow-list next to `Sokuji`. Without it the "leave no English" check counted the new name as English. No test was weakened or deleted.

## Rule applied to ambiguous strings

1. A product mention becomes ExTrans: "Sokuji translates...", "Set up Sokuji", "Sokuji's translated speech", and so on.
2. The extension's virtual-mic label, and every string that tells users to pick it, becomes "ExTrans Virtual Microphone". All of them now match: the content script, Zoom matcher, plugin guidance, the `_locales` guidance, wizard/tour copy, store copy and READMEs.
3. A string stays "Sokuji" when its mention is the name an OS-level dialog or settings pane lists for the Electron app, driver or installer. This applies to the whole string, not to part of it, even when it also mentions the product. The Electron build is not rebranded, so macOS and Windows still show "Sokuji". Mixing both names inside one sentence would send users looking for the wrong name.
4. Identifiers, comments, log prefixes (`[Sokuji]`), URLs, storage keys, headers and device-matching tokens are untouched.

## Strings kept as "Sokuji"

In each of the 30 `src/locales/*/translation.json` (same keys everywhere):

| Key | Why |
|---|---|
| `audioPanel.screenRecordingDeniedText2` | Tells the user to enable "Sokuji" in the macOS Screen Recording pane. |
| `audioPanel.participantNoAudioYet` | "allow Sokuji under System Settings > ... System Audio Recording Only" (macOS pane). |
| `notices.silent_no_permission` | Same sentence as above. |
| `screenContext.picker.deniedText` | macOS permission entry for the app; mixes product and pane mentions. |
| `screenContext.picker.askedText` | "Allow Sokuji when macOS asks..."; same. |
| `audioSystem.macDriverNotLoadedBody` | "Sokuji's virtual microphone" is the macOS driver, still registered as Sokuji. |
| `audioSystem.macRepairFailedBody` | "reinstall Sokuji from the .pkg installer". |
| `audioSystem.macRepairPrompt` | Text of the macOS administrator prompt for the driver repair. |
| `captionShare.firewallNote` | The Windows firewall prompt names the Electron exe, "Sokuji". |
| `captionShare.warnNoViewers` | "allow Sokuji on private networks in Windows"; same. |

In `src/` (kept in step with the catalog copy):
- `SourcePicker.tsx:81-82` fallback text for `askedText` and `deniedText`.
- `noticeText.ts:98` fallback for `silent_no_permission`.
- `CaptionSharePanel.tsx:89` fallback for `firewallNote`.
- `microphoneCaptureError.ts:29`, the Electron branch ("Allow Sokuji to use the microphone in your system's privacy settings (macOS ...)"). The browser branch on line 30 was renamed.
- `WarningModal.tsx:26`, the default macOS TCC name `'Sokuji'` (it is a lookup value, not copy; the IPC `get-tcc-display-name` can override it).
- `useScreenContext.ts:150,179`, `reportWarning` diagnostics (log-only, Electron/macOS).
- `virtualSpeaker.ts`, `audioDevices.ts`: Electron virtual-device label tokens (`Sokuji_Virtual_Mic`, `SokujiVirtualAudio`, ...). The extension's own label is not matched by them, so no coupling broke.
- `ogg.ts:81`: the "Sokuji" vendor tag written into recorded Ogg files (file metadata, not UI).

Also kept, by explicit rule:
- `README.md`: the sentence about Kizuna AI Lab's "flagship tool" (line 31 area; it is a statement about the upstream project), the `Sokuji-x.y.z...` installer file names (Electron artifacts), and the upstream logo `alt="Sokuji Logo"` (the image is still the upstream Sokuji logo).
- URLs, the extension id, `sokuji-extension`/`sokuji-models`, `X-Sokuji-*` headers, the export file name prefix `sokuji-...`.

## Remaining grep classification

`grep -rnI "Sokuji" extension src --exclude-dir=node_modules --exclude-dir=dist`: 980 lines (3760 before).
- 304 in `src/locales/*/translation.json`: the 10 kept keys x 30, plus a few extra mentions inside those strings.
- 55 in `extension/_locales/*/messages.json`: the key name `openSokuji` only (one per file).
- ~190 `[Sokuji]` log prefixes in non-test code (`console.*`, e.g. `background.js` 49, `virtual-microphone.js` 45, `audioStore.ts`, `AppAudioRecorder.ts`).
- ~340 in tests: word-list and vocabulary fixtures ("Sokuji" as an example term, `Soku G -> Sokuji`), device-label fixtures (`Sokuji Capture`, `Sokuji_Virtual_Mic`), headers, user agents, comments and test titles. None assert a brand display text I changed. `WarningModal.test.tsx` asserts the kept TCC name; `SourcePicker.test.tsx:107` asserts the kept `askedText`.
- Remaining non-test code: comments (e.g. file headers, "Sokuji's own ..."), kept Electron strings (above), identifiers (`SokujiModelsDB`, `isSokujiSelected`, `sokujiMicPresent`, `sokujiVirtualMic`, `openSokuji` key, `sokujiAvailable` key), URLs and `X-Sokuji-*` headers.
- No display text outside the kept list remains in `extension/` or `src/`.

## Test results

Node 22.23.5, `NODE_OPTIONS=--no-experimental-webstorage npx vitest run --testTimeout=120000`.

- First full run, after the rebrand and before test updates: 16 files failed, 24 tests failed, 14758 passed, 9 skipped.
  - 23 failures were assertions on brand text I changed (listed under "Tests" above). Fixed.
  - 1 failure was `src/providers/gemini/adapter.hold.test.ts > every life settles...`: "Test timed out in 20000ms". That test sets its own 20 s limit and its comment says the bound is for a loaded machine. It touches no brand text and passes on rerun, so it is a load timeout.
- After the fixes, the 88 affected files (History, ScreenContext, SpeechSection, HistoryCategory, providers, tab, Conversation, export, transcript, view, locales, viewer, gemini hold): 1523 tests passed, 0 failed.
- Second full run after the fixes: 1061 files passed, 3 skipped, 0 failed; 14782 tests passed, 9 skipped, 0 failed (the Gemini hold timeout did not recur).
- `npx tsc --noEmit -p tsconfig.json`: 89 errors, none in a file I changed (pre-existing in `src/utils/environment.ts`, `splitSentences.ts`, and others: missing `Intl.Segmenter` and chrome typings in this project config).

## Build

`cd extension && NODE_ENV=production npm run build -- --mode production`: exit 0 (built in 47 s; only the existing chunk-size and dynamic-import warnings).
- `extension/dist/manifest.json`: `"default_title": "ExTrans"`.
- `extension/dist/_locales/en/messages.json`: `extensionName` is "ExTrans - AI Meeting Translator"; the only "Sokuji" left in the file is the key `openSokuji`.
- The built bundle contains 485 "ExTrans Virtual Microphone" strings and no "Sokuji Virtual Microphone".
- `dist/icons/icon{16,48,128}.png` are the new icons.

## Open questions

1. `SourcePicker` now reads "Allow Sokuji when macOS asks..." (kept) next to a "Restart ExTrans" button (renamed). I followed "rename the product mention". If you would rather have one name per dialog, set `screenContext.picker.restart` back to Sokuji (or rename `askedText` and `deniedText`). Either is a 30-catalog value change.
2. I kept `captionShare.firewallNote` and `warnNoViewers` as Sokuji because the Windows firewall lists the Electron exe. That goes slightly beyond the macOS/pkg/driver/pactl examples you listed. Say so if you want them renamed.
3. `index.html` and `viewer.html` (repo root) were renamed too, as page titles. They were not in the file list.
4. `docs/README.{ja,zh,vi}.md` and other files under `docs/` still say Sokuji. They are outside the stated scope.
5. Export file names (`sokuji-...txt`) and the Ogg vendor tag were kept as identifiers. Say so if the file-name prefix should change.
6. The ja and zh catalogs have a few strings that never named the product. I left them alone.
