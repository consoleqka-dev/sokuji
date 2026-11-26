# Review notes: navy and blue restyle, ExTrans rebrand, user guide

Written overnight on 2026-11-27 for review in the morning. Branch `ui-exchain-theme`, worktree
`sokuji-ui-exchain`. Nothing is pushed.

## Commits

| Commit | What |
|---|---|
| `7e14a223` | Navy and blue restyle of the panel, wizard, settings and popup |
| `b484804f` | The display name becomes ExTrans, with a new icon (`extension/icons/source/extrans-icon.svg`) |
| `9ce2f6b5` | The dark conversation area uses the page navy; the popup's glow no longer repeats |
| docs commit | `DESIGN.md`, `REVIEW.md`, the `CLAUDE.md` pointer, the user guide, the recording script, this plan and its reports |

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

1. **Fonts.** The system font stack stays, and Nunito (exchain's font) is not bundled.
   `uiFont.test.ts` pins the stack, and bundling a webfont adds weight to the extension.
2. **Dark status fills.** White on the dark error (3.70:1) and usage (2.85:1) fills is below 4.5:1.
   These are the owner's status hues, and they fail the same way before this change, so I kept them.
3. **Fill hover.** Eight white-label buttons hovered to `primary-hover`, which is a text colour.
   They now hover to `primary-fill-hover`. This was a contrast bug before the restyle, and the new
   palette made it worse.
4. **Popup scheme.** The popup used to be light only. It now follows the app's cached scheme
   through `theme-boot.js`, so it is dark by default, like the app.
5. **Test timeouts.** On this machine (load average about 38), three style tests hit vitest's
   5-second default timeout. All of them pass with `--testTimeout=120000`.
6. **What still says Sokuji.** Identifiers, storage and message keys, URLs and the Kizuna AI
   provider name are unchanged, so settings carry over. Strings that name the Electron app as macOS
   shows it also keep "Sokuji": the screen and system audio permissions, the driver repair
   prompts, the caption-share firewall note and the "Restart Sokuji" button in the screen picker.
   They change when the desktop packaging is renamed. `docs/README.{ja,zh,vi}.md`, export file
   names and the caption-share strings were not renamed either.
7. **Conversation colour.** If the user never chose a conversation background, dark mode now
   shows `#0d1530` (the page navy) instead of `#1f1f1f`. A user who explicitly saved `#1f1f1f`
   keeps it. Light mode is unchanged (`#ffffff`).
8. **Both schemes.** Light and dark are both implemented and were checked on every captured
   screen (the wizard, the tour, the main panel, settings and the popup). The scheme is switched
   under Settings → Appearance; the guide covers it.

## Known issues not fixed

- At 420 px the main panel's bottom bar is wider than the panel, so the Start Session button is
  clipped. The same happens before this branch.
- At 420 px the settings capture still shows the conversation; check how settings opens at that
  width.

## Environment notes

- Homebrew's ffmpeg crashes on this machine because x265 was upgraded (`libx265.216` is missing).
  The video was made with
  `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib /opt/homebrew/bin/ffmpeg`. No
  system change was made; `brew reinstall ffmpeg` would fix it for good.
- No API key was used or entered. The guide uses the "No key needed" path.
