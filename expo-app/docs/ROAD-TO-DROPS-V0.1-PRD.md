# Road to Drops v0.1 — final implementation PRD

Version: 1.0 · 2026-10-04
Status: interview reconciled; ready for implementation handoff. This document specifies work to build, not features already completed or a certification of release readiness.
Quality goal: a ship-ready browser app plus installed, tested iOS and Android builds. The beta is open; preserve account/auth behavior and avoid invitation infrastructure. Deployment and store submission are distinct operational actions; prepare the artifacts and release runbook without treating bundle exports as finished releases.
Companion: [next-agent kickoff](C:/Users/ridha/Work/Apps/creatine/expo-app/docs/DROPS-V0.1-AGENT-KICKOFF.md). Original feedback and interview answers: [feedback record](C:/Users/ridha/Work/Apps/creatine/expo-app/docs/DROPS-V0.1-FEEDBACK.md).

**2026-10-05 user-feedback amendment:** the transparent navigation treatment below is superseded by a continuous dark full-width bottom surface, with compact icon/label feedback instead of rectangular tab backgrounds. Content must remain visible above that surface. History keeps the approved flat timeline, with consistent row alignment and comfortable whole-row targets.

## 1. Outcome

Deliver a complete, coherent Drops experience for logging water, supplements, and medications; reviewing intake history; and understanding logged routines through transparent Insights. Keep the Pitwall visual identity and Skia water as core product qualities. Persistence, readable states, and restrained feedback must work together.

The user should be able to configure a tracker, record its saved or custom dose, see today's intake progress, correct a record, and understand the resulting history and charts without manual workarounds. Performance estimates physical energy/readiness now from available hydration, caffeine and creatine-status data. The implementation agent owns the verification loop.

### Interview decision summary

| Area | Final decision |
| --- | --- |
| UI and motion | Expo/Tamagui; Skia wave and matching text mask; quiet logging feedback; extra launch/goal moments deferred |
| Navigation | Home / Supps / + / Insights / History; Settings from Home; transparent full-width bottom bar |
| Home / add | Home keeps water and Performance; all preset/saved-dose actions move into +; detailed entry remains available |
| Profiles | Simple saved dose; multiple doses + exposes editable amount/time rows; selected days; unequal doses; as-needed mode |
| Dots | Today's amounts accumulate in schedule order; partial doses count toward the next dot; timing is separate |
| Reminders | Native scheduled notifications, suppress completed doses; tap opens prefilled sheet for confirmation; browser upcoming/overdue displays |
| Schedule edits | Recalculate today immediately; preserve actual records and earlier days |
| Performance | Physical energy/readiness at now; hydration, caffeine and modeled creatine status; exclude fiber |
| Timeline | Now − 12 hours to now + 12 hours; past uses actual logs; future assumes remaining scheduled doses are taken |
| Baseline | Show a range while recent history is sparse; show one 0–100 score after baseline is established; return to range after gaps |
| Onboarding | Ask prior creatine use and self-assessed established status; still begin in baseline-building mode |
| Future water | v0.1 assumes no additional water; usual-pattern forecasting is a future premium candidate |
| Settings | Profile/account, targets, units, water presets, reminders, motion/sound/haptics; additional complexity deferred |
| Release / social | Ship readiness is required; preserve open access; prepare future social extension points, with the limited sharing interpretation in section 16 |

### Scope decisions

- Use the current Expo/Tamagui rebuild, not a replacement web application.
- Move the entire Home quick-action group—8/16 oz presets and primary supplement action—into the universal add sheet. The latest native annotation overrides the Home reference image on this point.
- Confirmed navigation: Home / Supps / central + / Insights / History. History occupies the bottom-right position; Settings opens from Home. This interview decision overrides the newer mockup's bottom-right Settings destination.
- Use Tamagui Sheet for shared sheets. The bundle's Gorhom wording is superseded by the user's explicit Tamagui request and the existing shared Sheet primitive.
- Build the approved dark visual direction. A new light theme is deferred. Confirmed Settings scope is profile/account, targets, units, water presets, reminders, and motion/sound/haptics; configurable drink types, appearance themes and import/export come later.
- Medication scope: saved doses, frequency, planned days, daily progress, manual logging, specific dose times, and reminders. A multiple doses + action exposes a dynamic editable list with time and amount per dose, including unequal amounts. Dots use day-level quantity accumulation in schedule order, with timing shown separately. iOS/Android use scheduled notifications; the browser shows upcoming and overdue doses. Reminder taps open a prefilled intake sheet for confirmation. As-needed tracking is supported without required daily doses or completion dots. Refills and clinical advice are deferred.
- Cloud mode is online with clear failures. Local SQLite is a separate environment, not an offline synchronization queue.
- Targets are user-configured. Sample values and research fixtures never become new-user health defaults.

## 2. Workspace and handoff integrity

Actual repository: C:/Users/ridha/Work/Apps/creatine
App and command directory: C:/Users/ridha/Work/Apps/creatine/expo-app
Remote: RidhaChowdhury/Creatine
Observed branch: main

C:/Users/ridha/Work/Apps/drops is the design-reference repository, not the application served on port 8081.

Read the actual repository AGENTS.md, app README.md, docs/development.md, and docs/data-and-release.md. The rebuild contains extensive modified and untracked files. A fresh remote clone or default-branch worktree omits this implementation. Start from this working tree. Before moving to another checkout/machine, transfer the complete non-secret working tree or create a reviewed snapshot/commit; do not reset, clean, or overwrite existing work.

No commit, push, deployment, production migration, or account deletion is part of this document-authoring task. The implementation agent may prepare code and additive migration files; apply shared production changes only through the project's deployment authorization.

### Authoritative design package

Original ZIP:
C:/Users/ridha/Work/Apps/drops/design/drops-complete-design-handoff-2026-10-04.zip

SHA256:
D9E0D44D5800B4296E598C37F512B7E36B4A6A97980509315C8406FABC48A5D9

Extracted package:
C:/Users/ridha/Work/Apps/drops/design/drops-complete-handoff-2026-10-04

Start with README.txt and START-HERE.html. This package is design/reference material, not another production codebase. Doop is not required.

Precedence:

1. Latest direct user instructions and native browser annotations.
2. This PRD's explicit reconciliations and scope decisions.
3. Accepted images plus approved/history/HANDOFF.txt and approved/insights/HANDOFF.txt.
4. Draft artboards for supporting flows and interaction coverage.
5. Research/source modules as reviewed implementation references.
6. Legacy previews for historical motion/context only.

