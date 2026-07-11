# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page React app that compares two 30-year financial paths side by side: buying a rental
property in Dubai ("Dubai Property") vs. investing the same capital in the stock market
("Alternate Investment"). The comparison is a "same starting cash, then diverging" model —
tailored to the user's own citizenship/tax-residence, community, asset class, and payment
structure (ready vs. off-plan, with per-developer milestone schedules).

It also has a second, deliberately low-profile capability: every explicit user action (Share,
Export CSV, Download PDF, Save Defaults) can log the current scenario + visitor context to a
private Google Sheet, with a hidden, passphrase-gated view to browse and reload any of them. See
"Private scenario-logging feature" below before touching `scenarioLog.js`, `geoDefaults.js`, or
`AdminScenarios.jsx`.

## Commands

```bash
npm install     # see note below — package-lock.json is gitignored
npm run dev     # start Vite dev server
npm run build   # production build to dist/ (base path: /DubaiInvestmentAnalyzer/, for GitHub Pages)
npm run preview # preview the production build
npm test        # run the full vitest suite once
```

Run a single test file: `npx vitest run src/simulation.test.js`
Run in watch mode: `npx vitest`

`package-lock.json` is gitignored (see `.gitignore`) because it was generated against an internal
corporate npm registry mirror whose resolved tarball URLs aren't reachable elsewhere — don't
un-gitignore it or rely on it being committed.

CI (`.github/workflows/deploy.yml`) runs `npm test` then `npm run build` on every push to `main`
and deploys `dist/` to GitHub Pages. The build injects `VITE_SCENARIO_LOG_URL` from a repository
secret of the same name; locally, copy `.env.example` to `.env` to set it (unset = scenario logging
is a complete no-op, no network calls at all — see below).

`google-apps-script/` is a **private git submodule** (a separate repo, `dubai-analyzer-backend`) —
a fresh clone won't have its contents until you run `git submodule update --init`, and even then
only if you have access to that private repo. Nothing in the Vite build touches this directory; it
exists purely as a reference copy of the Apps Script deployed by hand into Google's own
infrastructure (see its README for the manual deploy steps — this is not automatable, it requires
a Google account and interactive OAuth consent).

## Architecture

Everything lives in `src/`, flat (no subdirectories). `App.jsx` is the only stateful component —
it owns all input state in one `inputs` object, derives everything else via `useMemo`, and renders
both the control panel and the charts. `PrintReport.jsx` is a separate print-only view of the same
data, rendered off-screen and triggered via `window.print()`.

The rest of `src/` is plain, side-effect-free calculation and data modules, each independently
tested. `App.jsx` composes them; it contains no financial logic itself:

- **`simulation.js`** — the core month-by-month engine (`runSimulation`). Runs 360 months, growing
  home value/rent/costs (home value compounds monthly, at the twelfth root of the annual rate — a
  smooth line, not a once-a-year step), tracking mortgage amortization (Ready) or developer
  milestone payments (Off-Plan), and building the parallel reinvested-alternative portfolio. Emits
  one data point per year (`data`) with a breakdown (cost-basis equity, appreciation gain,
  landlord surplus, cash/uncommitted, plus `renterContributed`/`renterGrowth`/`buyerCapitalInvested`
  for the ROI%/breakdown charts). Also returns `buyerIRR`/`renterIRR` (a true 30-year annualized
  return for both sides) and, for a Flip, `flipMonth`/`flipMonthlyData`/`flipCAGR` — see "Flip" below.
- **`taxEngine.js`** — resolves a citizenship + tax-residence pair to a `TAX_PROFILE`
  (US/UK/Canada/India/FREE) and default marginal/capital-gains rates. US citizenship always wins
  regardless of residence. Rental income is taxed at the user's own marginal rate
  (`computeRentalIncomeTaxPct`); capital gains use either the user's own rate or, for a genuine
  Personal Primary Residence, the profile's statutory relief (US $250K exemption, UK/Canada 0%).
