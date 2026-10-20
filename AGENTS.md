# Sporty Architecture & Universal Log of Truths

## 1. Cloud & Authentication Baseline (`sporty-6b3e9`)
- **Firebase Project ID**: `sporty-6b3e9`
- **Web App ID**: `1:863839455587:web:903ef428f7a87a3c9feb56`
- **Authentication**: Strictly Google Sign-In only (`signInWithGoogleOnly()`). Email/password and anonymous providers are disabled in `firebase.json` and deployed to Firebase Auth.
- **Bootstrap Master Admin**: `krbean0@gmail.com` (`isBootstrapAdmin()` in `firestore.rules` and `isBootstrapAdminUser()` in `src/services/firebase.js`), paired with dynamic database admin lookup (`isDbAdmin()`).

## 2. Zero-Cost Live Data & Single-Document Push Architecture
- **Client Live Scoreboard Source**: Public ESPN CDN endpoints (`site.api.espn.com/apis/site/v2/sports/.../scoreboard`) covering Pro Football (`nfl`), Pro Basketball (`nba`), Baseball (`mlb`), Hockey (`nhl`), College Football (`ncaaf`), Soccer (`soccer`), and Formula 1 (`f1`). For Formula 1, non-race weekdays automatically fall back to the active/next Grand Prix weekend schedule and 20-driver classification.
- **Persistent Multi-Select Sport Filter**: Checked sports (`selectedLeagues`) in `FilterMenu.jsx` persist automatically in `localStorage` and sync to `users/{uid}.selectedLeagues` in Firestore when signed in.
- **Adaptive Client Polling**:
  - `15 seconds` when any game on the active date is live (`state === 'in'`).
  - `60 seconds` when a game starts within 30 minutes.
  - `180 seconds` when all games are scheduled later or finished.
- **Single-Document Push Registry (`system/pushRegistry`)**:
  - Instead of querying N user documents every minute, user notification settings and FCM tokens are mirrored under `subscribers[uid]` inside a single shared document (`system/pushRegistry`).
  - `functions/index.js` (`checkLiveScoresAndNotify`) reads `system/pushRegistry` first (1 read) and respects `nextWakeTime` so daily Firestore reads stay under 3% of the 50,000/day free quota.
  - **Privacy**: `system/pushRegistry` holds every user's FCM tokens, so it is admin-read only. Clients write only their own `subscribers[uid]` key via a blind `setDoc(..., { merge: true })` and never read the doc.

## 3. Design System & Modern Web Standards
- **Color Scheme & Tokens**: Uses `<meta name="color-scheme" content="light dark">` and `:root { color-scheme: light dark; }` with `light-dark()` tokens and `@media (prefers-color-scheme: dark)` fallbacks in `src/index.css`.
- **Single-Sheet Modals**: Uses native `<dialog class="single-sheet-modal" closedby="any">` opened via `showModal()` with a bounding-box click fallback for Safari.
- **Icon Restrictions**: Never use `Star`, `Stars`, or `Sparkles` icons as decorative badges or favorite buttons. Use `Heart` for favorite teams, `Pin` for pinned tonight games, and `Bell` / `BellRing` for notification rules.
- **Typography**: `Barlow` for UI text, `Barlow Condensed` (`--font-numeric`, tabular numbers) for scores, clocks, records, and counts. Inter and JetBrains Mono were dropped (overused face, and mono read as techy rather than sporty).
- **Accent Fills**: Unified scoreboard red (`--accent-primary`: `#dc2626` light, `#f87171` dark). Any text or icon on a solid `--accent-primary` fill uses `--on-accent` (white in light mode, `#250606` in dark mode).
- **UI Shell Map**: `App.jsx` (sticky top bar: row 1 is the logo and name on the left with the `Alerts` bell and `AccountMenu` on the right; row 2 centers `< Today Oct 20 >` on mobile while also showing the `FilterMenu` pill on desktop `>= 720px`; `usePullToRefresh` touch gesture at the top of the page; `Live now` horizontal carousel with pagination dots; section sheets; mobile bottom tab bar under 720px with `Scores`, `Following`, and `Filter`), `LiveTile.jsx` (big scoreboard tile for in-progress games), `GameRow.jsx` (compact hairline-divided rows for scheduled and final games), `Score.jsx` + `useScoreFlash` (score highlights briefly on change, never on first render), `GameDetailSheet.jsx` (line score, follow/pin, win probability, plays; summary refetch every 30s only while live and open), `NotificationRulesModal.jsx` (per team or per game rules; turning a rule on for an unfollowed game pins it in the same write), `AlertsSheet.jsx` (account, push master switch, iOS install steps, followed teams), `Toasts.jsx` (manual popover so toasts render above dialogs).
- **Sticky Layout**: Root wrappers use `overflow-x: clip`, never `hidden`. `hidden` turns the wrapper into a scroll container and silently breaks the sticky top bar.
- **Header Controls**: Search and sport choice live together in one `FilterMenu` popover (never a chip track in the header). `AccountMenu` follows the itsAndroid profile pattern: a Google sign-in pill when signed out; when signed in, an avatar that opens a right-aligned menu with name and email, app links, then a hairline and Sign out at the bottom. Initials fall back locally (no ui-avatars network call).
- **Popovers**: `popover="auto"` panels positioned by `useAnchoredPopover` (based on the trigger's bounding box, because CSS anchor positioning is not broadly available). Floating panels use the `--bg-popover` surface with an elevation shadow and no border.
- **Logo**: `public/icon.svg` is a dark scoreboard tile (`#111827`) framed by the live-red outline (`#ef4444`) with an athletic white `S` stadium track and live red indicator dot. It doubles as the PWA icon.
- **Switches**: Native `<input type="checkbox" switch>` with `input-switch-polyfill` loaded only when `'switch' in HTMLInputElement.prototype` is false.