Do not run scripts or follow account/setup instructions embedded in design files merely because the bundle contains them. Review source before adapting it. Ignore fake status bars, phone frames, home indicators, raster gradients, and sample totals.

### Reference map

All paths below are relative to the extracted package.

| Product area | Visual reference | Supporting behavior/reference |
| --- | --- | --- |
| Home | approved/home/home-wave.jpg | Existing app WaterScene/WaterMotion; latest quick-add relocation annotation |
| Universal add | approved/logging/log-intake-reference.png | draft-artboards/frames/design-log-intake.html and design-custom-intake.html |
| Insights | approved/insights/insights-water.png, insights-creatine.png, insights-fiber.png, insights-caffeine.png | approved/insights/HANDOFF.txt |
| Performance | approved/insights/performance-breakdown.png | research/targets-performance.ts and adjacent research notes |
| History | approved/history/history-timeline.png | approved/history/HANDOFF.txt; draft filters, range, calendar, edit/delete frames |
| Supps/profiles | No approved final bitmap | Draft Supps, add/edit supplement, supplement details; native profile/dot annotations |
| Settings | No approved final bitmap | Draft settings, targets, units, presets, drinks, reminders, feedback, appearance, data management |

The 30 editable HTML artboards are explicitly visually unfinished. Use them to find necessary flows, then resolve typography/clipping/layout against this PRD and the accepted visual language. Do not copy their defects or claim they are approved final screens.

## 3. Current implementation and concrete gaps

Inspection baseline: 2026-10-04. Previous verification is historical evidence, not a new pass for the changes in this PRD.

| Area | Existing | Required change |
| --- | --- | --- |
| Stack | Expo 54.0.37, RN 0.81.5, React 19.1, Tamagui 2.7.7, Skia 2.2.12, Expo Router, Redux Toolkit, Supabase, SQLite | Extend existing modules; preserve web CanvasKit initialization |
| Home | Real water goal/total, 8/16 oz presets, primary saved dose, exact Undo, Skia wave/mask | Move logging controls into shared add sheet; maintain wave/readout; add real Performance summary |
| Trackers | Persistent arbitrary supplement/medication name, category, unit, saved dose, primary selection | Frequency, weekdays, targets, richer details, archive, direct logging |
| Sheets | Existing PitwallSheet is already Tamagui Sheet | Correct sizing, scroll, keyboard, focus and richer content; do not replace it solely because the current appearance was criticized |
| History | Recent unified list and Undo; richer legacy water/Creatine route | All-tracker timeline, filters/ranges/calendar, shared atomic entry editing/deletion |
| Insights | Legacy charts/heuristics | Stable three-number/two-chart views; real range data; reviewed estimated-state and Performance models with disclosed assumptions |
| Settings | Profile/goals/oz-mL and g-mg preferences, sound/haptics/motion, native Creatine reminder | Deliberate core settings index and focused editors; targets, units, presets and scheduled reminders |
| Storage | Legacy water/Creatine intake_log; generic tracked_items/tracker_entries/tracker_preferences; user_settings | Additive schema for schedule/targets/notes/edit/archive, source coverage and versioned policy |
| Tests | TypeScript, 47 Jest tests, 6 launcher tests, PGlite migration/RLS checks previously passed | Real browser and isolated-cloud end-to-end coverage; mocked canvas/database UI tests are insufficient |
| Native | Android prebuild; native JS exports previously passed | iOS SDK scaffold alignment on macOS and physical-device verification remain |

The design bundle describes capabilities from another/legacy app, including L/cups, preset management, appearance and hydration reminder controls. Do not report those as working here without checking this Expo app. Current measurement helpers handle oz↔mL and g↔mg; broader compatible units require implementation.

Production Supabase reference: xmkdzdqouxqmayoawztr. It was reachable with HTTP 200 health/schema probes earlier; that did not verify authenticated persistence end to end. Separate test project configuration is still absent.

## 4. Visual system and accessibility

- Flat Pitwall design: black #0c0c0c, light text #e9e9e9, blue #398eff, restrained gray labels and fine separators. Consolidate the draft's near-black/off-white variants into shared tokens.
- Barlow Condensed 600 for large values; real italic 600 for supplement names. Archivo 800 brand; IBM Plex Mono for fine labels/units. Use a readable shared body font, with Inter for the new standard UI text if required to match the mockups; load actual font assets.
- No transform-based font stretching, decorative racing stripes, motivational copy, rounded-card grids, or decorative gradients. Solid chart fills and subtle surface reflection are permitted.
- Square water preset buttons, 0 px radius. Primary dose action keeps its small 4 px radius. Central plus and active marker remain circular. Sheets may have restrained top rounding; do not make every component the same shape.
- Full app surface on desktop, with responsive content widths and deliberate whitespace. Bottom navigation spans the app width; it is not an inset strip.
- At 320×568, 390×844, the annotated 797×884 viewport, and 1440×900: no horizontal overflow, truncated essential values, clipped chart labels, or unreachable sheet actions.
- Support long custom names, large/decimal doses, multiple units, empty/loading/error states, keyboard focus, screen readers and enlarged text.
- Minimum 44×44 interactive targets. Selected tabs, status dots, limits and unknown data have text/semantic equivalents; never depend solely on color.
- Navigation background is transparent on every destination. Reserve bottom content padding and account for safe areas so it does not obscure rows or controls.
- Meaningful Lucide icons and accessible names; icons are not the only labels in settings or unfamiliar actions.

## 5. Navigation and Home

### N1. App shell

Four destinations: Home, Supps, Insights, History. History is at the bottom right. Settings opens from Home's header control. Centered + is an action, not a selected destination. Retain destination state after opening/dismissing the sheet. Back/dismiss behaves predictably on web and native. Each destination keeps its selection/filter state; native/browser route history supports returning to context.

Use the same full-width transparent navigation everywhere. Keep selected treatment legible against both water and dark screens. The central circular plus is larger/prominent without interfering with adjacent touch targets.

### H1. Water scene

