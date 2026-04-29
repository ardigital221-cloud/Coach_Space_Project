# Coach Space - Agent Notes

This file is the working memory for development. Keep it updated whenever the project changes, so future work starts with the right context and does not repeat old mistakes.

## Project

Coach Space is a mobile-first web app for fitness coaches and students.

Main audience:
- Coaches working from a phone.
- Students tracking workouts, plans, progress, notes, and shop items from a phone.

Production URL:
- https://coach-space-app.onrender.com

Repository:
- https://github.com/ardigital221-cloud/Coach_Space_Project

Local path:
- `C:\Users\user\Documents\New project\Coach_Space_Project`

## Tech Stack

Backend:
- Node.js
- Express
- Firebase Admin SDK / Firestore
- Firebase Storage proxy for images/videos
- Telegram bot integration through Telegraf
- Multer for uploads
- bcrypt sessions/password migration
- express-rate-limit for login protection
- compression for response compression

Frontend:
- Main UI currently lives in `public/index.html`.
- `public/app.css` and `public/app.js` exist from an earlier split, but `index.html` is currently monolithic again and does not rely on them.
- PWA files: `public/manifest.json`, `public/sw.js`, icons.

Run locally:
- `npm install`
- `npm start`
- Default port: `3000`

No build step:
- `npm run build` only prints `No build step`.

## Current Known Good State

Last known working hotfix:
- Commit `e1088b2` - restored readable Russian text after encoding regression and disabled mobile zoom behavior.

Important:
- Do not re-split `public/index.html` until the design is stable and the split is done with encoding-safe checks.
- Previous bulk extraction to `app.css` / `app.js` caused mojibake and JS syntax problems. Avoid broad encoding rewrites.
- Prefer small, reviewable patches.

## Recent Fixes

Mobile workout plan editor:
- Added a safer modal structure for the workout constructor.
- Improved mobile viewport handling with dynamic viewport height.
- Added internal scrolling for plan blocks.
- Kept action footer fixed inside the modal so it does not overlap content.
- Increased tap areas for drag/delete controls.

Performance / stability:
- Added Express compression.
- Added static cache headers.
- Added no-cache headers for `index.html`.
- Tried frontend split and tab optimizations, but rolled the frontend back to monolithic `index.html` because encoding broke live text.

Encoding hotfix:
- Restored `public/index.html` from a known working commit.
- Verified live site returns UTF-8 and readable Russian text.
- Disabled product image zoom/lightbox behavior in shop gallery.
- Set mobile input font size to `16px` to prevent iOS auto-zoom.

## Current Technical Debt

Encoding cleanup:
- `package.json`, `server.js`, `public/manifest.json`, and `public/sw.js` still contain mojibake in some Russian descriptions/comments/messages.
- Be careful: cleanup should be done surgically and tested after each file.
- `public/index.html` should be treated as sensitive because it contains the live UI and Russian text.

Service worker:
- `public/sw.js` should be reviewed before design rollout.
- It should stay network-first for HTML/API-sensitive behavior and should not keep stale broken UI cached.
- Bump cache version when changing PWA cache behavior.

Unused split assets:
- `public/app.css` and `public/app.js` are currently not used by `index.html`.
- Do not delete until confirmed safe, because old deployments/caches may still request them.

## Design Direction

User wants the app to look spectacular and not AI-generated.

Reference:
- https://rrollan.github.io/krutoisaitis213gruppa/index.html

Take from reference:
- Dark premium scene.
- Strong typography.
- High contrast sections.
- Motion and depth.
- Confident first impression.

Adapt for Coach Space:
- This is a product app, not a marketing landing page.
- Mobile UX is the priority.
- Main actions must remain thumb-friendly.
- Do not sacrifice speed or clarity for decoration.

Planned design work:
- Animated `Coach Space` intro where letters appear one by one.
- Stronger login/start screen.
- More premium mobile cards.
- Cleaner bottom navigation.
- Better modal and form surfaces.
- Light motion for cards, tabs, buttons, and active states.
- Preserve all existing business logic.

