# Road to Drops v0.1

Status: PRD draft — current-state baseline; release scope awaits product decisions.
Baseline reviewed: 2026-10-04.

## 1. Purpose

Define the work needed to turn the current Drops implementation into a dependable first release. This document will become the implementation handoff for a new agent once scope and acceptance criteria are agreed. Proposed work below is not yet an approved feature specification.

## 2. Locate the actual app

- Repository: `C:\Users\ridha\Work\Apps\creatine`
- App and command working directory: `C:\Users\ridha\Work\Apps\creatine\expo-app`
- Remote: `RidhaChowdhury/Creatine`; current local branch: `main`.
- `C:\Users\ridha\Work\Apps\drops` contains the original design references; it is not the app being served at port 8081.
- Read repository `AGENTS.md`, app `README.md`, `docs/development.md`, and `docs/data-and-release.md` before implementation.
- The rebuilt app and setup changes currently include many modified and untracked files. A fresh remote clone will not contain this working-tree state. Arrange a reviewed commit or complete working-tree transfer before delegating to another machine or checkout. Do not reset, clean, or overwrite this work.

## 3. Product direction already agreed

- Water, supplement, and medication tracking.
- Pitwall visual direction: black `#0c0c0c`, light text `#e9e9e9`, blue `#398eff`; condensed typography and precise labels.
- Tamagui owns the shared UI. Skia is a core visual technology.
- Water fill and submerged number text share identical wave geometry.
- Two square quick-add water controls; one primary tracker action on Today.
- Additional trackers and primary selection are managed in Supps.
- Browser review requests four destination tabs: Home, Supplements, Insights, and History, with a central circular plus action. The navigation spans the app bottom with a transparent background.
- Tracker profiles must support a saved dose and intake frequency; daily intake progress is shown as dots on the primary tracker action. Tracker editing and detailed logging use Tamagui sheets.
- Tasteful action feedback after persistence, exact-entry Undo, independent sound/haptics, reduced motion, and inactive animation pausing.
- Preserve existing user data.
- Minimize the user's manual testing through an automated verification loop.
- Use a separate Supabase test project for cloud fixture writes and destructive integration tests.
- Use the app browser's native annotations for visual feedback on the running app. Preserve incoming annotations and the five imported BugHerd notes in `docs/DROPS-V0.1-FEEDBACK.md`, then synthesize them into this PRD before the implementation handoff.

## 4. Current implementation

| Area | Present today | Limits |
| --- | --- | --- |
| Today | Real daily water total and configured goal; 8/16 oz presets with ml conversion; primary tracker saved-dose action; add receipt and exact Undo | Full browser and device regression coverage is incomplete |
| Visuals | Skia wave, shared submerged-text mask, settling amount/level, localized impulse/reflection; Pitwall fonts and controls | Full motion must be explicitly verified while the OS reports reduced motion; native rendering/performance unverified |
| Trackers | Persistent create/edit for arbitrary supplements and medications; name, category, unit, optional saved dose; primary selection | No tracker archive/delete UI, schedules, per-tracker reminders, or direct dose logging in the Supps list |
| Dose logging | Primary tracker logs its saved dose on Today; Creatine defaults to 5 g and keeps legacy history | Blank saved doses cannot be logged through a variable-dose editor; generic entry editing is absent |
| History | Recent water, Creatine, and generic tracker entries with exact Undo; separate trends/edit route | Rich trends and editors mainly cover water/Creatine, not all trackers; legacy saturation/performance heuristics remain |
| Settings | Profile, goals, units, sound, haptics, System/Full/Reduced motion; native Creatine reminder controls | Reminder functionality is not generalized to medications; device notification behavior is unverified |
| Accounts | Supabase email/password sign-up/sign-in, session-driven startup, sign-out, onboarding | No password-recovery UI or account export/deletion flow |
| Storage | Supabase for configured cloud mode; separate local SQLite mode | Local mode is not an offline queue or synchronization layer for cloud accounts |

Medication tracking currently means recording user-entered doses and history. Scheduling, missed-dose states, refill tracking, interaction checking, and dosing advice are not implemented.

## 5. Technical baseline

- Expo 54.0.37; React Native 0.81.5; React 19.1.0.
- Expo Router, Tamagui 2.7.7, Skia 2.2.12, Reanimated, Lucide.
- Redux Toolkit coordinates settings, intake, and tracker state.
- Supabase Auth/Postgres in cloud mode; Expo SQLite in local mode.
- Barlow Condensed, Archivo, IBM Plex Mono.
- Quiet feedback through the existing interaction-feedback service, Expo Audio, and native haptics.

