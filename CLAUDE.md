# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page React app that compares two 30-year financial paths side by side: buying a rental
property in Dubai ("Dubai Property") vs. investing the same capital in the stock market
("Alternate Investment"). The comparison is a "same starting cash, then diverging" model —
tailored to the user's own citizenship/tax-residence, community, asset class, and payment
structure (ready vs. off-plan, with per-developer milestone schedules).

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
and deploys `dist/` to GitHub Pages.

## Architecture

Everything lives in `src/`, flat (no subdirectories). `App.jsx` is the only stateful component —
it owns all input state in one `inputs` object, derives everything else via `useMemo`, and renders
both the control panel and the charts. `PrintReport.jsx` is a separate print-only view of the same
data, rendered off-screen and triggered via `window.print()`.

The rest of `src/` is plain, side-effect-free calculation and data modules, each independently
tested. `App.jsx` composes them; it contains no financial logic itself:

- **`simulation.js`** — the core month-by-month engine (`runSimulation`). Runs 360 months, growing
  home value/rent/costs, tracking mortgage amortization (Ready) or developer milestone payments
  (Off-Plan), and building the parallel reinvested-alternative portfolio. Emits one data point per
  year with a breakdown (cost-basis equity, appreciation gain, landlord surplus, cash/uncommitted).
  Also computes the off-plan "flip before handover" exit as a true timing-aware IRR (via `irr.js`),
  not a lump-sum CAGR.
- **`taxEngine.js`** — resolves a citizenship + tax-residence pair to a `TAX_PROFILE`
  (US/UK/Canada/India/FREE) and default marginal/capital-gains rates. US citizenship always wins
  regardless of residence. Rental income is taxed at the user's own marginal rate
  (`computeRentalIncomeTaxPct`); capital gains use either the user's own rate or, for a genuine
  Personal Primary Residence, the profile's statutory relief (US $250K exemption, UK/Canada 0%).
- **`paymentPlans.js`** — per-developer (Emaar/Damac/Danube) off-plan milestone schedules,
  `HANDOVER_MONTH`, and helpers to compute what's due/cumulative-paid at any given month.
- **`communities.js`**, **`serviceCharges.js`**, **`rentalYield.js`**, **`pricePerSqft.js`** —
  static Dubai market-data lookup tables (by community × asset class), each sourced from a market
  guide and documented inline with the reasoning behind the figures. These seed `App.jsx`'s
  cascading defaults (e.g. changing Community re-derives service charge rate, rental yield, and
  implied property price) but stay freely overridable afterward.
- **`irr.js`** — generic monthly-cashflow IRR solver, used only for the flip exit.
- **`currency.js`**, **`format.js`** — display currency list/pegs and formatting.
- **`shareState.js`** — serializes `inputs` into a shareable URL and reads it back on load.
- **`userDefaults.js`** — persists a user's own input snapshot (localStorage) as their personal
  defaults, distinct from the app's built-in `DEFAULT_INPUTS`.
- **`csvExport.js`** — exports the year-by-year `data` array to CSV.

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
- **A flip is a one-time event at `HANDOVER_MONTH`** computed from a closed-form appreciation
  formula (not relying on the loop's iterative `homeValue`), after which the position becomes a
  generic reinvested stock portfolio with no further real-estate attribution.
- Money renders in AED internally; `currency.js`/`format.js` only affect display.

## Testing

Every calculation module has a co-located `*.test.js` file using vitest. There's no DOM/component
testing setup — tests exercise the pure functions directly. When changing simulation or tax logic,
check whether the change should be reflected in the descriptive comments above the affected
function (this codebase leans heavily on inline comments to record *why* a given assumption or
default was chosen, e.g. tax rates, appreciation defaults, milestone schedules) — keep them in
sync rather than letting them go stale.