## UX Rules For Future Work

Mobile first:
- Design and test at phone widths first.
- Avoid tiny touch targets.
- Use `16px` or larger input font size to prevent iOS zoom.
- Avoid layout shifts when keyboard opens.
- Respect safe areas at the bottom of the screen.

Navigation:
- Bottom navigation must stay usable and not cover important content.
- Fixed/sticky layers must have clear z-index ownership.

Forms and modals:
- Modal content should scroll inside its own container.
- Footer action buttons should not overlap form content.
- Inputs should remain visible when focused.

Performance:
- Avoid heavy animations.
- Prefer CSS transforms/opacity for motion.
- Keep images optimized and lazy where possible.
- Do not add big libraries unless they solve a real problem.

## Testing Checklist

Before pushing design or UI changes:
- Open the live/local app on mobile viewport.
- Check login/register screen text is readable Russian.
- Check no mojibake on main screens.
- Check bottom navigation does not overlap content.
- Check workout plan constructor:
  - add block
  - add exercise row
  - focus inputs
  - scroll inside modal
  - save/cancel buttons visible
- Check shop gallery does not open unwanted zoom.
- Check console for JS errors.
- Check `node --check server.js`.
- If JS is edited, check syntax for the edited file or the extracted script.

## Git Notes

Main branch is currently used for pushes.

Recent important commits:
- `e1088b2` Hotfix encoding regression and disable mobile zoom behavior
- `7bc93e6` Refactor tab loaders into centralized map
- `a3bd96d` Harden UI with safe DOM guards
- `574f016` Optimize tab loading and shop gallery rendering
- `c4edd76` Improve performance and split frontend assets
- `256e703` Fix mobile UI/UX in workout plan editor

## Development Rule

When making future changes:
1. Preserve working functionality first.
2. Make visual changes in small steps.
3. Test mobile behavior after each major UI block.
4. Update this `agent.md` with what changed, why, and anything to watch next.

## Update 2026-04-29 (Design Phase Started)

Scope completed:
- Started visual redesign directly in `public/index.html` without touching business logic APIs.
- Added a new mobile-first visual layer with higher contrast and deeper atmosphere.
- Shifted accent direction from mostly violet toward cyan/amber balance for a less "template" look.
- Refreshed surfaces: cards, top bar, bottom nav, action buttons, and landing hero emphasis.
- Added staggered reveal motion for panel cards.
- Implemented brand intro animation: `Coach Space` appears letter-by-letter on splash.
- Increased splash display timing to let the intro animation finish before app handoff.

Files changed in this step:
- `public/index.html`
- `agent.md`

Guardrails used:
- No API route changes.
- No auth flow changes.
- No data model changes.
- No large encoding rewrites of content blocks.

Next design pass:
- Tune landing section spacing and hierarchy on narrow phones (360-430 width).
- Refine topbar and bottom-nav icon/text balance for thumb scanning.
- Review constructor/editor components visually after theme shift.
- Then run full mobile smoke test before push.

## Update 2026-04-29 (Design Phase - Pass 2)

Scope completed:
- Strengthened landing hero composition for small screens.
- Added atmospheric hero glow layer while preserving fast rendering.
- Refined cross-event card contrast, edges, and depth.
- Refined service/rules cards for cleaner mobile scanning.
- Improved bottom-nav rhythm (icon/text spacing) and topbar logout button ergonomics.
- Added extra narrow-screen polish (`<= 420px`) for type and card legibility.

Files changed in this pass:
- `public/index.html`
- `agent.md`

Status:
- Visual system is now clearly shifted to a premium mobile product style.
- Business logic unchanged.

## Update 2026-04-29 (Design Phase - Final Pass + Self-check)