Commands from `expo-app`:

```text
npm ci
npm run dev                   # cloud mode, localhost:8081
npm run dev:local             # isolated local mode, localhost:8082
npm run dev:test              # separate cloud test mode, localhost:8083
npm run doctor -- --backend   # read-only health/schema diagnostics
npm run verify
npm run build:web
npm run build:native          # JS exports, not installable native builds
```

The static preview server and deployed web host need the isolation headers documented in `docs/development.md` for SQLite shared memory. Public client configuration is embedded in the exported web bundle.

## 6. Data preservation and backend state

- Production project reference: `xmkdzdqouxqmayoawztr`.
- Current audit: authentication health returned HTTP 200; zero-row schema probes passed for all five app tables. This establishes reachability/schema availability, not complete authenticated end-to-end behavior.
- Legacy water/Creatine use `intake_log`; arbitrary trackers use `tracked_items`, `tracker_entries`, and `tracker_preferences`. Profiles use `user_settings`.
- Legacy `consumed_at` is local wall time without timezone. New intake writes also record `consumed_at_utc`. Never reinterpret every legacy timestamp as UTC.
- The previously reported zero-total quick-add bug was corrected through the shared timestamp handling and a bounded historical metadata repair. Preserve that fix and test local-day boundaries.
- Migrations are additive. Fresh-project baseline, tracker tables, and UTC companion migrations are checked in.
- The repair SQL is incident-specific and must not be part of fresh-project bootstrap.
- Never write fixtures, mutate test records, or run destructive tests in production. Use the separate test project or disposable local fixtures.

## 7. Verification evidence and limits

Freshly passed for this baseline:

- TypeScript check.
- 8 Jest suites / 47 tests.
- 6 Node environment-launcher guard tests.
- PGlite verification of fresh schema, RLS/owner isolation, owner-linked foreign keys, dose constraints, migration reruns, legacy preservation, and bounded timezone repair.
- Read-only production health/schema diagnostics.

Previously passed in this workspace:

- Clean npm installation and Expo dependency alignment.
- Web export and iOS/Android JavaScript bundle exports.
- Browser smoke checks of the Pitwall interface and individual interactions.

Important limits:

- UI integration tests substitute/mock Tamagui, Skia, and database adapters. They do not verify actual canvas animation, real layout, browser focus, or live Supabase persistence.
- No checked-in browser/device end-to-end suite currently closes the loop across rendered UI, authentication, persistence, refresh, and account isolation.
- `.env.test.local` is absent at baseline; the separate cloud test environment is not configured.
- GitHub CI configuration exists locally; execution on GitHub has not been established for the current uncommitted rebuild.
- Android prebuild completed. iOS native scaffold still requires SDK alignment/CocoaPods on macOS. Native exports do not establish device compatibility.
- Physical iOS/Android builds and device checks remain pending.
- The previously recorded dependency audit had 21 advisories, including 5 high and no critical. Re-run and review before release; this is not a fresh audit count.

## 8. Candidate v0.1 workstreams — for scope approval

1. **Reliable core logging:** verify water and arbitrary doses, refresh persistence, exact Undo, failed/slow writes, repeated taps, unit changes, midnight rollover, and mixed legacy/new timestamps.
2. **Complete tracker workflows:** decide whether v0.1 includes direct logging from Supps, variable doses, entry edits, archive, and reminder schedules; preserve historical snapshots.
3. **Clear motion behavior:** make motion controls easy to discover; test System, Full, and Reduced, including Full with OS reduced motion enabled, foreground/background transitions, and font/mask geometry.
4. **History that matches the product:** decide generic-tracker filtering/trends and whether to remove or defer legacy heuristic saturation/performance displays.
5. **Closed-loop verification:** isolated backend, browser tests, failure artifacts, deterministic fixtures, and required CI gates. Never replace real persistence tests with more mocks.
6. **Release readiness:** choose release platforms; address authentication recovery, dependency advisories, native scaffold alignment, deployment configuration, and physical-device gates as required by the chosen release.
7. **Handoff integrity:** package the actual rebuilt working tree, agreed PRD, environment instructions, and evidence so a new agent starts from the correct implementation.

## 9. Requirements from browser review

