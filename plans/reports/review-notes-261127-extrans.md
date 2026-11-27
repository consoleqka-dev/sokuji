# Review notes: navy and blue restyle, ExTrans rebrand, user guide

Written overnight on 2026-11-27 for review in the morning. Branch `ui-exchain-theme`, worktree
`sokuji-ui-exchain`. Nothing is pushed.

## Commits

| Commit | What |
|---|---|
| `7e14a223` | Navy and blue restyle of the panel, wizard, settings and popup |
| `b484804f` | The display name becomes ExTrans, with a new icon (`extension/icons/source/extrans-icon.svg`) |
| `9ce2f6b5` | The dark conversation area uses the page navy; the popup's glow no longer repeats |
| `61367ab6` | `DESIGN.md`, `REVIEW.md`, the `CLAUDE.md` pointer, the user guide, the recording script, this plan and its reports |
| `7b690505` | The advanced bottom bar fits the 360 to 420 px side panel |
| `dbcb900f` | Dark-mode error and usage fills under white labels reach 4.5:1 (two new tokens) |
| `4b9569e3` | Nunito is bundled for the panel and the popup |
| `d9a6854e` | The Electron app's user-visible name becomes ExTrans; its data folders stay `Sokuji` |
| `8161542b` | The guide and video: light theme, unpacked install, a text-only Gemini key section, an optional live run |

## Where to look

- Before and after screenshots: `plans/reports/enhance-ux-ax-261127-0025-exchain-theme/`
  (`compare/` has the pairs side by side).
- The UX report: `plans/reports/enhance-ux-ax-261127-0025-exchain-theme.md`.
- The user guide: `docs/user-guide/extrans-user-guide.vi.md`, with highlighted screenshots in
  `docs/user-guide/images/`.
- The video: `docs/user-guide/media/` (git-ignored, so it stays on this machine only). It is
  recorded again with `scripts/dev/record-user-guide.mjs`.
- Design direction and review checklist: `DESIGN.md`, `REVIEW.md`.

## Decisions to check

1. **Fonts.** Nunito leads the font stack, bundled from the Fontsource package with only the
   upright Latin, Latin Extended, Vietnamese and Cyrillic subsets (about 137 KB). Each subset has a
   `unicode-range`, so a page fetches only what it draws. The system stack and CJK tail follow, as
   `uiFont.test.ts` requires. Verified loaded in the built panel and popup.
2. **Dark status fills.** White on the dark error (3.82:1) and usage (2.85:1) fills was below 4.5:1.
   One hue cannot do both jobs in dark mode: a red dark enough for white text is too dark as text
   on navy. So two tokens were added, `error-fill` (`#c0392b`, 5.44:1) and `usage-fill`
   (`#b34700`, 5.50:1), and `error-deep` (the hover) moved to `#a93226` (6.62:1). Only fills under
   a white label use them: Stop, recording, the voice library's danger hovers and the attention
   banner. The bright hues stay for text. Status dots were not changed.
3. **Fill hover.** Eight white-label buttons hovered to `primary-hover`, which is a text colour.
   They now hover to `primary-fill-hover`. This was a contrast bug before the restyle, and the new
   palette made it worse.
4. **Popup scheme.** The popup used to be light only. It now follows the app's cached scheme
   through `theme-boot.js`, so it is dark by default, like the app.
5. **Test timeouts.** On this machine (load average about 38), three style tests hit vitest's
   5-second default timeout. All of them pass with `--testTimeout=120000`.
6. **What still says Sokuji.** The Electron app now shows ExTrans in window titles, menus, dialogs,
   installers and the macOS permission, driver repair and caption-share strings (`d9a6854e`, details
   in `fullstack-developer-261127-0753-electron-extrans-rename.md`). These keep Sokuji so settings,
   permission grants and updates carry over: identifiers, storage and message keys, URLs, the
   `ai.kizunaai.sokuji` app id, the Squirrel package id, the `sokuji` executable, the virtual audio
   device and driver names and the Kizuna AI provider name. The user-data and macOS log folders are
   pinned to `Sokuji` (`electron/app-identity.js`). `docs/README.{ja,zh,vi}.md` and export file
   names were not renamed.
7. **Conversation colour.** If the user never chose a conversation background, dark mode now
   shows `#0d1530` (the page navy) instead of `#1f1f1f`. A user who explicitly saved `#1f1f1f`
   keeps it. Light mode is unchanged (`#ffffff`).
8. **Both schemes.** Light and dark are both implemented and were checked on every captured
   screen (the wizard, the tour, the main panel, settings and the popup). The scheme is switched
   under Settings → Appearance; the guide covers it.

## Known issues not fixed

- At 420 px the settings capture still shows the conversation; check how settings opens at that
  width.
- **Desktop release, not yet built or run.** No packaged app was built after the rename. Check before
  a release:
  - A Mac that already has `/Applications/Sokuji.app` and installs the new `.pkg` may end up with
    two copies, or the installer may relocate the bundle onto the old path. The postinstall script
    only looks for `/Applications/ExTrans.app`, so the driver step would then be skipped.
  - The release assets are now named `ExTrans-*`. Check whether the `sokuji-backend` download
    routes pin the old names.
  - `scripts/verify-macos-selfsigned.sh` still checks `/Applications/Sokuji.app`.

## Fixed on the morning of 2026-11-27

- **Bottom bar at 420 px.** The advanced footer needed 576 px. Below a 480 px container the input
  level narrows to 64 px, the output waveform is hidden and the language pair ends in an ellipsis.
  Measured in the built extension, the row is exactly 420 px and 360 px wide at those widths, with
  Nunito, and Start stays inside (`advancedFooterNarrow.test.ts`).
- **Wizard, step 4, with Gemini chosen.** It said "This one key serves OpenAI Realtime, Translate
  and Live", because the note was drawn for any provider whose key is shared (`storedAt`), and
  Gemini's is shared with its text model. This predated the restyle. The note is now drawn only for
  the shared OpenAI key, with a test for the Gemini case, and the guide's still 11 and the video
  were recorded again.

## Environment notes

- Homebrew's ffmpeg crashes on this machine because x265 was upgraded (`libx265.216` is missing).
  The video was made with
  `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib /opt/homebrew/bin/ffmpeg`. No
  system change was made; `brew reinstall ffmpeg` would fix it for good.
- No real API key was used or entered by the agent. The committed stills and the local video come
  from a keyless run, so step 18 shows Start highlighted but not pressed.
- The live recording (masked Gemini key, a synthetic English voice on a fake microphone, Vietnamese
  lines appearing, then Stop) is ready but must be run by the owner, who supplies the key. It was
  exercised only with a fake key, which Google rejected; the script then stopped cleanly and left
  nothing behind. Run it from the worktree:
  `export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib` then
  `node scripts/dev/record-user-guide.mjs --live` (the key is asked for without echo), with
  `extension/dist` built first. The stills 03 and 04 show the build's version and extension id.
