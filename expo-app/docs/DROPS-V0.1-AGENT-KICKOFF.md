# Drops v0.1 — next-agent kickoff

Paste the following prompt into the next implementation agent. Date: 2026-10-04.

---

Implement Drops v0.1 to the final PRD and carry the work through functional integration, automated verification and ship-readiness evidence. The alignment interview is complete. Continue autonomously on ordinary implementation decisions; do not reopen the product interview.

## Start in the correct working tree

Repository: C:/Users/ridha/Work/Apps/creatine

App/command directory: C:/Users/ridha/Work/Apps/creatine/expo-app

Remote: RidhaChowdhury/Creatine. The observed branch was main, with extensive modified and untracked rebuild files. Those files are essential. A fresh remote clone/default-branch worktree does not contain this working implementation. Inspect git status and preserve all existing work. Use a codex/ branch when appropriate; do not reset or clean the checkout. A new isolated checkout must include an intentional non-secret snapshot of the current working tree.

C:/Users/ridha/Work/Apps/drops contains design references, not the application served on port 8081.

Read in this order:

1. C:/Users/ridha/Work/Apps/creatine/AGENTS.md and any applicable nested AGENTS.md.
2. C:/Users/ridha/Work/Apps/creatine/expo-app/docs/ROAD-TO-DROPS-V0.1-PRD.md.
3. C:/Users/ridha/Work/Apps/creatine/expo-app/docs/DROPS-V0.1-FEEDBACK.md, especially the final interview decisions.
4. App README.md, docs/development.md and docs/data-and-release.md; distinguish current facts from historical passes.
5. C:/Users/ridha/Work/Apps/drops/design/drops-complete-handoff-2026-10-04/README.txt and START-HERE.html, then approved images and approved History/Insights HANDOFF.txt files.

Original package: C:/Users/ridha/Work/Apps/drops/design/drops-complete-design-handoff-2026-10-04.zip.

SHA256: D9E0D44D5800B4296E598C37F512B7E36B4A6A97980509315C8406FABC48A5D9.

Accepted images supply the visual language; the final interview/PRD overrides navigation, Home actions, sheet technology and Performance meaning. The 30 HTML artboards are drafts. Inspect reference code before adapting it; do not execute arbitrary bundled setup scripts. Ignore mock phone frames/status bars and sample data.

## Product decisions to preserve

- Keep Expo 54 / React Native / Tamagui / Skia / Redux / Expo Router / Supabase and local SQLite. Preserve web LoadSkiaWeb/CanvasKit initialization. No Gluestack, NativeWind, replacement web stack or Gorhom sheet migration.
- Pitwall design: #0c0c0c, #e9e9e9, #398eff; actual Barlow Condensed and italic supplement names, Archivo brand and IBM Plex Mono fine labels. Flat, precise, quiet; no decorative stripes/card grids/gradients.
- Full-screen visible water wave is essential, including a static surface under reduced motion. Water and readout mask share exactly one wave geometry. Keep real totals, units and goals; don't show failed loading as zero.
- Transparent full-width navigation: Home / Supps / central + / Insights / History. Settings opens from Home. Center + is an action that preserves destination state.
- Home keeps water plus Performance. Move the entire water-presets/primary-dose action group into the + sheet. The sheet initially shows water presets and saved-dose actions for all trackers, with detailed entry available. Primary tracker is managed in Supps.
- Arbitrary supplements and medications persist. A simple profile's multiple doses + button reveals editable amount/time rows, including unequal doses and selected days. Support as-needed mode without completion dots.
- Dots accumulate today's quantity in schedule order. For 5 g at 09:00 and 10 g at 18:00, 7 g fills the first dot with 2 g toward the second. They do not certify timing adherence. Schedule edits recalculate today immediately; retain actual records and previous days' plans.
- iOS/Android scheduled reminders; browser upcoming/overdue displays. Suppress completed-dose reminders. Tapping a reminder opens a prefilled intake sheet; confirmation and persistence are required to log. Reconcile notifications after every relevant mutation.
- Success feedback follows successful persistence. Exact-entry Undo, idempotency, failures, compatible units, timezone/legacy data and owner isolation are core requirements.
- Settings is intentionally limited to profile/account, targets, units, water presets, reminders and motion/sound/haptics. Defer themes/drinks/import/export and launch/goal flourishes.
- Social interpretation: small optional Performance share snapshot with explicit preview and user-triggered share, plus clean extension points. No social feed, contacts, invite gates, paid tier or relaxation of private health-data RLS.

## Performance is the main domain change

The old four-contributor target-completion score is superseded. Performance estimates physical energy/readiness **now** using hydration, caffeine and modeled creatine status; fiber is excluded. Its timeline is **now − 12 hours through now + 12 hours**.

Past/current estimates use actual logs. Future estimates assume remaining scheduled doses are taken, marked as planned, with no automatic consumption writes or double counting. v0.1 assumes no additional water. Usual-pattern water forecasting is a future premium candidate.

Baseline shows a supported range while recent history is sparse; enough dense recent history permits one 0–100 score. Gaps return the user to a rebuilding-baseline range. Prior-use/established-status onboarding context never bypasses baseline-building or fabricates entries. Explicit not-using and unknown are different. The display is not permanently a range, and install age alone is not baseline readiness.