Sources: `docs/DROPS-V0.1-FEEDBACK.md`, BugHerd feedback 1–5 and native annotations A–C. These are requested changes to the current implementation, not claims that the app already supports them. Detailed acceptance criteria below are a draft for the implementation handoff.

### R1. Readable dose units

- Increase the water total's `oz` label and give it visible separation from the large number.
- Reposition and resize the primary tracker dose unit, including `tsp`, using the same visual relationship between value and unit.
- Maintain the Pitwall typography, real condensed fonts, and readable layouts for longer units and doses. Verify at phone and desktop sizes.

### R2. Tracker profiles and intake progress

- Extend supplement and medication profiles with dose amount, unit, and intake frequency, while preserving name, category, and primary selection.
- Support the user's example: a saved dose of `5 g`, taken `4 times per day`.
- Show four discreet progress dots on that primary tracker button. Their placement must preserve readability of the name and dose.
- Proposed daily behavior: fill one dot per successfully persisted intake entry for the selected tracker on the current local day. Four successful entries fill four dots; a failed save fills none. Undo reverses the exact entry and updates the indicator. Refresh and tab changes preserve the result; a new local day starts its own progress.
- Describe progress accessibly, for example “2 of 4 intakes logged today”; it cannot rely on color alone.
- Keep the frequency user-configured. The example is a product behavior example, not a recommended supplement or medication regimen.
- Add frequency data through additive migrations and support both current storage adapters. Existing profiles without frequency retain their saved-dose logging and history; do not invent a schedule for them.
- Open details: the meaning of the profile's “add more” button (log another intake or add another dose/frequency configuration), frequencies beyond times-per-day, indicator behavior for extra entries and variable doses, and schedule edits during a day. Timed reminders and missed-dose alerts remain separate scope decisions.

### R3. Tamagui tracker and logging sheets

- Present tracker creation/editing as a polished Tamagui bottom sheet with the richer profile fields. The captured editor already identifies as a Sheet; inspect its actual presentation and behavior before changing component ownership.
- Ensure scrollable content, keyboard clearance, reachable save/close actions, focus management, and safe areas across screen sizes.
- The central plus opens a Tamagui bottom sheet where the user chooses water, a supplement, or a medication and logs a detailed amount/unit rather than only a saved preset. Preserve existing one-tap actions on Home.
- Proposed checks: invalid amounts prevent submission; successful writes update the appropriate total/history/progress; persistence failures give recoverable feedback; closing without saving creates no entry; repeated taps cannot silently duplicate a pending submission. Honor motion and muted-feedback settings.

### R4. Full-width bottom navigation

- Replace the current inset blue navigation strip with a clean transparent navigation region spanning the full bottom width of the app. Screen content remains visible behind it.
- Layout: **Home · Supplements · central plus · Insights · History**. Interpret the user's “four tabs” as four destinations plus one action, not five destination tabs.
- Make the central plus a prominent circular button opening the detailed logging sheet; it does not become a selected tab.
- Retain clear active destination treatment, Lucide icons, accessible names, and sufficient touch targets. Respect bottom safe areas and reserve enough content space so the navigation does not cover the last row or action.
- Verify the transparent background on Home's water and the dark secondary screens, full-width placement on phone/desktop, independent tab state, and sheet open/dismiss without navigation changes.
- Insights is a distinct requested destination; its content and relationship to existing heuristic metrics remain to be defined.

## 10. Decisions to resolve before final handoff

- Release target: web first, web plus Android, or all three platforms?
- Is v0.1 a private personal beta or a release for other users?
- Medication frequency/progress is requested above. Are timed reminders and missed-dose/adherence behavior also required?
- Required tracker lifecycle: create/edit only, or archive and variable-dose logging?
- Required history: recent diary only, or generalized trends?
- Cloud availability expectations: online-only with clear errors, or offline logging/sync?
- Which existing heuristic metrics should remain?
- What content should the new Insights tab contain?
- Resolve the open tracker frequency and “add more” semantics in R2.

## 11. Final PRD sections still to author

- Approved v0.1 scope and explicit deferrals.
- User journeys and screen behavior.
- Data contracts and migration plan for approved features.
- Test matrix with measurable acceptance criteria.
- Implementation phases/dependencies and agent ownership.
- Release checklist and completion evidence.

Do not treat the candidate workstreams as permission to implement every proposed feature. This baseline is ready for product discussion; the implementation PRD is not yet final.