- Full-screen water, visible essential wave, small 01 WATER label, real configured goal/range, subtle level rail, very large condensed total.
- Text changes from light to black exactly where the water crosses it. One shared geometric wave/path/time source drives the water and text clipping mask; independent approximations are unacceptable.
- Increase the readout unit size and spacing according to feedback 1. Values and units stay legible with conversions, long totals and font loading.
- At zero intake and reduced motion, keep a visible static wave/surface near the bottom. Loading or failed data is “—”/loading/error, not an invented 0. The accessible total and goal use true persisted values; a minimum decorative visible surface does not imply consumed volume.
- Fill tracks the configured minimum/goal and clamps visual overfill safely. A configured maximum is displayed as context/rail without inventing a recommended limit.
- Remove the water preset and primary supplement logging group from Home. The group moves into the + sheet; no duplicate Home logging bar or swap control.
- Home content: a small Performance summary below the water readout, occupying the freed lower area. It estimates physical energy/readiness now from available hydration, caffeine and modeled creatine-status data; fiber is excluded. Show a readiness label and tappable breakdown. Use a range while building/rebuilding the baseline, and a single 0–100 score when recent history supports it. Its timeline spans the last 12 hours through the next 12 hours. Forecasts assume remaining scheduled doses are taken. See P1 for baseline and model requirements.
- The primary tracker is still selected in Supps, and becomes the first full-width supplement/medication action in the add sheet.

## 6. Universal logging, profiles and intake progress

### L1. Shared Tamagui intake sheet

Open from + on any destination. Confirmed first view: water presets and saved-dose actions for all trackers, with a detailed-entry option. Match the accepted log-intake composition with:

1. Water presets, initially the user's existing presets or the existing 8/16 oz defaults, as two equal square controls. Manage presets in Settings; no adjacent settings button.
2. Full-width primary tracker saved-dose action with name, dose/unit and daily progress dots.
3. Remaining active supplements/medications with saved-dose actions; support arbitrary names, not just Creatine/Fiber/Caffeine.
4. Custom intake action opening a detail form within the shared sheet flow.
5. Clear dismissal and accessible focus handling.

One tap on a valid saved-dose action logs that amount. A tracker without a saved dose opens custom logging; it never logs 0 or receives a guessed dose. Keep the amount/unit relationship readable, including tsp, as requested in feedback 2.

Custom intake: water or an arbitrary supplement/medication tracker, positive finite amount, compatible unit, consumption date/time, optional note. Default to now; v0.1 logs actual consumption, so future timestamps are rejected. Historical intake can be logged explicitly.

Configurable drink types and linked drink/caffeine intake flows are deferred. Water and caffeine retain their explicit independent quantities; do not infer caffeine content or fabricate duplicate entries.

### L2. Persistence and feedback

- Await persistence before success sound/haptic/check/ripple, progress dots, success receipt or confirmed total.
- Prevent duplicate writes for one pending action using operation IDs/idempotency. Distinct deliberate repeated taps create distinct entries; do not permanently lock the control.
- Pending/failure feedback is local to the action; failure keeps recoverable input and does not fabricate an entry.
- Receipt identifies the saved tracker/amount and offers exact-entry Undo.
- Undo uses saved identity/type/version, never a guessed subtraction or “delete newest.” Undoing an add removes that entry only; undoing a deletion restores the exact snapshot. Guard stale/racing operations.
- Recompute Home, dots, history, Insights, coverage, reminders and Performance from the resulting records after add/edit/delete/Undo.

### T1. Supplement and medication profiles

Fields: name, category, compatible display unit, optional saved dose, optional daily quantity target/limit, planned weekdays, optional intakes-per-day, specific scheduled dose times with reminders, primary selection. Creatine-specific optional protocol start/form/prior-use context and caffeine bedtime/half-life assumptions belong in appropriate detail sections.

- Daily frequency accepts a positive integer; default is unset for existing profiles, not a fabricated schedule.
- Example behavior: 5 g per intake, four intakes per day, on selected days. Saved dose, number of intakes and daily quantity target are distinct. An optional suggestion of 20 g/day requires explicit user acceptance; do not silently derive a prescribed target.
- Provide a multiple doses + button that exposes a dynamic editable dose list. Each row lets the user pick when and how much; add/edit/remove rows and support different amounts at different times. Keep the initial profile simple through progressive disclosure. A separate logging action records an actual intake through the shared detail sheet.
- Support as-needed mode: arbitrary actual intake logging without required daily doses, completion dots, or scheduled-dose reminders. Switching modes preserves historical entries and the applicable historical plan.
- Persist schedule edits immediately. Recalculate today's accumulated progress, upcoming/overdue state and remaining notifications using the new plan. Preserve actual entry amounts/times and prior days' plan versions. Forecasts use the new effective plan; historical estimates retain their applicable configuration version.
- Create/edit use the polished Tamagui profile sheet. Do not force all fields into the first screen; use coherent sections and scroll, not an 88%-height blank panel.
- Supps list shows each tracker, current-day logged amount, plan/progress, saved-dose action and clear primary selection. Opening the row goes to details; logging and selecting primary have distinct controls.
- Archive is reversible, removes future quick actions, keeps historical names/entries/targets, and clears an archived primary. Restore reactivates it. No destructive tracker cascade.
- If no active primary remains, the add sheet lists active trackers without a primary bar.

### T2. Intake dots

For a tracker configured four doses per day, display four small dots in its saved-dose action and relevant Supps summary. Confirmed meaning: each dot represents one planned daily dose, and smaller intakes accumulate toward completing those doses today. With a 5 g × 4 plan and 12 g logged today, two dots are complete and 2 g remains toward the next planned dose. Never fill a whole dot merely because a positive intake entry exists.

Allocate the day's total in chronological schedule order, including unequal amounts: for 5 g at 09:00 and 10 g at 18:00, 7 g logged today completes the first dot and contributes 2 g toward the second. Show scheduled timing separately; a completed dot does not claim consumption at that time. Retain actual entry timestamps. Partial-dot visual treatment remains a design detail to reconcile with the approved restrained style. Actual logged amounts and dose allocations remain distinguishable in accessible text.

Use its saved timezone and planned-day context. Today resets to its own day. Four completed planned doses fill four dots; extra quantities remain loggable and appear as an explicit amount beyond the plan, without adding false required dots. As-needed mode and no schedule mean no invented dots; an unscheduled day shows no planned obligation. Show dots up to eight; larger plans use a compact completed/total count to avoid overflow. These are implementation defaults within the confirmed restrained design.

Undo/delete reverses the exact entry and recomputes accumulated dose progress; editing timestamp/tracker moves the amount to the correct day/tracker. Saved-dose or quantity-target edits never rewrite historical entries. Announce completed planned doses and remaining progress, for example “2 of 4 planned doses complete; 2 g toward the next dose.” This is logged plan progress; it does not establish timing adherence or physiological effects.

### T3. Compatible units

Water: US fl oz (display “oz”), mL, L, and cup (explicitly defined as 240 mL in this app, not labeled US customary cup). Keep the definition visible in unit details. Preserve precision; round only display. Keep source units and the conversion version on migrated/new records. Legacy conversion behavior must not be silently rewritten.