Scope completed:
- Applied full internal UI polish across forms, tabs, cards, modals, toasts, and workout constructor surfaces.
- Increased touch ergonomics in workout editor controls and input rows.
- Unified contrast and borders for clearer mobile scanning in dense sections.
- Finished visual consistency pass for app-wide components under one style direction.

Validation completed:
- `node --check server.js` passed.
- Extracted inline app script from `public/index.html` and ran `node --check` successfully.
- Fixed a real runtime-risk bug in inline script: corrupted variable names inside `haversine(...)` replaced with ASCII-safe names.

Files changed in this pass:
- `public/index.html`
- `agent.md`

## Update 2026-04-29 (Critical Stability Notes)

What happened:
- During later design edits, `public/index.html` was repeatedly exposed to encoding regressions (mojibake in Russian UI text).
- A startup state was observed where splash spinner showed but title text did not appear.

Root causes:
- Unsafe full-file rewrites of `public/index.html` can silently corrupt UTF-8 Russian content.
- Splash letters originally started at `opacity: 0`, so on environments with reduced/disabled motion the text could remain invisible.

Fixes applied:
- Restored stable `index.html` baseline from commit `e1088b2`, then re-applied changes with small patches only.
- Kept and stabilized splash animation:
  - `initSplashBrand()` builds `Coach Space` per-letter.
  - `.sp-logo .char` now defaults to visible.
  - animation runs only via `.sp-logo.is-animating`.
  - `requestAnimationFrame` is used to start animation reliably.
  - `prefers-reduced-motion` fallback keeps text visible and disables nonessential motion.
- Added extra landing atmosphere effects (background drift, glow, hero pulse) without changing business logic.

Deployment/check status:
- Commits pushed to `main` with latest splash/landing fixes:
  - `c1e194c`
  - `88378a8`

Guardrails for future edits:
1. Do not run broad encoding conversion scripts on `public/index.html`.
2. Prefer `apply_patch` and targeted line edits only.
3. After any splash change, verify:
   - text visible with animations on,
   - text visible with reduced-motion/fallback.
4. Validate inline script syntax after JS edits extracted from `index.html`.

## Update 2026-04-29 (Design V3)

Scope completed:
- Reworked the visual direction in `public/index.html` without touching API calls, auth flow, data handling, or route logic.
- Added a new Coach Space V3 CSS layer inspired by the provided dark premium reference:
  - black studio/grid background,
  - oversized uppercase brand hero,
  - lime/cyan accent system,
  - stronger mobile-first CTA buttons,
  - sharper cards, modals, forms, nav, shop, nutrition, video, rules, and workout surfaces.
- Used existing local project photos for the landing/login visual atmosphere.
- Preserved the existing splash letter animation and adjusted it into the new visual style.

Validation completed:
- `node --check server.js` passed.
- Extracted inline app script from `public/index.html` and checked it with Node successfully.
- Captured mobile and desktop Chrome screenshots of the landing page and fixed mobile overflow/wrapping issues found during review.

Watch next:
- Full logged-in smoke test still needs a real local Firebase `serviceAccountKey.json` or a deployed environment.
- Keep future design edits in small CSS patches to avoid encoding regressions in Russian UI text.

## Update 2026-04-29 (Design V3 Geometry Pass)

Scope completed:
- Removed the photo-based landing/login atmosphere from the new visual layer.
- Shifted the reference direction closer to the requested site style:
  - abstract dark digital background,
  - animated grid,
  - colorful geometric shapes,
  - glassy sphere/triangle accents,
  - stronger cyber/premium mood without fitness photos.
- Added a global click/tap visual effect (`cs-click-pop`) that creates an animated ring/shape burst at the pointer position.

Validation completed:
- `node --check server.js` passed.
- Inline script extraction/check from `public/index.html` passed.
- Verified there are no remaining `photo1` / `photo2` CSS background references in the active visual layer.
- Captured mobile and desktop Chrome screenshots to review the geometry layout.
