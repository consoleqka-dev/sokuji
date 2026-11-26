# ExTrans rebrand and user guide

Status: in progress (started 2026-11-27 00:43, Asia/Saigon). Branch `ui-exchain-theme`, worktree
`sokuji-ui-exchain`. Builds on the navy and blue restyle (commit `7e14a223`).

## Outcome

1. Every name a user sees in the browser extension says **ExTrans** instead of Sokuji, in all
   locales, with a new original icon. The AGPL-3.0 license and the attribution to Sokuji by
   Kizuna AI Lab stay.
2. A clean user guide (Vietnamese, since the owner asked in Vietnamese) with one screenshot per
   step and a highlight on the exact control to click.
3. A guide video with the same highlights: a ring around the control, a numbered caption, and a
   pause before each click.

## Constraints

- Rename display text only. Keep internal identifiers, because renaming them would lose users'
  saved data or break tests and links: storage keys (`sokuji.theme`, `settings.*`), CSS classes,
  npm package names, the `sokuji-models` cache, backend URLs (`sokuji.kizuna.ai`), store links,
  the GitHub repository and the extension ID.
- The provider name "Kizuna AI" is a service, not the app brand. It stays.
- Electron packaging stays out of scope: `productName`, installers, the macOS driver, pactl sink
  names. Strings that name an OS-registered Electron artifact that is still called Sokuji (macOS
  privacy panes, the `.pkg` installer, the virtual drivers Electron creates) keep "Sokuji", and
  each one kept is listed in the review notes.
- The extension's own virtual microphone label, which its content script injects into meeting
  sites, is renamed together with every string that tells users to pick it.
- No API keys are read, typed or recorded. The guide shows where a key goes and then uses
  "Skip for now".
- Do not commit the video. Binary size belongs outside git. Commit the screenshots and the
  recording script.

## Phases

| # | Phase | Owner | Depends on | Done when |
|---|---|---|---|---|
| 1 | Rebrand display text and icon | Sonnet 5.5 worker (high effort) | restyle commit | The grep below finds only allow-listed hits; tests and build pass |
| 2 | Verify the rebrand: build, full tests, screenshots in both schemes | controller | 1 | After-screenshots show ExTrans; no new test failures |
| 3 | User guide, screenshots and highlighted video | Sonnet 5.5 worker (high effort) | 2 | Guide, images and mp4 exist; the script re-runs cleanly |
| 4 | Review notes, report, commits, cleanup | controller | 3 | Review notes list every decision; no browser or profile left behind |

### Phase 1: rebrand

- Files: `extension/manifest.json` (`default_title`), `extension/_locales/*/messages.json`,
  `extension/popup.html` and `popup.js`, `extension/fullpage.html` and other extension html titles,
  the extension's content scripts where they show text or name the virtual microphone,
  `src/locales/*/translation.json` (values only, never keys), components with hard-coded
  "Sokuji" display text, `extension/docs/chrome-web-store-overview*.txt`,
  `extension/README.md` and the root `README.md` (an attribution line).
- Transliterations such as カタカナ forms in CJK catalogs become "ExTrans" in Latin script.
- Icon: an original monogram. Its source is `extension/icons/source/extrans-icon.svg`, rendered
  to the existing `icon16/48/128.png` paths. No exchain artwork is used.
- Tests: update assertions only where they check the brand display text.
- Check: `grep -rnI "Sokuji" extension src --exclude-dir=node_modules --exclude-dir=dist` leaves only
  identifiers, comments, URLs and the listed Electron exceptions.

### Phase 3: guide and video

- `docs/user-guide/extrans-user-guide.vi.md`: install, open, the six setup steps, the tour, start a
  session, the mode picker, settings, the popup, and troubleshooting. Each step gets one image.
- `docs/user-guide/images/*.png`: annotated screenshots with the highlight burned in.
- `scripts/dev/record-user-guide.mjs`: drives the built extension with Playwright, injects the
  highlight overlay, writes the screenshots and a WebM, and converts it to MP4 with ffmpeg.
  Paths come from arguments or the environment; nothing is user-specific.
- Video output: `docs/user-guide/media/extrans-user-guide.mp4`. The file is git-ignored and
  reviewed in place.
- Limits: there is no key and no live audio, so the video shows where to start a session but
  not a live translation.

## Acceptance

- `cd extension && NODE_ENV=production npm run build -- --mode production` passes.
- `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` on Node 22 has no failure that is
  not shown to be pre-existing or a load timeout. Rerun with `--testTimeout=120000` when the
  load average is high.
- After-screenshots of the wizard, the main panel, settings and the popup in both schemes.
- The review notes at `plans/reports/review-notes-261127-extrans.md` list every change and decision.