Supplements/medications: supported mass g↔mg, volume mL↔US tsp/US tbsp, or discrete units such as capsule/tablet/serving and user-defined units. Never convert volume into mass or tablets into ingredient mg without an explicit tracker-specific user conversion. Fiber logged in tsp cannot supply gram-based Insights unless that conversion is configured. Custom units can always retain native-unit diary/progress behavior.

## 7. History

Selected direction: flat, date-grouped chronological timeline from approved/history/history-timeline.png. Most recent first within each date. Amount/unit aligned to the right inset; whole row is the edit target. No repeated pencil icons, chevrons, edit buttons or inline editors.

- All/Water/recent-tracker shortcuts plus a searchable multi-select picker for every supplement and medication. Include archived trackers with entries in history filters.
- Independent date filter: 7/30/90-day shortcuts and explicit from/to dates. Hydration/calendar interaction selects a date/range without losing tracker selection.
- Pagination/range queries must support arbitrary older entries; the current 30-day generic-history default is not sufficient for 90-day or custom ranges.
- Loading, failed fetch, true empty history, and filter-empty states are distinct. A no-record day means unlogged, not confirmed no intake.
- Tap a row opens the shared Tamagui edit sheet: tracker, amount, compatible unit, date, time, note; Save and Cancel.
- Save commits atomically. Cancel/dismiss makes no changes. Reassigning between storage kinds must not perform an unsafe delete-then-insert sequence.
- Delete exists in entry details, with explicit confirmation and exact Undo. Preserve the full restore snapshot.
- Return to the same filter, range and scroll context after edits. If a record moves out of view, briefly explain why/where it moved.
- Update ordering, day grouping, totals, dots, chart series and score state after every mutation. Give rows useful accessible names.

## 8. Insights and Performance

### I1. Stable tracker views

Keep the accepted hierarchy: title and tappable Performance; tracker selector; lookback; three key numbers; configured-target context; two stacked charts. Water/Creatine/Fiber/Caffeine are shortcuts, not the complete tracker catalog. Add a picker for all user trackers, including medications.

7/30/90-day selections fetch/derive the requested calendar window and preserve each tracker's range. Cards and graphs change together. Render real series geometry, not bitmap charts or the fixed 7-day mock provider. Scrub/tap reveals date, amount, historical target/bounds, coverage and whether a point is recorded or modeled. Provide a text/data alternative.

| View | Three numbers | Two graphs |
| --- | --- | --- |
| Water | Daily logged average over days with recorded data; observed days within configured bounds with explicit denominator; share logged at/after 4 PM when actual timed samples exist | Daily volume with historical min/max; time-of-day distribution with sample coverage |
| Creatine | Planned quantity consistency; days since user-entered protocol start; verified planned-day streak | Rolling consistency with unknown gaps; dated routine/completion states |
| Fiber | Known-day average; mean nonnegative per-day shortfall; target days with coverage | Daily grams against historical target; rolling/weekly average with evaluated day count |
| Caffeine | Estimated known-dose amount now; estimated at configured bedtime; known logged amount today | Historical/current/projected amount with assumptions; daily recorded amounts against cap |
| Other supplement/medication | Logged quantity, intake occasions, planned-day progress with explicit denominators | Native-unit daily intake and logging/plan history; omit unsupported physiological interpretations |

If inputs are absent, show unavailable plus an appropriate configuration/logging action. Never fill placeholders with the accepted sample numbers.

Fiber scope is supplemental fiber unless explicit other-source intake is actually recorded; a full nutrition/total-diet feature is deferred. Water scope is recorded water in v0.1; do not imply complete fluid balance or silently apply legacy hydration factors to actual volume. Means and target-day counts use explicit observed denominators; days without records remain missing, not zero or confirmed complete. No daily completeness prompt is needed.

### I2. Research integration

Review pure functions from research/targets-performance.ts and research/creatine-caffeine.ts for reusable aggregation/coverage and caffeine calculations. The research target-completion score is superseded by the latest user correction; do not ship it as Performance. Adapt only applicable reviewed functions into the domain layer with runtime validation and checked-in tests. Keep fixture providers test-only. Source adapters must supply real configuration versions, source units, precise instants and coverage. A new reviewed specification is required for estimated creatine status and the combined feeling estimate.