- **`paymentPlans.js`** — 6 off-plan milestone schedules (Emaar, Damac, Balanced 50/50, Aggressive
  40/60, Danube 20%-booking, Danube Classic 10%-booking), `HANDOVER_MONTH` (fixed at 36 for all of
  them — when physical possession transfers), and helpers to compute what's due/cumulative-paid at
  any given month. A plan's own final installment month can run well past `HANDOVER_MONTH` (up to
  96) — that's what drives a Flip's `flipMonth`, see below.
- **`communities.js`**, **`serviceCharges.js`**, **`rentalYield.js`**, **`pricePerSqft.js`** —
  static Dubai market-data lookup tables (by community × asset class), each sourced from a market
  guide and documented inline with the reasoning behind the figures. These seed `App.jsx`'s
  cascading defaults (e.g. changing Community re-derives service charge rate, rental yield, and
  implied property price) but stay freely overridable afterward.
- **`irr.js`** — generic monthly-cashflow IRR solver (`computeAnnualizedIRR`), used for both the
  flip exit and the 30-year `buyerIRR`/`renterIRR`. Evaluated via Horner's rule, not the textbook
  `sum(cf[i] / (1+r)**i)` — at the bisection's extreme low bound, `(1+r)**360` underflows to exactly
  0 for a series that long, and two cash flows dividing by that same 0 produce
  `Infinity - Infinity = NaN`, silently corrupting every comparison after it. Don't "simplify" this
  back to the textbook formula; there's a regression test for exactly this in `irr.test.js`.
- **`currency.js`**, **`format.js`** — display currency list/pegs and formatting.
- **`shareState.js`** — serializes `inputs` into a shareable URL and reads it back on load.
- **`userDefaults.js`** — persists a user's own input snapshot (localStorage) as their personal
  defaults, distinct from the app's built-in `DEFAULT_INPUTS`.
- **`csvExport.js`** — exports the year-by-year `data` array to CSV.
- **`scenarioLog.js`**, **`geoDefaults.js`**, **`AdminScenarios.jsx`** — the private scenario-
  logging feature; see its own section below.

### Key modeling conventions (read before changing simulation.js or taxEngine.js)

- **Off-plan vs. Ready are structurally different paths** through the same simulation loop: Ready
  uses a mortgage (external financing, interest/principal split); Off-Plan has no mortgage — the
  buyer's uncommitted capital sits in `buyerPool`, compounding at the net stock return, and is
  drawn down as developer milestones come due.
- **`buyerPool`/cash-portion is deliberately excluded from `buyerNetWorth`** — it's idle,
  not-yet-deployed capital, not realized property value. Only `costBasisEquity`,
  `appreciationGainNet`, and `landlordSurplus` count toward net worth.
- **`landlordSurplus` is the reinvested, tax-adjusted rental profit** (rent net of vacancy, minus
  mortgage/installment and carrying costs), separate from `buyerPool`. It's zero during off-plan
  construction (nothing rentable yet) and for a flipped contract (never occupied).
