# UX/AX review: ExTrans (Sokuji) browser extension — 2026-11-27

## Verdict

The extension now has a navy and blue look in both the dark and the light scheme. It uses
gradient pill actions, softer cards, a progress meter in the setup wizard and a matching popup,
and the product is renamed ExTrans with an original icon. The biggest remaining gap predates this
work: at 420 px the main panel's bottom bar is wider than the panel, so the Start Session pill is
clipped. The DONE contract holds except for that item and the items marked N/A below.

## Scope and environment

- Mode `--auto`, run overnight from the parent session. Worktree `sokuji-ui-exchain`, branch
  `ui-exchain-theme`. Nothing is pushed.
- Commits: `7e14a223` (restyle), `b484804f` (ExTrans rebrand), `9ce2f6b5` (dark conversation
  area), plus the docs commit that adds this report.
- Surfaces: `fullpage.html` (the six wizard steps, the tour, the main panel, settings) and
  `popup.html`, each in the dark and the light scheme.
- Viewports: the extension is a side panel, so it was captured at 420×860 (the real panel width)
  and 1280×860. The skill's 1440, 768 and 375 widths do not apply to a side panel.
- The capture script is `/tmp/sokuji-ui-shots/shoot.mjs`. It loads the built extension in Chrome
  for Testing with a throwaway profile.
- **Not run:** the discovery-surface scan (AX). An extension has no public URL, sitemap or
  `llms.txt`, so the scan is N/A, not a pass.

## Baseline evidence

`enhance-ux-ax-261127-0025-exchain-theme/before/` and `after/` each hold 28 PNGs: 14 per scheme,
covering the wizard steps 1–6 (plus step 3 with a choice made), the tour, the main panel at 420
and 1280, settings at 420 (top and scrolled) and 1280, and the popup. `compare/` holds
before-and-after pairs side by side.

## Scores (0–3, before → after)

| Area | Score | Evidence |
|---|---|---|
| Brand recall | 1 → 3 | A generic green on gray became a distinctive navy and blue gradient, with the new name and icon (`compare/dark-wizard-step1.png`). |
| First impression | 1 → 2 | The wizard card floats over soft glows and has a progress meter (`after/*-wizard-step1.png`). |
| Content punch | 2 → 2 | The copy is unchanged apart from the name. |
| Hierarchy | 2 → 3 | One gradient primary action per view; secondary actions are outlined pills; the step badge is a chip. |
| Motion | 1 → 2 | 1 px lift and shadow on cards and buttons, with reduced-motion fallbacks. |
| Responsive (420 px) | 2 → 2 | The wizard and popup fit. The bottom bar overflow is pre-existing and unchanged. |
| Trust | 2 → 3 | A consistent palette across the popup, the panel and the wizard, and a calm fintech-style navy. |
| Accessibility | 2 → 3 | Dark text and accent fills now have test-enforced contrast floors (`DARK_FLOORS`). Fill-hover contrast is fixed on 8 buttons. Focus rings are added in the popup. |

## Proposals

### P1 — Navy and blue token restyle (Must, done in `7e14a223`)
- **Change:** re-value the dark and light `--sk-*` blocks. Add `primary-fill-end` (54 tokens) and
  the `primary-gradient` mixin, radii, shadows and the pill radius.
- **Acceptance:** `theme.consistency.test.ts` passes, including the new dark floors. Passed.

### P2 — Wizard polish (Should, done)
- **Change:** progress meter, step chip, floating card, selected-card accent bar, pill footer
  buttons.
- **Acceptance:** `after/*-wizard-step*.png` show these in both schemes. Passed.

### P3 — Popup follows the scheme (Should, done)
- **Change:** `theme-boot.js` is loaded in `popup.html`, and `popup.css` is rewritten on `--pp-*`
  variables.
- **Acceptance:** `after/dark-popup.png` and `after/light-popup.png` differ by scheme. Passed.

### P4 — Fill-hover contrast (Must, done)
- **Change:** eight white-label buttons hovered to a text colour; they now hover to
  `primary-fill-hover`.
- **Acceptance:** the colour ledger and role audit pass. Passed.

### P5 — Dark conversation area in navy (Must, done in `9ce2f6b5`)
- **Change:** the theme-following dark default moves from `#1f1f1f` to `#0d1530`.
- **Acceptance:** the body pixel of `after/dark-main-420.png` is navy. Passed.

### P6 — ExTrans rebrand (user request, done in `b484804f`)
- See `review-notes-261127-extrans.md`.

### P7 — Bottom bar at 420 px (Should, not done)
- **Evidence:** the Start Session pill is clipped on the right in both `before/dark-main-420.png`
  and `after/dark-main-420.png`.
- **Change:** wrap the control row or collapse the device selects into an icon at narrow widths.
- **Why not done:** it is a layout change to `MainPanel` beyond a restyle. It is left for the
  owner's decision.

### P8 — Settings at 420 px (Could)
- At 420 px the settings button on the title bar shows as pressed, but the capture still shows
  the conversation. At 1280 the settings column opens beside the panel.
- **Next step:** check whether settings opens as a full-width page at 420 px.

## DONE contract

1. Must and Should items meet their checks, except P7, which is not done for the reason given above.
2. Discovery scan: N/A (an extension has no public site).
3. Screenshots in both schemes at 420 and 1280: no new overflow, clipping or overlap. The bottom
   bar overflow is pre-existing (P7).
4. No rubric area regressed.
5. Reduced-motion fallbacks are present on every new transform and transition. Focus-visible rings
   are present. This was checked in the code; the UI was not driven by keyboard.
6. Build passes. The full suite passed after the rebrand (14782 tests, with one load-flaky
   timeout that passes on rerun). The affected suites passed again after the later fix (1398
   tests). On this machine the style tests need `--testTimeout=120000` (load average about 38).
7. `DESIGN.md` and `REVIEW.md` are added. `CLAUDE.md` points to them, which is this repo's
   equivalent of `AGENTS.md`.
8. No dev server was started. Each capture browser was closed by its script, and the profiles are
   deleted at cleanup.

## Unresolved questions

1. Should Nunito (exchain's font) be bundled? It is not: `uiFont.test.ts` pins the system stack.
2. White on the dark error (3.70:1) and usage (2.85:1) fills is below 4.5:1. This predates the
   restyle and these are the owner's status hues. Should they change?
3. Should P7 (the bottom bar at 420 px) be fixed in this branch or separately?
4. Should the Electron app's own packaging be renamed to ExTrans? Until it is, the macOS
   permission strings say "Sokuji".