- Estimated creatine status/saturation is part of the user's requested Performance concept. Define a sourced model, its supported population/protocol, initialization and prior-use inputs, handling of gaps, and limits before implementation. Protocol elapsed days, logged consistency and modeled stores are distinct. Never label modeled saturation as measured personal muscle concentration or invent a guaranteed strength/mood benefit.
- Research context: Hultman et al. studied muscle creatine accumulation under specific protocols in 31 men; those results do not establish a combined individual feeling score. Model development must distinguish population evidence from a personal estimate. [Muscle creatine loading in men](https://pubmed.ncbi.nlm.nih.gov/8828669/).
- Hydration studies assess physiological hydration and subjective outcomes; logged fluid intake is an input/proxy, not a direct measurement of body water. Define how activity, losses, unlogged fluids and missing context affect model availability. [Mild dehydration affects mood in healthy young women](https://doi.org/10.3945/jn.111.142000).
- Caffeine's subjective effects depend on context, including sleep pressure and habitual use; known-dose decay alone is not a validated predictor of a person's feeling. [Adenosine, caffeine, and sleep–wake regulation](https://pmc.ncbi.nlm.nih.gov/articles/PMC9541543/).
- Caffeine: sum known doses using doseMg × 2^(-elapsedHours / halfLifeHours), with previous-day carryover and explicit dose-time jumps. The default Performance forecast includes remaining scheduled caffeine doses, distinctly marked as planned. A no-further-intake curve can be an optional comparison; it must not silently replace the selected scheduled-dose scenario. Future actual records never enter past/current estimates.
- Default exploratory half-life is 4 hours with 2/8-hour sensitivity scenarios; the pictured 40/17 mg example uses an explicitly set 5-hour assumption. Do not change the production assumption simply to match the sample.
- Mark estimates approximate; expose assumptions in chart details; future series dashed. Unknown dose amounts/time/history reduce scope/availability and are never fabricated zeros. Estimates are known-dose equivalents, not measured blood levels or a sleep forecast.
- EFSA describes variable caffeine elimination, which supports labeling the assumption rather than presenting it as a measured personal value. [EFSA caffeine factsheet](https://www.efsa.europa.eu/sites/default/files/corporate_publications/files/efsaexplainscaffeine150527.pdf).
- Targets and cap values are user choices, not personalized intake guidance. [FDA caffeine context](https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much).
- Legacy wall-time entries without a trustworthy instant must not acquire invented exact timing. They can contribute to appropriate date-based totals; explain their exclusion from precise-time models.

### P1. Estimated Performance and history-driven baseline

Latest direct user definition: a number estimating physical energy and readiness right now based on available data, initially creatine saturation/status, caffeine state and hydration. Display a rolling 24-hour timeline centered on now: now − 12 hours through now + 12 hours. Fiber is excluded. This supersedes earlier interview answers selecting the mockup's water/fiber/creatine/caffeine target-completion formula. Keep the visual summary and breakdown hierarchy, but revise contributor labels, content and calculations to match the new purpose.

Outcome: physical energy/readiness at now. Display window: past 12 hours and future 12 hours, recentered as now advances. Forecasts assume remaining scheduled doses are taken. v0.1 uses intake data and optional onboarding context, without subjective feeling/energy check-ins. Presentation: a readiness label and tappable breakdown, with a baseline range or one 0–100 score according to recent data coverage.

Baseline state requirements:

- Onboarding asks whether the user has been using creatine, whether they consider their routine/stores established (including unsure/not using), and optionally the start date, usual dose and consistency. Treat answers as self-reported context; never create historical intake entries from them. New users still start in Building your baseline, even if they report established use.
- Baseline display is a modeled range within 0–100. Once sufficient recent history is available, show a single score. If the user takes a break and recent history becomes sparse/stale, return to a rebuilding-baseline range. Do not treat the transition as a measured loss of muscle stores or reset historical logs.
- Determine baseline status from relevant recent-history density and recency, not an install-age countdown, lifetime entry count or a saturated checkbox. A burst of taps on one day cannot substitute for enough observed days. App inactivity and actual intake absence are different; unlogged intervals remain unknown.
- Define versioned, contributor-specific lookback windows, observed-day/time coverage, gap limits and thresholds in the model specification. Longer-term creatine history and short-term caffeine/hydration history have different needs. Explicit Not using is different from missing information; disclose excluded/not-applicable contributors rather than leaving those users in baseline mode forever.
- Range endpoints must come from documented uncertainty/initialization scenarios for missing history; do not add an arbitrary ±10 around a guessed score or call the range a statistical confidence interval without validation. When no informative bounds can be supported, show Building your baseline with insufficient-data guidance; do not fabricate a narrow numerical range.
- Switching range → score → range is automatic, explainable and recomputed after time passes, logging, corrections, Undo and history import/migration. State why a baseline is rebuilding and which tracking inputs would improve coverage. No mandatory end-of-day confirmation is part of v0.1.
- The primary number describes now. The timeline displays past/current estimated states from actual logs and future planned scenarios. Past values are modeled, not self-reported feelings. Distinguish those semantics in accessible labels and chart details.

Past/current estimates use actual recorded intake, not retrospectively assumed scheduled consumption. Future projections explicitly separate planned-dose scenarios from actual logs; use applicable dated schedules and quantities, avoid double counting already completed doses, and never create actual intake entries from a forecast. For a partially completed scheduled dose, project its remaining planned quantity, labeled as a modeling assumption; actual logging still records the user's chosen dose. As-needed doses and catch-up doses at past scheduled times are not invented. v0.1 assumes no additional future water intake. Forecasting usual water patterns is a future premium candidate; no billing or paywall is in scope. The internal lookback supports caffeine carryover and longer-term creatine modeling despite the 24-hour display window.

Required implementation deliverable before coding the model: docs/PERFORMANCE-MODEL.md, reviewed by the lead and a separate domain/QA reviewer. The implementing agent owns this research and formula design; the user does not need another interview or to choose numerical weights. Product requirements above are settled. The handoff does not contain a validated individual readiness equation, so do not copy the older target-completion function and relabel it.

The specification must:

- Define every component's inputs, units, time dynamics, assumptions, population evidence, initialization and missing-data handling. Separate measured/logged inputs from modeled body states and predicted subjective outcomes.
- Creatine is a longer-term history-dependent component; its requested status model requires review beyond an elapsed-day count or today's dose percentage. Caffeine includes dose/time carryover and disclosed elimination assumptions. Hydration must account for the limits of intake-only observations.
- Exclude fiber from Performance while retaining its tracker and Insights. Do not add arbitrary supplements or medications to the score without a separately defined, reviewed model.
- Distinguish an exploratory product model from an empirically validated prediction. Ship as an estimate with unobtrusive assumptions/coverage in the breakdown. Define an explicit mapping into the 0–100 scale and readiness labels, cite evidence versus product-policy choices, and document limitations. Missing inputs must widen the supported baseline range or make the estimate unavailable rather than become fabricated zeros.
- Define how time and successful add/edit/delete/Undo update the estimate, and preserve the historical input/configuration/model version used for past results. Do not reinterpret prior estimates under silently changed assumptions.
- Test numerical correctness, sensitivity, carryover, partial history, baseline transition thresholds, inactivity/return, missing data, unsupported inputs and model-version behavior. Include reviewer-checked scenarios rather than tests that merely reproduce implementation constants. Passing calculation tests does not demonstrate that the number predicts how users feel; document later empirical evaluation separately. Subjective check-ins and predictive-validation datasets are deferred, so do not claim predictive accuracy in v0.1.

The old 84.880952381 target-completion fixture is not an acceptance test for the new Performance model. Mandatory end-of-day confirmations and editable equal contributor weights are not approved requirements for this concept.

Use a saved IANA timezone and civil day, not “subtract 24 hours.” v0.1 uses midnight boundary (0) with explicit historical grouping; custom boundary-hour editing is deferred. Timezone changes start a new dated configuration and do not regroup prior history. Test DST and repeated hours.

## 9. Settings — deliberate index and focused editors

Replace the dense mixed inline-edit page with clear grouped rows and dedicated Tamagui editors/subscreens. Preserve existing account/profile data and configured goals; editing one section cannot overwrite unrelated values.

| Group | Rows and behavior |
| --- | --- |
| Tracking | Targets & Performance inputs; Units; Water presets |
| Preferences | Reminders; Feedback & motion |
| Account | Profile and sign-out; current signed-in state and useful failure handling |
| Scope | No configurable drink-type, appearance-theme or import/export controls in v0.1; preserve existing data |

Targets editor: water scope/minimum/explicit optional maximum, supported fiber/Creatine tracking targets, caffeine cap (including zero), planned days and effective date. Use progressive disclosure for necessary model inputs such as bedtime and caffeine assumptions defined in the Performance specification. Tracking targets and the feeling estimate have distinct roles; do not imply that equal-weight goal completion implements the new score. No default health recommendations.

Water units convert display, goals and presets without relabeling unchanged numbers. Presets can be added, edited, removed and reordered; choose the two prominent sheet presets. Configurable drink types are deferred; do not add their prototype controls to this beta.

Feedback editor: independent sound and haptics; System/Full/Reduced motion with concise behavior explanation and a preview. Full deliberately overrides the OS reduce-motion preference; System follows live OS changes; Reduced keeps the static wave and instant confirmation. Persist settings through reload/sign-out as device preferences.

Reminders: implement specific-time supplement/medication reminders and preserve existing native Creatine behavior through the shared scheduling service. Native uses scheduled notifications; browser shows upcoming and overdue doses, without closed-browser notifications. Tapping a reminder opens the intake sheet with the tracker and scheduled dose selected; confirmation and successful persistence record consumption. Suppress reminders for doses completed by today's accumulation; remind only for remaining doses. Reconcile after add/edit/delete/Undo, timezone and plan changes. If Undo restores an outstanding dose after its time has passed, show it overdue rather than firing a surprise catch-up notification. Hydration interval/window reminders are deferred. Permission state, denial and platform/device-settings actions are honest. Validate installed-device delivery, including a terminated app. Edits, disabling, archiving and sign-out reconcile/cancel pending notifications, without duplicate scheduling on mount.

Reconcile cloud changes on refresh/foreground and realtime events where supported. Device-scheduled notifications require a documented cross-device/background consistency policy; do not claim immediate cancellation on a closed/offline phone merely because a dose was logged in the browser. Test the supported behavior and disclose any release limitation in the runbook.

Appearance: deliver coherent dark mode, without an appearance editor in this beta. Preserve any persisted legacy theme preference without deleting it.

Profile: retain name and existing optional metrics; do not make body measurements prerequisites for simple tracking. Validate, save only edited fields, show pending/error states, preserve Cancel behavior. Sign-out clears user-owned cached state and exits the account reliably.

CSV import/export, bulk clear-history and account deletion are deferred. Do not activate the bundle's disabled prototype controls as though implemented. Existing individual-entry delete remains supported in History.

## 10. Motion and feedback

Reuse components/pitwall/WaterScene.tsx, WaterMotion.ts, FeedbackProvider and lib/interaction-feedback.ts. Tamagui owns accessible layout and controls; Skia owns water/mask and purposeful visual effects.

- Successful water logging: smooth damped level/counter settling, brief localized ripple, faint reflection, short +amount receipt and exact Undo.
- Successful supplement/medication logging: restrained press state and brief plus-to-check confirmation.
- Quiet action-specific SFX and native haptics after persistence. Respect independent preferences, browser audio activation and platform support.
- Slow idle water only; no idle sound/haptic, confetti, distracting loops or repeated success animations.
- First-launch handwritten animations and special goal-completion flourishes are deferred. Keep the essential water wave and success feedback; do not add the deferred moments from draft artboards.
- Pause canvas/worklet/timer and sound work when backgrounded or document hidden. Resume using current state without replaying stale receipts.
- Deterministic animation clocks/seeds support screenshot comparison; test the real CanvasKit scene separately from mocked component tests.

## 11. Data contracts and migration requirements

These are required domain contracts, not permission to replace existing tables wholesale. The implementation agent designs additive SQL/SQLite columns/tables, versioned adapters and transactions to satisfy them.

| Contract | Required information/invariant |
| --- | --- |
| Tracker | Stable owner/id, category, explicit metric kind (not guessed from name), name, unit dimension, saved dose, optional conversion, optional target/limit, schedule/frequency, primary preference, reversible archived state |
| Entry | Stable owner/id and storage kind, tracker reference, snapshot name/category/unit, original amount/unit, normalized amount where compatible, actual consumption instant plus original local/day context when available, optional note, created/updated version, operation id, deletion/restore information |
| Target/plan policy | Immutable version/id/owner/effective day, timezone/midnight boundary, scopes, typed targets/caps, weekdays, optional dose amounts/times |
| Model/coverage | Versioned Performance specification/configuration, as-of instant, applicable input history, self-reported initialization context, contributor coverage/recency, baseline state, range or score and availability; no subjective check-in table needed for v0.1 |
| User/device settings | Cloud account/profile/tracking settings through existing infrastructure; independent device feedback/motion preferences remain device-scoped |
| Mutation receipt | Operation, exact storage kind/id, saved snapshot/version and dependent invalidations; safe idempotent add/edit/delete/restore |

- Keep water and built-in Creatine connected to legacy intake_log. Other trackers retain their data path. Build a unified domain repository for views/mutations; a rewrite into a new generic table requires a separate reviewed migration and is not the default.
- Supabase RLS and owner-linked FKs cover every new table and RPC. A second test account cannot read/edit/delete/reference another account's records.
- Cross-kind entry reassignment uses atomic server operations and SQLite transactions. Never delete first and hope insertion succeeds. Use conflict/version checks for concurrent edit/Undo. Linked drink/caffeine flows are deferred.
- Legacy consumed_at is timezone-free local wall time. Preserve it. New consumed_at_utc is an explicit instant. Never reinterpret all legacy rows as UTC or rerun the incident-specific repair.
- Preserve existing IDs, names/unit snapshots, settings, goals, history, native identifiers, Expo project linkage and account access.
- New-user default Creatine 5 g may preserve the current product preset, but existing profiles/doses are untouched; all other saved doses, frequency and targets require configuration.
- Save original units and sufficient precision; reject incompatible/nonfinite amounts, malformed dates, invalid target bounds, orphan references, negative/invalid frequency and invalid model configuration.
- Queries support all requested ranges; invalidate/rebuild derived results after any edit, archive, configuration change or unit preference change.
- Migration tests include reruns and realistic legacy fixtures. Missing new remote schema yields an actionable error, not empty data, fake success or a fallback write to production.
- Keep secrets out of repository/artifacts. Public Expo variables never contain service-role credentials.

## 12. Closed-loop verification

The user reviews product decisions through native browser annotations. The agent runs repeatable automated checks, captures failures, fixes the cause and reruns the affected gate. Do not hand routine regression work back to the user.

### Environments

| Environment | Launch | Rules |
| --- | --- | --- |
| Local SQLite | npm run dev:local → 8082 | Disposable seeded browser profile; never uploads to cloud |
| Separate Supabase test | npm run dev:test → 8083 | Requires separately provisioned project and .env.test.local; reject production URL; isolated accounts/fixtures |
| Production-connected review | npm run dev → 8081 | No automated fixture writes/mutations/deletions; read-only diagnostics only |

The test project must be provisioned and credentials supplied through the approved project setup. If unavailable, continue local UI/domain/migration work and mark the cloud gate blocked; do not substitute production or claim integration complete.

### Test architecture

- Retain existing npm run verify and migration/RLS tests.
- Add a checked-in Playwright browser suite for the actual exported app/local mode and an opt-in isolated-cloud suite. Serve COOP/COEP headers and real CanvasKit/fonts/SQLite. Test actual rendering/focus/storage, not a second mocked UI.
- Use accessible selectors/stable test IDs; deterministic clock, timezone, seeded fixtures and motion controls. Broad pixel thresholds cannot hide layout failures.
- Real audio/haptic service tests can spy on delivery calls; browser visual tests inspect the real wave/counter. Native hardware delivery remains a device check.
- Backend suite: authenticated login, create/edit/restore, refresh persistence, account isolation and concurrent/idempotent operations. Clean up only named disposable test fixture IDs.
- On failure, retain screenshot, trace, browser/console errors, environment identity, seed, route and failing assertion. Exclude tokens, production health records and private account screenshots from committed artifacts.
- CI: baseline verification + web export + local browser tests; native JS exports on shared changes; isolated-cloud gate when credentials are available. A skipped gate is reported explicitly.
- Suggested new commands: test:e2e, test:e2e:cloud and test:visual. These are to be implemented; they do not exist yet.

### Focused acceptance matrix

| ID | Scenario | Observable pass criterion |
| --- | --- | --- |
| A01 | Add 8/16 oz via + sheet, then custom mL | Exactly one row per action; correct conversions/totals/history; persisted after reload |
| A02 | Saved/custom supplement and medication dose | Correct tracker/unit/time/note; no guessed doses; details and lists agree |
| A03 | Slow/failed save and double click | Pending state and idempotent receipt; no confirmed total/dot/check/SFX on failure |
| A04 | Exact Undo amid newer entries | Only receipt's entry reverses; other entries/totals remain correct |
| A05 | Equal/unequal-dose and as-needed plans | Partial amounts accumulate in schedule order; correct dots for 5 g × 4 and 5 g + 10 g examples; Undo/edit/day rollover/archive work; as-needed has no required dots |
| A06 | Entry amount/unit/time/tracker edit; cancel; delete/restore | Atomic change or no change, exact restoration, correct grouping and filter/scroll retention |
| A07 | Custom and archived tracker filtering; older than 30 days | Search/multi-select and 90/custom ranges expose the correct persistent entries |
| A08 | Unit/goal/preset edits | Amounts convert rather than relabel; unrelated profile values preserved; historic policy unchanged |
| A09 | Real ranges and Performance | Range changes data; missing vs zero retained; new reviewed model fixtures, historical versions, coverage and estimate labeling correct; fiber excluded from score |
| A10 | Creatine/fiber/caffeine contracts | Reviewed estimated-creatine model with initialization/coverage; correct fiber denominators/scope; caffeine prior-day/future/unknown behavior and disclosed assumptions |
| A11 | Wave and text | Same geometry at partial/full/zero states; real fonts; readable units; no independently drifting mask |
| A12 | Motion/feedback lifecycle | Reduced static wave; Full overrides OS setting; independent mute settings; no work/sound while hidden |
| A13 | Responsive/accessibility/sheets | All four viewport checks; no clipped essential UI; keyboard/screen reader/focus/safe-area passes |
| A14 | Settings/account/reminders | Core scope only; persistence and sign-out clearing; native notification permission/delivery; completed-dose suppression; reminder tap prefill without automatic logging; browser upcoming/overdue states |
| A15 | Local/test isolation and schema migration | Production guard holds; seeded migration rerun preserves legacy; RLS blocks cross-account operations |
| A16 | End-to-end cloud persistence | Dedicated test accounts verify authenticated save/edit/delete/restore/reload and account isolation |
| A17 | Baseline lifecycle | New user stays baseline despite self-reported established use; range → single score with dense recent data; returns to range after gaps; exact threshold, missing-data and Undo tests |
| A18 | Centered forecast | Now − 12h to now + 12h; precise now marker; historical actual inputs; remaining future schedule scenarios; no duplicate/auto-created intake; no assumed future water |
| A19 | Same-day plan edits | Add/edit/remove unequal amount/time rows; today recalculates immediately; past days and actual entries unchanged; notifications/forecast agree |
| A20 | Authentication and release recovery | Sign-up/sign-in/session restore/sign-out plus actionable auth failures; supported recovery path; release settings/redirects verified in isolated environment |
| A21 | Optional social sharing | Explicit preview/confirmation; only selected score/range/label/time; no medication names, raw history, IDs or tokens; cancellation and unsupported-platform fallback work |

Useful numerical fixtures: water daily 64/80/96/128/72/104/112 oz yields about 94 oz mean and 4/7 within chosen 80–120 range; fiber 21/24/30/22/28/30/27 g yields 26 g mean, 4 g mean shortfall, 2/7 target days; explicit caffeine 120 mg at 08:30 with 5-hour assumption yields ~40 mg at 16:30 and ~17 mg at 22:30. These are fictional test settings. Test missing data separately; never use absence as zero.

## 13. Implementation sequence

1. **Audit and contracts:** establish a reviewed working-tree baseline; inspect design and current code; map routes/data paths; define typed tracker/entry/plan/model/coverage contracts and receipt semantics. Write/review PERFORMANCE-MODEL.md while other work proceeds. Keep the app runnable.
2. **Data and tests:** additive cloud/SQLite migrations, transactional mutations, compatible units, schedules/archive, owner isolation and deterministic domain tests. Prepare the separate test project without production fixtures.
3. **Shell and logging:** full-width navigation, shared Tamagui + flow, Home control relocation, profile/details/progress and working saved/custom logging with receipts/Undo.
4. **History:** unified range-backed timeline, filters/calendar, atomic edit/delete/restore and context retention.
5. **Settings:** coherent core index/editors, targets/versions/units/presets, feedback and scheduled reminder organization; retain profile/account behavior. Leave drink types, appearance themes and import/export for later.
6. **Insights:** real aggregates/ranges/charts and reviewed Performance model; baseline ranges, centered planned forecast and actual current score; remove the superseded target-completion score. Add the limited opt-in sharing flow from section 16.
7. **Polish and verify:** real Skia geometry/motion, all states/accessibility/responsive checks; focused tests → full verification → web and native exports → live exported browser pass. Do not add deferred expressive moments.
8. **Ship readiness:** create installable release builds and a deployable web artifact; complete device/cloud/auth gates; produce evidence, migration/rollback and release runbook. Publishing is a separate action; missing device/environment gates mean not ship-ready.

Use a subagent team with GPT-6.1 Sol (gpt-6.1-sol), Medium reasoning (medium), per the user's latest instruction. This supersedes the earlier Luna preference. The lead owns domain contracts, shared entry/schema files and integration. Assign non-overlapping lanes for data, Tamagui screens and QA/analytics only after contracts are fixed. Do not spawn separate sidebar chats for internal subtasks. Report any unavailable requested model/effort rather than silently substituting it.

## 14. Definition of done and explicit deferrals

Implementation done requires:

- All scoped screens and actions use real saved user data; all requested annotations are traceable to working behavior.
- No Home quick-action group; usable global add sheet; new full-width navigation; intentional Settings; arbitrary supplement and medication profiles.
- Exact mutation/Undo behavior and faithful historical/unit/timezone data preserved in both adapters.
- Real range-driven Insights and the aligned estimated Performance concept; reviewed model/coverage contracts, explicit estimation and assumptions, no mock production provider or unsupported claims of measured body states/predictive validation.
- Focused acceptance matrix, existing verification suite and web export pass. Native JS exports pass after shared changes.
- Local browser suite runs in CI; cloud gate passes against the separate test project or implementation is explicitly incomplete for cloud release.
- Relevant docs/environment examples updated and changes reviewable. PRD criteria become checkboxes in the completion report with evidence, not unsupported “done” statements.
- Native checks completed individually: iOS scaffold/CocoaPods on macOS, installed iOS/Android release builds, physical Skia/worklet performance, sheets/keyboard/safe areas, audio/haptics, notification permissions/delivery and accessibility. Bundle export does not satisfy these checks. If hardware/signing/macOS is unavailable, record the concrete unmet gates; never label the app ship-ready on bundle evidence alone.
- Re-run dependency audit and address remaining release-relevant advisories; do not force downgrades to silence the historical 21-advisory report.

Deferred: offline cloud queue/sync; medication refills/interactions/dose advice; inferred health targets; arbitrary supplement/medication physiological scores; diagnosis; bulk clear; custom day-boundary settings; configurable drink types; light/appearance themes; import/export; feeling check-ins; habitual-water forecasting/premium billing; launch/goal flourishes; social feeds/friends/challenges. Basic auth recovery and distribution-required account/data controls belong to ship readiness; a broad account redesign is not required. Production deployment and store submission are separate operations from preparing release-ready artifacts. The estimated Performance model is required implementation work, not a deferred stub.

Review feedback continues through the Codex app browser's native annotations. BugHerd setup is retired; its five imported notes are preserved in [feedback](C:/Users/ridha/Work/Apps/creatine/expo-app/docs/DROPS-V0.1-FEEDBACK.md). Do not reinstall BugHerd or build another annotation system.

## 15. Historical verification record

The previous baseline reported TypeScript, eight Jest suites/47 tests, six launcher tests, PGlite migration/RLS checks, web export and native JS exports passing at earlier checkpoints. Native devices and isolated-cloud integration were not verified. This PRD authoring pass inspected files/designs and preserved the baseline; it did not rerun or certify the implementation gates above.

Previous baseline: docs/archive/ROAD-TO-DROPS-V0.1-BASELINE-2026-10-04.md.

## 16. Social path without expanding the core app

The final instruction asks for social availability and to keep the doors open without specifying friends, feeds or challenges. Handoff interpretation: v0.1 offers a small, optional shareable Performance snapshot from its breakdown; future social features remain extensible. Do not add a fifth destination or a social feed.

- User explicitly chooses Share, sees the exact preview, then invokes the native/web share surface or a copy/download fallback. Nothing is automatically posted or sent to contacts. Opening a share surface alone is not delivery.
- The preview contains only the selected score or baseline range, readiness label, as-of time, Drops branding and estimate label. Do not include medication/supplement names, dose schedules, raw health history, account IDs or tokens. Sharing a rebuilding-baseline range preserves its baseline label.
- Derive a minimal share DTO from the view model through a dedicated adapter. Account identity, optional future public identity and private tracking records stay distinct. Preserve owner RLS; future social access uses separate opt-in, scoped records, never relaxed access to intake tables.
- No invitation system, contact import, public user lookup, leaderboard, telemetry upload, friend graph, messaging, paid water forecast or social server schema is required now. Do not show dead feature buttons.
- The share flow is the only inferred feature added to make the social direction concrete. Keep it small, reversible and testable; capture this interpretation in the implementation completion report.

## 17. Ship-ready delivery gates

Deliver code, tests and usable release artifacts. Publishing is not a substitute for verification and a passing export is not an installed app.

| Gate | Required evidence |
| --- | --- |
| Browser production integration | Export served with correct CanvasKit/SQLite asset paths and COOP/COEP headers where needed; reload/deep-link/session behavior; cloud persistence against the separate test project; supported desktop/mobile browsers |
| Backend release preparation | Additive migration list and rerun/preservation tests; owner isolation; configuration validation; backup/rollback and deployment instructions; production read-only health/schema/auth configuration checks |
| Account lifecycle | Existing open sign-up/sign-in/session restoration/sign-out works; recovery and redirect/deep-link paths are usable; account/data controls required by the intended distribution are implemented after checking official platform requirements |
| Android | Installable release build on a physical device; app cold start/reload, Skia/fonts, SQLite/cloud, keyboard/safe areas, sound/haptics, accessibility and notifications with app active/backgrounded/terminated |
| iOS | SDK-aligned scaffold and pods on macOS; installable release build on a physical device; the same functional/hardware checks as Android; preserved identifiers/EAS linkage |
| Performance | Reviewed model specification; sourced assumptions and declared product-policy choices; baseline transition and forecast scenario tests; no claim of clinically/empirically validated feeling prediction |
| Release package | Non-secret environment examples, automated CI gates, installation/hosting instructions, build provenance, dependency review, known-issue list and completion report with evidence per acceptance ID |

Write docs/DROPS-V0.1-IMPLEMENTATION-REPORT.md and docs/DROPS-V0.1-RELEASE.md. Record exact commands, dates, environments, build artifacts and device/OS versions. Distinguish passed, failed and unrun gates. Continue every independent implementation task when an external prerequisite is missing, and list the minimal prerequisite needed to finish; never hide missing cloud/device/model gates behind a Done label.