- **The Alternate Investment side only mirrors capital that would have built home equity** (down
  payment/booking fee up front, then each month's mortgage payment or developer installment) — rent
  plays no role in that comparison; Dubai Property's rental economics are tracked separately via
  `landlordSurplus`.
- **A Flip is Hold, truncated at the chosen plan's own payoff month (`flipMonth`), not always at
  `HANDOVER_MONTH`.** Months 1 through `flipMonth` run through the exact same branches Hold uses
  (no special-casing at all — rent starts accruing the moment `HANDOVER_MONTH` passes, same as
  Hold), then the sale at `flipMonth` is valued with the same Hold-exit formula (home value minus
  remaining balance, exit tax, selling costs, plus accumulated rental surplus) — no separate
  closed-form appreciation formula. This means a Flip can now receive the Personal Primary
  Residence exemption if toggled on, exactly like Hold; it's no longer flatly denied. After
  `flipMonth`, the position becomes a generic reinvested stock portfolio with no further real-
  estate attribution. `flipMonthlyData` mirrors `data` but at monthly granularity, only for a Flip
  (`data` itself is always annual, 30 points, regardless of exit strategy).
- **`buyerCapitalInvested` freezes at its pre-flip value once flipped** — unlike
  `buyerCostBasisEquity` (which resets to 0 post-flip, since the breakdown chart treats the payout
  as pure cash from that point on), ROI%'s denominator must keep remembering how much was ever put
  in, so it's tracked as its own running total, not derived from `costBasisEquity`.
- Money renders in AED internally; `currency.js`/`format.js` only affect display.

## Private scenario-logging feature

`scenarioLog.js` / `geoDefaults.js` / `AdminScenarios.jsx`, backed by the private
`google-apps-script/` submodule (a Google Sheet + Apps Script Web App — no other backend exists
anywhere in this project).

- **Logging fires only on explicit actions** (Share, Export CSV, Download PDF, Save Defaults) —
  deliberately *not* on page load/mount. `App.jsx`'s mount effect still resolves
  `collectVisitorContext()` once (cached in state) so those four action handlers don't each re-run
  the geolocation lookup, and so the currency/tax-profile auto-detect below has something to read.
- **`isLikelyBot()` gates both the `ipapi.co` geolocation call and every `logScenario` call** —
  checks `navigator.webdriver` (set by every headless automation framework by default) plus common
  bot/crawler/non-browser user-agent substrings. Not real security (trivially spoofed), just noise
  reduction — it's what stops routine testing (Playwright itself trips this) from polluting the
  Sheet or burning the free `ipapi.co` quota. Don't remove this without expecting test-tool traffic
  to start showing up as real rows again.
- **`trigger`** (`'open'` used to be logged too, but no longer is; `'share'`, `'export_csv'`,
  `'download_pdf'`, `'save_defaults'`) **is folded into the scenario object itself** before POSTing
  (`{ ...inputs, logTrigger: trigger }`), not a separate field in the request body — the Sheet has
  a single `ScenarioJSON` blob column, so this needed no backend/schema change.
- **The same geolocation lookup also drives a one-time currency + Global Tax Profile auto-detect**
  (`getGeoDefaults`, keyed by `country_code`, mapped only for the 5 explicitly modeled
  countries/currencies — anything else is left alone). Only applies on a genuinely fresh visit —
  skipped entirely if a shared-URL scenario or saved personal defaults are already in play, and it
  naturally no-ops for detected bots too, since they never resolve a `country_code` in the first place.
- **The admin view** (`?admin=1`, checked as component state in `App.jsx`, not a module-level
  constant — it has to be able to switch back to the normal calculator after loading a scenario)
  swaps out the entire calculator for `AdminScenarios.jsx`. Reads are gated by a passphrase checked
  **inside the Apps Script itself** (a Script Property, never in this repo); the Web App URL
  (`VITE_SCENARIO_LOG_URL`) is not treated as secret — it only allows anonymous writes.
- Nothing here throws into the calculator's own render path — every failure mode (unset URL,
  network error, CORS, a bad passphrase) is caught and swallowed or turned into a plain user-facing
  message in `AdminScenarios.jsx`. Keep it that way; a logging hiccup must never break the app.

## Testing

Every calculation module has a co-located `*.test.js` file using vitest. There's no DOM/component
testing setup, but a couple of modules (`scenarioLog.js`, `geoDefaults.js`) touch browser globals
(`navigator`, `window`, `fetch`) that don't exist in vitest's default Node environment — those
tests use `vi.stubGlobal`/`vi.stubEnv` (see `scenarioLog.test.js`) rather than pulling in jsdom;
follow that pattern for any new browser-dependent logic instead of adding a DOM testing dependency.
When changing simulation or tax logic, check whether the change should be reflected in the
descriptive comments above the affected function (this codebase leans heavily on inline comments
to record *why* a given assumption or default was chosen, e.g. tax rates, appreciation defaults,
milestone schedules) — keep them in sync rather than letting them go stale.
