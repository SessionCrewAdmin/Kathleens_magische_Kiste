# Quest Mode: implementation and verification

The standalone teacher dashboard is at `tools/quest-mode/`. Both desktop and mobile home entries point there. The active class comes from `KathleenClassLists.getGlobalClass()` and its roster from `KathleenClassLists.load()`. No class is inferred from the first roster or from stale gamification state. If the selected roster is unavailable, the page offers the existing unlock flow.

All displayed names and XP originate from the roster and V3 gamification state. The existing XP action catalogue, weekly and boss targets/rewards, missions, individual profiles, teams, sound, haptics, vouchers and encrypted-store integration remain in use. No production sample names or XP are added. Opening the page reconciles the active roster and initializes a new class at zero if it has no saved progression.

XP actions now record bounded per-class undo snapshots (20). Undo restores student XP, mission and goal rewards, badges, streaks, consumed power-ups, class XP, combo and boss progress. Starting a boss, changing teams, correcting XP or opening a mystery box invalidates old undo snapshots so undo cannot silently discard a later non-XP operation. The level is recalculated after rewards. Invalid students and invalid amounts cannot award class XP.

The beamer URL pins its class ID. Its DOM contains only class-level data and updates through the existing same-origin storage event. This change does not add cross-device cloud replication. The existing storage architecture remains unchanged.

An existing home To-do filter bug (`querySelector(...).forEach`) encountered in browser testing was corrected to `querySelectorAll` via the existing `$$` helper.

## Validation on Windows, 22 September 2026

- Node regression suite: 8 passed, 0 failed.
- Microsoft Edge 153.0.4234.48 and Google Chrome 151.0.7922.72, running on win32.
- Browser flow: empty state; desktop and mobile Quest entry; selected class and roster; class/student XP; undo; boss progress and undo; class isolation; reload persistence; student search; navigation routes.
- Beamer: no student names or student cards in the DOM; XP/boss updates from the teacher tab; stays pinned when the teacher switches class.
- Responsive widths: 320, 390, 768, 1024, 1440, 1920 pixels; no horizontal overflow.
- No JavaScript page errors in the tested flow.
- JS syntax and Git whitespace checks.

Browser tests use explicitly artificial `__qa_*__` records only inside a fresh isolated Playwright context. They are not part of production app initialization. No real student data or real XP was modified. Authenticated live cloud restoration and cross-device sync were not exercised.

## Reproduce

Serve the repository on `http://127.0.0.1:8765`, then run:

```sh
node --test tests/quest-core.test.cjs
node tests/quest-browser.cjs
```

The browser suite needs Playwright in the module search path and installed Edge (default). Set `QUEST_BROWSER=chrome` to use Chrome. Screenshots are written to `test-results/` and are deliberately excluded from the commit because they show QA records.

## Hero asset

File: `tools/quest-mode/landscape.webp`. Generated with the built-in image generation tool, then encoded as WebP without changing its composition (2172 × 724, approximately 125 KB). This is decorative artwork; all dashboard text, progress indicators and actions are real HTML. The approved older desktop reference supplies the layout, adapted to Kathleen pastels as confirmed by the user.

Generation prompt:

> Use case: stylized-concept. Create a single wide panoramic decorative background image for an educational fantasy quest dashboard, 1536 by 512 if possible. A richly detailed painterly 3D storybook landscape: a magical stone castle on the RIGHTMOST quarter on a small island/clifftop, slender towers with lavender roofs and blush pink pennants, mint green pine trees, a tranquil pale teal lake, soft layered distant mountains on the left, clouds. Match a polished fantasy game world map backdrop but recolor everything into gentle Kathleen pastel colors: dusty blush pink, lavender, cream, sage and mint. Bright soft daylight, sophisticated muted colors, dimensional materials, atmospheric depth, not flat vector artwork. Composition is crucial: left 65% stays visually quiet, mostly hazy lavender sky and faint distant mountain/lake with no foreground objects, for real UI overlay. Castle should occupy right quarter between vertical 15% and 85% and be completely visible in a wide banner crop. No people, NO text, NO lettering, NO UI, NO numbers, NO progress bars, NO logo, NO watermark. This is only an atmospheric background asset, not a screenshot or a whole interface.
