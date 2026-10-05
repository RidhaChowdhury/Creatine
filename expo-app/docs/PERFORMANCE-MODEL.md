# Performance model review — intake-context-v1

Review date: 2026-10-04. Domain/QA assessment: **combined readiness model gate unmet**. This document precedes calculation implementation and requires lead review.

## Evidence and boundary

Recorded water is not hydration status: food, other beverages, losses, activity and physiology are unknown. The [National Academies water review](https://www.nationalacademies.org/read/10925/chapter/6) reports maintained hydration over a broad range of intake. No defensible mapping from recorded water/target completion to physical readiness was found.

[Hultman 1996](https://pubmed.ncbi.nlm.nih.gov/8828669/) studied muscle creatine loading in men: 3 g/day for 28 days and 20 g/day for six days are reference protocols. Intake cannot identify individual muscle stores, form, response or immediate energy. Profiles currently do not establish monohydrate form; any protocol comparison must explicitly say it assumes monohydrate. [ACSM review](https://pubmed.ncbi.nlm.nih.gov/10731017/) notes nonresponse. No saturation percentage or readiness effect is justified.

[Caffeine bioavailability study](https://pubmed.ncbi.nlm.nih.gov/6832208/) and [linear kinetics study](https://pubmed.ncbi.nlm.nih.gov/7333346/) support exploratory known-dose first-order elimination; observed individual half-lives vary. This is an amount-equivalent calculation, not blood concentration or perceived energy. No dose-to-readiness mapping was found. Fiber and arbitrary medication effects are excluded.

Reviewed bundled research/creatine-caffeine.ts: useful separation of protocol context and known-dose kinetics. It explicitly leaves saturation/performance percentages null. Reviewed targets-performance.ts: the composite target-completion approach is superseded and rejected.

## Implemented behavior and inputs

PerformanceResult always has state insufficient, score null, range null and label “Readiness unavailable”. A universal 0–100 range, narrower baseline range or numerical score would imply unsupported bounds. Dense history does not solve identifiability. Surface useful contextual contributors and a caffeine timeline under an explicit insufficient-data explanation.

Water: logged mL today using compatible volume conversion, no hydration decay or physiological claim. Missing days remain missing. Caffeine: only explicit-instant entries with mass-compatible mg or explicit tracker gramsPerUnit conversion, all retained history, future actual records excluded. For each sample, include only doses at/before that sample and at/before now. Sum doseMg × 2^(-elapsedHours / configuredHalfLifeHours); configured default stays unchanged, invalid half-life yields unavailable component. Immediate absorption and constant clearance are disclosed. Legacy wall-time entries contribute daily totals but not precise kinetics. Unlogged carryover is unknown; zero known contributions does not establish caffeine-free status.

Creatine: logged grams on completed civil days and consecutive reference-pattern days only, capped at reference duration for display. Unknown days interrupt verification; a missed day never resets inferred stores because stores are not inferred. Prior-use unknown remains unknown; “established” is self-report only, with no fabricated numerical baseline. Start date/usual dose/consistency are context; pre-app use is never silently assumed absent. No extrapolated saturation/washout interpolation.

Coverage: expose observed day count / calendar-day count over 30 days, latest actual record and elapsed recency. Product-policy density context is ≥21 observed days in 30 and latest record ≤48 hours; it does **not** authorize readiness. No completeness prompt or missing=zero inference.

## Forecast and reproducibility

Timeline has 49 half-hour samples from now −12h through now +12h, explicit now sample. Forecast only outstanding scheduled caffeine dose quantities, allocated chronologically from accumulated daily quantity using applicable historical plan. Today excludes past due times; next day respects its plan version/weekdays. Archived/as-needed trackers create no forecast doses. DST nonexistent or repeated-hour wall times skip forecast with a reason rather than choosing an instant. No additional future water, no catch-up or actual records. Future samples flag planned scenarios; no forecasts alter storage.

All outputs identify modelVersion intake-context-v1 and asOf explicit UTC instant. Reproduction requires snapshot of entries, profile/conversion, versioned plans, timezone, half-life and prior-use preferences. Later edits recompute outputs; no claim of immutable historical physiological truth.

## Reviewer numerical cases and checks

100 mg at t=0, half-life 5h: 100 mg at t=0, 50 mg at +5h, 25 mg at +10h. 100 mg at t=0 plus 50 mg at +5h produces 100 mg at +5h; earlier samples exclude the second dose. A 2000 mg quantity converts to 2 g. A 5 g/10 g schedule and 7 g logged yields allocations 5/2 g and remaining 0/8 g. Missing days are null; no plan/as-needed yields zero dose obligations. DST 23/25-hour civil days must use calendar helpers, not fixed 24-hour day arithmetic. A known 100 mg legacy wall-time entry remains visible in daily intake but is excluded from kinetic amount. Empty, sparse, dense and established-prior-use snapshots all retain null readiness score/range.

Lead review pending. Calculation unit tests establish arithmetic, not predictive validity. Release report must identify unmet intake-only readiness model gate and unavailable native/device validation separately.

Lead review approved 2026-10-04: insufficient readiness accepted; contributor-specific coverage policies: water 7d/latest <=24h; caffeine precise-known-dose 72h/latest <=24h (not completeness); creatine 30d/21 observed/latest <=48h. Explicit prior-use none vs unknown retained; established cannot bypass model gate.