Your first domain deliverable is docs/PERFORMANCE-MODEL.md: sourced component models, assumptions/initialization, 0–100 mapping and label policy, density/recency thresholds, uncertainty-range calculation, schedule forecasting, versioning and deterministic reviewer-checked cases. Have a separate model/QA reviewer inspect it before implementing calculations. This research is your implementation responsibility, not a reason to ask the user to design formulas.

Distinguish evidence-supported behavior from product-policy choices. The intake-only combined score is an estimate; do not claim measured muscle saturation/body hydration or empirically validated feeling prediction. No subjective check-ins are in v0.1. If an honest model cannot support an informative numerical result, use the specified insufficient-data state and report the model gate unmet rather than invent a plausible number or substitute the old goal-completion score.

## Team and ownership

The user's latest instruction is to use GPT-6.1 Sol subagents with Medium reasoning for bounded implementation lanes. Model identifier: gpt-6.1-sol. Reasoning effort: medium. This supersedes the earlier GPT-6 Luna preference. Use internal subagents rather than creating user-visible sidebar chats. If the requested model is unavailable, state that once and use the available agent workflow; do not silently substitute another model or effort.

The lead owns typed contracts, shared files, integration and final release judgment. After fixing contracts, delegate non-overlapping lanes, for example:

1. Data: additive cloud/SQLite schema, adapters, schedules, mutations/Undo and owner isolation.
2. Tamagui UI: shell, Home/add, profiles, History and Settings against references.
3. Domain/QA: Performance specification review/calculations, automated browser/cloud tests and evidence.

Assign file boundaries and communicate contract changes before edits. Review and integrate each lane. Do not let individual screen-local data stores diverge from the shared repository or let a mocked test path bypass actual Skia/storage integration.

## Environments and preservation

Use Node.js 22, npm ci and the existing lockfile from the app directory.

Production Supabase is xmkdzdqouxqmayoawztr. Never seed, mutate or delete automated test fixtures there. User's production history is not a test dataset. Use npm run dev:local (8082) or the dedicated Supabase test environment via npm run dev:test (8083), whose guard rejects production. Test configuration was absent at handoff: provision/connect the separately requested test project through supported project setup, with credentials in local environment files only. No service-role credentials in Expo public variables.

Keep existing water/Creatine intake_log and generic tracker paths. Migrations are additive; do not rewrite applied files. Legacy consumed_at is timezone-free local wall time; new consumed_at_utc preserves explicit instants. Never reinterpret old rows as UTC or rerun incident-specific repairs. Preserve native identifiers/EAS project linkage and existing account access.

When a cloud/device prerequisite is absent, complete every independent task and list the exact remaining gate. Do not fall back to production, confuse a skip with a pass, or declare ship readiness without installed-device evidence.

## Closed-loop verification and delivery

Audit the baseline first. Implement focused domain/migration tests, a checked-in real-browser suite, and an isolated-cloud suite. The user should not own routine regression testing. Native browser annotations are the feedback mechanism; do not rebuild annotation tools or reinstall BugHerd.

Run narrow relevant tests, npm run verify, npm run build:web and npm run build:native. Verify the exported app via npm run preview with required COOP/COEP headers, real CanvasKit, fonts and storage. A native JS export is not a device build. Add the proposed test:e2e/test:e2e:cloud/test:visual commands and CI as implementation work where appropriate; those scripts do not exist yet.

Cover every PRD acceptance ID A01–A21: logging/custom trackers, failure/double-tap, exact Undo, equal/unequal/as-needed plans, same-day edits, History corrections and 90-day queries, conversions, real range data, baseline/gap transitions, the centered scheduled-dose forecast, identical wave/mask, reduced motion/mutes/lifecycle, responsive/accessibility/sheets, reminders, auth, isolated-cloud persistence and optional sharing.

Check 320×568, 390×844, 797×884 and 1440×900. Keep controls reachable with keyboard/enlarged text and safe areas. Retain screenshots/traces/failing assertions without secrets or production health records. Fix concrete failures and rerun affected gates.

Ship-ready includes deployable web artifacts, installable and tested Android/iOS release builds, notification delivery, usable auth/recovery, migration/deployment/rollback instructions, current dependency review and distribution-required account/data controls. iOS still requires SDK-aligned prebuild/pods on macOS; no physical-device testing had passed at handoff. Check official platform requirements when preparing distribution. Uploading/publishing and shared production migration application are separate operational steps; prepare concrete artifacts/runbooks first.

Finish with docs/DROPS-V0.1-IMPLEMENTATION-REPORT.md and docs/DROPS-V0.1-RELEASE.md. Report passed/failed/unrun criteria, exact commands/environments, device/OS/build versions, artifact locations and remaining external prerequisites. Do not call the app ship-ready until the PRD's actual release gates pass.

Keep concise progress updates and persist through compaction. Deliver the integrated app and evidence, rather than stopping at screen scaffolding, a plan, mocked analytics, a successful bundle alone, or an unverified dependency handoff.
