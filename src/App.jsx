import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Check, Download, Info, Printer, RotateCcw, Save, Share2 } from 'lucide-react'
import {
  ASSET_CLASS_APPRECIATION_DEFAULTS,
  ASSET_CLASS_POSTHANDOVER_APPRECIATION_DEFAULTS,
  ASSET_CLASS_SIZE_DEFAULTS,
  AIRPORT_BONUS_PCT,
  METRO_BONUS_PCT,
  getEffectivePreHandoverAppreciation,
  getEffectivePostHandoverAppreciation,
  runSimulation,
} from './simulation.js'
import {
  CITIZENSHIP_OPTIONS,
  RESIDENCE_OPTIONS,
  DEFAULT_TAX_RATES,
  resolveTaxProfile,
  computeRentalIncomeTaxPct,
} from './taxEngine.js'
import { PAYMENT_PLANS, amountDueInMonth, buildMilestoneSchedule } from './paymentPlans.js'
import { COMMUNITIES } from './communities.js'
import { computeAnnualServiceCharges, getServiceChargeRate } from './serviceCharges.js'
import { DUBAI_AVERAGE_YIELD_PCT, computeGrossYieldPct, computeNetYieldPct, getRentalYield } from './rentalYield.js'
import { getPricePerSqft } from './pricePerSqft.js'
import { CURRENCIES } from './currency.js'
import { formatCurrency } from './format.js'
import { buildShareUrl, getStateFromUrl } from './shareState.js'
import { loadUserDefaults, saveUserDefaults } from './userDefaults.js'
import { buildCsv, downloadCsv } from './csvExport.js'
import { collectVisitorContext, logScenario } from './scenarioLog.js'
import { getGeoDefaults } from './geoDefaults.js'
import AdminScenarios from './AdminScenarios.jsx'
import PrintReport from './PrintReport.jsx'

function Slider({ label, value, onChange, min, max, step, format, accent = '#f59e0b', description }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <span className="text-sm font-semibold text-white tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ '--track-color': accent, '--track-fill': `${pct}%` }}
      />
      {description && <p className="mt-1.5 text-xs text-slate-500">{description}</p>}
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-300">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
          checked ? 'bg-amber-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/20">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function InfoTooltip({ text }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 cursor-help text-slate-500 hover:text-slate-300" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-60 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-normal leading-relaxed text-slate-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

function StatCard({ label, value, accentClass, tooltip }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <p className="flex items-center gap-1 text-xs text-slate-400">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </p>
      <p className={`text-lg font-bold tabular-nums ${accentClass}`}>{value}</p>
    </div>
  )
}

function PillToggle({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
            value === opt.value ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, description }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
      />
      {description && <p className="mt-1.5 text-xs text-slate-500">{description}</p>}
    </div>
  )
}

function Dropdown({ label, value, onChange, options, description }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {description && <p className="mt-1.5 text-xs text-slate-500">{description}</p>}
    </div>
  )
}

const tooltipFormatter = (fmt) => (value, name) => [fmt(value, false), name]

const DEFAULT_COMMUNITY = 'MARINA'
const DEFAULT_ASSET_CLASS = 'CONDO'
const DEFAULT_SIZE_SQFT = ASSET_CLASS_SIZE_DEFAULTS[DEFAULT_ASSET_CLASS]
const DEFAULT_RENTAL_YIELD = getRentalYield(DEFAULT_COMMUNITY, DEFAULT_ASSET_CLASS) ?? DUBAI_AVERAGE_YIELD_PCT
const DEFAULT_PRICE_PER_SQFT = getPricePerSqft(DEFAULT_COMMUNITY, DEFAULT_ASSET_CLASS)
const DEFAULT_PROPERTY_PRICE = DEFAULT_PRICE_PER_SQFT ? DEFAULT_SIZE_SQFT * DEFAULT_PRICE_PER_SQFT : 1500000

const DEFAULT_INPUTS = {
  propertyName: '',
  propertyType: '',
  propertyPrice: DEFAULT_PROPERTY_PRICE,
  monthlyRent: Math.round((DEFAULT_PROPERTY_PRICE * (DEFAULT_RENTAL_YIELD / 100)) / 12),
  rentInflation: 5,
  vacancyRatePct: 5,
  rentalYield: DEFAULT_RENTAL_YIELD,
  assetClass: DEFAULT_ASSET_CLASS,
  nearMetro: false,
  nearAirport: false,
  preHandoverAppreciation: ASSET_CLASS_APPRECIATION_DEFAULTS[DEFAULT_ASSET_CLASS],
  postHandoverAppreciation: ASSET_CLASS_POSTHANDOVER_APPRECIATION_DEFAULTS[DEFAULT_ASSET_CLASS],
  propertyStatus: 'READY',
  developerPlan: 'EMAAR',
  exitStrategy: 'HOLD',
  downPaymentPct: 25,
  mortgageRate: 4.5,
  mortgageTermYears: 25,
  community: DEFAULT_COMMUNITY,
  propertySizeSqft: DEFAULT_SIZE_SQFT,
  serviceChargeRate: getServiceChargeRate(DEFAULT_COMMUNITY),
  homeInsuranceAnnual: 1500,
  yearlyMaintenance: 5000,
  costInflation: 3,
  sellingCostPct: 2,
  dldFeePct: 4,
  dldWaiverPct: 0,
  stockReturn: 7,
  citizenship: 'USA',
  taxResidence: 'USA',
  isPrimaryResidence: false,
  ...DEFAULT_TAX_RATES.US,
}

const CITIZENSHIP_LABELS = { USA: 'USA', UK: 'UK', Canada: 'Canada', India: 'India', 'UAE/Other': 'UAE / Other' }
const RESIDENCE_LABELS = { UAE: 'UAE', USA: 'USA', UK: 'UK', Canada: 'Canada', India: 'India', Other: 'Other' }

// Read once at module load — a shared link's inputs seed the initial state below.
const sharedState = getStateFromUrl()

export default function App() {
  const [inputs, setInputs] = useState(() => ({ ...DEFAULT_INPUTS, ...sharedState?.inputs }))
  const [displayCurrency, setDisplayCurrency] = useState('AED')
  const [copied, setCopied] = useState(false)
  const [savedDefaults, setSavedDefaults] = useState(false)
  // Hidden, never linked from the normal UI — ?admin=1 swaps the whole
  // calculator for the passphrase-gated scenario browser (see
  // AdminScenarios.jsx). State, not a module-level constant, so loading a
  // scenario from that view can switch back to the normal calculator.
  const [isAdminView, setIsAdminView] = useState(() => new URLSearchParams(window.location.search).has('admin'))

  const setField = (key) => (value) => setInputs((prev) => ({ ...prev, [key]: value }))

  const handleAssetClassChange = (assetClass) =>
    setInputs((prev) => {
      const newSize = ASSET_CLASS_SIZE_DEFAULTS[assetClass]
      const yieldPct = getRentalYield(prev.community, assetClass)
      const pricePerSqft = getPricePerSqft(prev.community, assetClass)
      return {
        ...prev,
        assetClass,
        preHandoverAppreciation: ASSET_CLASS_APPRECIATION_DEFAULTS[assetClass],
        postHandoverAppreciation: ASSET_CLASS_POSTHANDOVER_APPRECIATION_DEFAULTS[assetClass],
        propertySizeSqft: newSize,
        ...(yieldPct != null ? { rentalYield: yieldPct } : {}),
        ...(pricePerSqft != null ? { propertyPrice: newSize * pricePerSqft } : {}),
      }
    })

  const handleCommunityChange = (community) =>
    setInputs((prev) => {
      const rate = getServiceChargeRate(community)
      const yieldPct = getRentalYield(community, prev.assetClass)
      const pricePerSqft = getPricePerSqft(community, prev.assetClass)
      return {
        ...prev,
        community,
        ...(rate != null ? { serviceChargeRate: rate } : {}),
        ...(yieldPct != null ? { rentalYield: yieldPct } : {}),
        ...(pricePerSqft != null ? { propertyPrice: prev.propertySizeSqft * pricePerSqft } : {}),
      }
    })

  // Citizenship/Tax Residence together resolve to a tax profile (see
  // resolveTaxProfile) — whichever one changes, re-resolve with the OTHER
  // field's current value and snap the marginal/capital-gains rate inputs
  // to that profile's default top-bracket figures (DEFAULT_TAX_RATES),
  // same cascading-default pattern as Community/Asset Class above. Still
  // freely adjustable afterward.
  const applyTaxProfileDefaults = (prev, citizenship, taxResidence) => ({
    ...prev,
    citizenship,
    taxResidence,
    ...DEFAULT_TAX_RATES[resolveTaxProfile(citizenship, taxResidence).key],
  })

  const handleCitizenshipChange = (citizenship) =>
    setInputs((prev) => applyTaxProfileDefaults(prev, citizenship, prev.taxResidence))

  const handleTaxResidenceChange = (taxResidence) =>
    setInputs((prev) => applyTaxProfileDefaults(prev, prev.citizenship, taxResidence))

  // Fires once on mount only (not on every input edit) — logs whatever
  // scenario is active at that moment ("where it was opened"), then, only
  // on a genuinely fresh visit (no shared link, no saved defaults already
  // in play — those are more specific signals than a generic location
  // guess), pre-fills currency and Global Tax Profile from the same
  // geolocation lookup, reusing the exact cascade the manual Citizenship/
  // Tax Residence dropdowns already trigger.
  useEffect(() => {
    if (isAdminView) return
    collectVisitorContext().then((visitor) => {
      logScenario(inputs, visitor)
      if (!sharedState?.inputs && !loadUserDefaults()) {
        const geo = getGeoDefaults(visitor.country_code)
        if (geo) {
          setDisplayCurrency(geo.currency)
          setInputs((prev) => applyTaxProfileDefaults(prev, geo.citizenship, geo.taxResidence))
        }
      }
    })
    // Deliberately empty — see comment above; must run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    data,
    flipMonthlyData,
    flipMonth,
    mortgagePayment,
    downPayment,
    breakEvenYear,
    flipCAGR,
    buyerIRR,
    renterIRR,
  } = useMemo(() => runSimulation(inputs), [inputs])
  const effectivePreHandoverAppreciation = getEffectivePreHandoverAppreciation(inputs)
  const effectivePostHandoverAppreciation = getEffectivePostHandoverAppreciation(inputs)
  const taxProfile = resolveTaxProfile(inputs.citizenship, inputs.taxResidence)
  const rentalIncomeTaxPct = computeRentalIncomeTaxPct(inputs, taxProfile)
  const isOffPlan = inputs.propertyStatus === 'OFFPLAN'
  const isFlip = isOffPlan && inputs.exitStrategy === 'FLIP'
  // Display-only label for the Flip IRR stat — the flip point now tracks
  // the chosen plan's own final installment (flipMonth), not always month
  // 36, so this can come out fractional (e.g. 6.7-yr for Danube).
  const flipYearsLabel = flipMonth != null ? (flipMonth % 12 === 0 ? flipMonth / 12 : (flipMonth / 12).toFixed(1)) : null

  // Off-plan has no mortgage, but it does have a real recurring monthly
  // obligation — the regular construction-period installment (excludes the
  // plan-specific booking fee and any handover-time lump/post-handover
  // spread). Danube's continues well past handover; shown here as a
  // representative "during construction" figure. Recomputed here purely
  // for display — simulation.js builds its own copy of this schedule
  // internally.
  const offPlanMonthlyInstallment = useMemo(() => {
    if (!isOffPlan) return null
    const schedule = buildMilestoneSchedule(inputs.developerPlan, inputs.propertyPrice)
    return amountDueInMonth(schedule, 1)
  }, [isOffPlan, inputs.developerPlan, inputs.propertyPrice])

  // A flipped contract's story is over once its plan is fully paid off (see
  // simulation.js's flipMonth) — the buyer no longer tracks home equity or
  // rent past that point, so whatever years remain are just generic
  // compounding, not property-specific. Show the flip's own monthly-
  // granularity data instead of the yearly series — its whole story fits
  // inside flipMonth months, too coarse to see month-by-month at yearly
  // resolution — instead of implying 30 years of real estate insight that
  // isn't there.
  const chartData = isFlip ? flipMonthlyData : data
  const finalYear = chartData[chartData.length - 1]
  const displayBreakEven = isFlip
    ? chartData.find((d) => d.buyerNetWorth > d.renterNetWorth)?.month ?? null
    : breakEvenYear

  // ROI% = return relative to capital actually invested so far, not the
  // full net worth — needs its own "capital invested" baseline at every
  // point, unlike Net Worth above. buyerCapitalInvested/renterContributed
  // (see simulation.js) already track that, uncompounded, per row.
  const roiPct = (netWorth, capitalInvested) =>
    capitalInvested > 0 ? ((netWorth - capitalInvested) / capitalInvested) * 100 : null
  const roiChartData = useMemo(
    () =>
      chartData.map((d) => ({
        ...d,
        buyerROIPct: roiPct(d.buyerNetWorth, d.buyerCapitalInvested),
        renterROIPct: roiPct(d.renterNetWorth, d.renterContributed),
      })),
    [chartData],
  )
  const finalROI = roiChartData[roiChartData.length - 1]
  // Money Multiple (MOIC) — "how many times your invested capital" — a
  // simple complement to ROI%, read from the same final row.
  const buyerMoic = finalYear && finalYear.buyerCapitalInvested > 0 ? finalYear.buyerNetWorth / finalYear.buyerCapitalInvested : null
  const renterMoic = finalYear && finalYear.renterContributed > 0 ? finalYear.renterNetWorth / finalYear.renterContributed : null

  // Landlord yield metrics, Ready only — off-plan's rent timing (construction,
  // then a variable handover point per plan) makes a single "Year 1" figure
  // misleading there. Both read straight from inputs/Year 1, not a whole
  // simulated trajectory — a quick "as of today" sanity check, same spirit
  // as the Monthly Rent slider's existing "implied gross yield" note.
  const annualCarryingCosts =
    computeAnnualServiceCharges(inputs.propertySizeSqft, inputs.serviceChargeRate) +
    inputs.homeInsuranceAnnual +
    inputs.yearlyMaintenance
  const netRentalYieldPct = !isOffPlan
    ? computeNetYieldPct(inputs.monthlyRent * 12, annualCarryingCosts, inputs.propertyPrice)
    : null
  const cashOnCashPct = !isOffPlan && downPayment > 0 ? (data[0].buyerLandlordSurplus / downPayment) * 100 : null

  const fmt = (value, compact = true) => formatCurrency(value, displayCurrency, compact)

  const buyerWinsAt30 = finalYear && finalYear.buyerNetWorth > finalYear.renterNetWorth

  const handleDownloadPdf = () => {
    window.dispatchEvent(new Event('resize'))
    window.print()
  }

  const handleExportCsv = () => downloadCsv('dubai-investment-analyzer-scenario.csv', buildCsv(data))

  const handleShare = async () => {
    const url = buildShareUrl({ inputs })
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API may be unavailable; the URL bar itself is already updated.
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveDefaults = () => {
    saveUserDefaults(inputs)
    setSavedDefaults(true)
    setTimeout(() => setSavedDefaults(false), 2000)
  }

  const handleResetToDefaults = () => setInputs({ ...DEFAULT_INPUTS, ...loadUserDefaults() })

  if (isAdminView) {
    const handleLoadScenario = (scenario) => {
      setInputs({ ...DEFAULT_INPUTS, ...scenario })
      setIsAdminView(false)
      const url = new URL(window.location.href)
      url.searchParams.delete('admin')
      window.history.replaceState(null, '', url)
    }
    return <AdminScenarios onLoad={handleLoadScenario} />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="no-print mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Dubai Real Estate{' '}
              <span className="bg-gradient-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
                Opportunity Cost
              </span>{' '}
              Calculator
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Buy in Dubai's zero-tax market vs. invest the same capital — a 30-year net worth
              comparison built around your actual citizenship and tax residence, not a one-size-
              fits-all assumption.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 focus:border-amber-400 focus:outline-none"
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-400 hover:text-white"
            >
              <Printer className="h-4 w-4" /> Download PDF Report
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-400 hover:text-white"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-400 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" /> Share Scenario
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSaveDefaults}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-400 hover:text-white"
            >
              {savedDefaults ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" /> Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save as My Defaults
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-400 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" /> Reset to Defaults
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* Inputs */}
          <div className="space-y-5">
            <SectionCard title="The Property">
              <TextInput
                label="Property Name"
                value={inputs.propertyName}
                onChange={setField('propertyName')}
                placeholder="e.g. Marina Gate Tower 2, Unit 1408"
                description="A label for your own reference — purely informational, not used in any calculation."
              />
              <TextInput
                label="Property Type"
                value={inputs.propertyType}
                onChange={setField('propertyType')}
                placeholder="e.g. 2 Bed, 3 Bed + Maid's"
                description="Free text — also purely informational, not used in any calculation."
              />
              <Dropdown
                label="Community"
                value={inputs.community}
                onChange={handleCommunityChange}
                options={COMMUNITIES.map((c) => ({ value: c.key, label: c.label }))}
                description="Sets realistic defaults below (Property Price, Service Charge Rate, Rental Yield) from Dubai market guides. Still freely adjustable."
              />
              <Slider
                label="Property Size"
                value={inputs.propertySizeSqft}
                onChange={setField('propertySizeSqft')}
                min={300}
                max={15000}
                step={50}
                format={(v) => `${v.toLocaleString()} sq ft`}
              />
              <Slider
                label="Property Price"
                value={inputs.propertyPrice}
                onChange={setField('propertyPrice')}
                min={300000}
                max={20000000}
                step={10000}
                format={(v) => fmt(v)}
                description={(() => {
                  const communityRate = getPricePerSqft(inputs.community, inputs.assetClass)
                  const implied = Math.round(inputs.propertyPrice / inputs.propertySizeSqft)
                  return `Implied price: ${implied.toLocaleString()} AED/sq ft${communityRate != null ? ` — community typical: ${communityRate.toLocaleString()} AED/sq ft` : ''}`
                })()}
              />
              <Slider
                label="Monthly Rent (Collected)"
                value={inputs.monthlyRent}
                onChange={setField('monthlyRent')}
                min={1000}
                max={100000}
                step={250}
                format={(v) => fmt(v)}
                description={`Implied gross yield: ${computeGrossYieldPct(inputs.monthlyRent * 12, inputs.propertyPrice).toFixed(2)}% before vacancy — compare against the Rental Yield assumption below. Reduced by the Vacancy Rate when computing rental surplus.`}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Asset Class</label>
                <PillToggle
                  value={inputs.assetClass}
                  onChange={handleAssetClassChange}
                  options={[
                    { value: 'CONDO', label: 'Condo' },
                    { value: 'VILLA', label: 'Townhouse / Villa' },
                  ]}
                />
              </div>
              <Toggle
                label="Near Metro Blue Line Expansion"
                description={`Adds +${METRO_BONUS_PCT}pp to the effective appreciation rate (e.g. Dubai Creek Harbour).`}
                checked={inputs.nearMetro}
                onChange={setField('nearMetro')}
              />
              <Toggle
                label="Near Al Maktoum Airport Expansion"
                description={`Adds +${AIRPORT_BONUS_PCT}pp to the effective appreciation rate (e.g. Dubai South).`}
                checked={inputs.nearAirport}
                onChange={setField('nearAirport')}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Property Status</label>
                <PillToggle
                  value={inputs.propertyStatus}
                  onChange={setField('propertyStatus')}
                  options={[
                    { value: 'READY', label: 'Ready Property' },
                    { value: 'OFFPLAN', label: 'Off-Plan Property' },
                  ]}
                />
              </div>
              {inputs.propertyStatus === 'OFFPLAN' && (
                <>
                  <Dropdown
                    label="Developer Payment Plan"
                    value={inputs.developerPlan}
                    onChange={setField('developerPlan')}
                    options={Object.values(PAYMENT_PLANS).map((p) => ({ value: p.key, label: p.label }))}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Exit Strategy</label>
                    <PillToggle
                      value={inputs.exitStrategy}
                      onChange={setField('exitStrategy')}
                      options={[
                        { value: 'HOLD', label: 'Hold Long Term' },
                        { value: 'FLIP', label: 'Flip Before Handover' },
                      ]}
                    />
                  </div>
                </>
              )}
            </SectionCard>

            {inputs.propertyStatus === 'READY' && (
              <SectionCard title="Financing">
                <Slider
                  label="Down Payment"
                  value={inputs.downPaymentPct}
                  onChange={setField('downPaymentPct')}
                  min={0}
                  max={100}
                  step={1}
                  format={(v) => `${v}% (${fmt(downPayment)})`}
                />
                <Slider
                  label="Mortgage Rate"
                  value={inputs.mortgageRate}
                  onChange={setField('mortgageRate')}
                  min={0}
                  max={10}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}%`}
                />
                <Slider
                  label="Mortgage Term"
                  value={inputs.mortgageTermYears}
                  onChange={setField('mortgageTermYears')}
                  min={5}
                  max={25}
                  step={1}
                  format={(v) => `${v} yrs`}
                />
              </SectionCard>
            )}

            <SectionCard title="Homeownership Costs">
              <Slider
                label="Service Charge Rate"
                value={inputs.serviceChargeRate}
                onChange={setField('serviceChargeRate')}
                min={1}
                max={70}
                step={0.5}
                format={(v) => `${v.toFixed(1)} AED/sq ft/yr`}
                description={`= ${fmt(computeAnnualServiceCharges(inputs.propertySizeSqft, inputs.serviceChargeRate), false)}/year, paid by the owner, not the tenant.`}
              />
              <Slider
                label="Annual Home Insurance"
                value={inputs.homeInsuranceAnnual}
                onChange={setField('homeInsuranceAnnual')}
                min={0}
                max={10000}
                step={100}
                format={(v) => fmt(v)}
              />
              <Slider
                label="Yearly Maintenance"
                value={inputs.yearlyMaintenance}
                onChange={setField('yearlyMaintenance')}
                min={0}
                max={30000}
                step={500}
                format={(v) => fmt(v)}
              />
              <Slider
                label="Cost Inflation"
                value={inputs.costInflation}
                onChange={setField('costInflation')}
                min={0}
                max={10}
                step={0.1}
                format={(v) => `${v.toFixed(1)}%`}
                description="Annual growth of service charges, insurance, and maintenance."
              />
              <Slider
                label="Selling Costs (agency commission at exit)"
                value={inputs.sellingCostPct}
                onChange={setField('sellingCostPct')}
                min={0}
                max={8}
                step={0.1}
                format={(v) => `${v.toFixed(1)}%`}
              />
              <Slider
                label="DLD Transfer Fee"
                value={inputs.dldFeePct}
                onChange={setField('dldFeePct')}
                min={0}
                max={8}
                step={0.1}
                format={(v) => `${v.toFixed(1)}%`}
                description="Dubai Land Department fee, paid at booking (month 0) — Off-Plan registers it upfront via Oqood, same timing as Ready's purchase."
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">DLD Fee Waiver</label>
                <PillToggle
                  value={inputs.dldWaiverPct}
                  onChange={setField('dldWaiverPct')}
                  options={[
                    { value: 0, label: 'No Waiver' },
                    { value: 50, label: '50% Waiver' },
                    { value: 100, label: '100% Waiver' },
                  ]}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  A developer promotion covering part or all of the DLD fee above.
                  {inputs.dldWaiverPct > 0 &&
                    ` Effective fee: ${(inputs.dldFeePct * (1 - inputs.dldWaiverPct / 100)).toFixed(2)}%.`}
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Market Assumptions">
              {isOffPlan && (
                <Slider
                  label="Pre-Handover Appreciation"
                  value={inputs.preHandoverAppreciation}
                  onChange={setField('preHandoverAppreciation')}
                  min={0}
                  max={30}
                  step={0.5}
                  format={(v) => `${v.toFixed(1)}%`}
                  description={
                    inputs.nearMetro || inputs.nearAirport
                      ? `Effective rate with infrastructure bonuses: ${effectivePreHandoverAppreciation.toFixed(1)}%`
                      : 'While under construction — Condo default 11%, Villa default 20%, set by Asset Class above, then freely adjustable.'
                  }
                />
              )}
              <Slider
                label="Post-Handover Appreciation"
                value={inputs.postHandoverAppreciation}
                onChange={setField('postHandoverAppreciation')}
                min={0}
                max={10}
                step={0.5}
                format={(v) => `${v.toFixed(1)}%`}
                description={
                  inputs.nearMetro || inputs.nearAirport
                    ? `Effective rate with infrastructure bonuses: ${effectivePostHandoverAppreciation.toFixed(1)}%`
                    : isOffPlan
                      ? 'Once owned outright — a completed, secondary-market property, appreciation normalizes toward general market growth.'
                      : 'A Ready property is already handed over, so this is the only appreciation rate that applies.'
                }
              />
              <Slider
                label="Rental Yield"
                value={inputs.rentalYield}
                onChange={setField('rentalYield')}
                min={0}
                max={15}
                step={0.1}
                format={(v) => `${v.toFixed(1)}%`}
                description={
                  getRentalYield(inputs.community, inputs.assetClass) != null
                    ? `Set from Community + Asset Class above. Dubai average is ${DUBAI_AVERAGE_YIELD_PCT}%. Informational — compare against the Monthly Rent input's implied yield above.`
                    : `Dubai average is ${DUBAI_AVERAGE_YIELD_PCT}% — no yield data for this Community + Asset Class combination, so this stays freely set. Informational — compare against the Monthly Rent input's implied yield above.`
                }
              />
              <Slider
                label="Vacancy Rate"
                value={inputs.vacancyRatePct}
                onChange={setField('vacancyRatePct')}
                min={5}
                max={15}
                step={0.5}
                format={(v) => `${v.toFixed(1)}%`}
                description="Share of time the unit sits empty between tenants — reduces collected rent only; the mortgage/installment and carrying costs still accrue in full."
              />
              <Slider
                label="Rent Inflation"
                value={inputs.rentInflation}
                onChange={setField('rentInflation')}
                min={0}
                max={15}
                step={0.5}
                format={(v) => `${v.toFixed(1)}%`}
              />
              <Slider
                label="Expected Stock Market Return"
                value={inputs.stockReturn}
                onChange={setField('stockReturn')}
                min={0}
                max={15}
                step={0.1}
                format={(v) => `${v.toFixed(1)}%`}
                description="Gross, before your Global Tax Profile's stock-return drag below."
              />
            </SectionCard>

            <SectionCard title="Global Tax Profile">
              <Dropdown
                label="Citizenship"
                value={inputs.citizenship}
                onChange={handleCitizenshipChange}
                options={CITIZENSHIP_OPTIONS.map((c) => ({ value: c, label: CITIZENSHIP_LABELS[c] }))}
              />
              <Dropdown
                label="Tax Residence"
                value={inputs.taxResidence}
                onChange={handleTaxResidenceChange}
                options={RESIDENCE_OPTIONS.map((r) => ({ value: r, label: RESIDENCE_LABELS[r] }))}
                description="US citizenship carries US tax exposure regardless of residence."
              />
              {(taxProfile.key === 'US' || taxProfile.key === 'CANADA') && (
                <>
                  <Slider
                    label="Federal Marginal Tax Rate"
                    value={inputs.marginalTaxRateFed}
                    onChange={setField('marginalTaxRateFed')}
                    min={0}
                    max={50}
                    step={0.5}
                    format={(v) => `${v.toFixed(1)}%`}
                    description="Your own income-tax bracket, applied to net rental cash flow (rent minus mortgage/installment and carrying costs) when positive — not the stock-return drag rate above."
                  />
                  <Slider
                    label={taxProfile.key === 'US' ? 'State Marginal Tax Rate' : 'Provincial Marginal Tax Rate'}
                    value={inputs.marginalTaxRateState}
                    onChange={setField('marginalTaxRateState')}
                    min={0}
                    max={25}
                    step={0.5}
                    format={(v) => `${v.toFixed(1)}%`}
                    description={`Combined marginal rate on rental income: ${rentalIncomeTaxPct.toFixed(1)}% (Federal + ${taxProfile.key === 'US' ? 'State' : 'Provincial'}).`}
                  />
                </>
              )}
              {(taxProfile.key === 'UK' || taxProfile.key === 'INDIA') && (
                <Slider
                  label="Marginal Tax Rate"
                  value={inputs.marginalTaxRateSingle}
                  onChange={setField('marginalTaxRateSingle')}
                  min={0}
                  max={50}
                  step={0.5}
                  format={(v) => `${v.toFixed(1)}%`}
                  description={`Your own income-tax bracket, applied to net rental cash flow (rent minus mortgage/installment and carrying costs) when positive — not the stock-return drag rate above. Effective rate: ${rentalIncomeTaxPct.toFixed(1)}%.`}
                />
              )}
              {taxProfile.key === 'FREE' && (
                <p className="text-xs text-slate-500">
                  No rental income tax applies for this Global Tax Profile (UAE / Tax-Free).
                </p>
              )}
              {taxProfile.key !== 'FREE' && (
                <Slider
                  label="Capital Gains Tax Rate"
                  value={inputs.capitalGainsTaxRatePct}
                  onChange={setField('capitalGainsTaxRatePct')}
                  min={0}
                  max={50}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}%`}
                  description="Applied to the property's appreciation gain on any exit — Hold or Flip — that isn't a Personal Primary Residence. A genuine Personal Primary Residence (toggle below) instead uses statutory relief, not this rate, on either exit."
                />
              )}
              <Toggle
                label="Personal Primary Residence"
                description="I will live here, not rent it out — unlocks primary-residence tax relief (US $250K exemption, UK/Canada 0% CGT). Off by default, since the Dubai Property choice models a rental throughout; when off, a Hold exit is taxed at the same rate as a Flip."
                checked={inputs.isPrimaryResidence}
                onChange={setField('isPrimaryResidence')}
              />
            </SectionCard>
          </div>

          {/* Visualization */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/40 p-6 shadow-lg shadow-black/20">
              <p className="text-xs uppercase tracking-wider text-slate-400">Break-Even Point</p>
              <p className="text-2xl font-bold text-white">
                {displayBreakEven
                  ? isFlip
                    ? `Month ${displayBreakEven}`
                    : `Year ${displayBreakEven}`
                  : 'Alternate Investment Wins'}
              </p>
              <p className="mt-1 max-w-xl text-sm text-slate-400">
                {isFlip
                  ? displayBreakEven
                    ? `Dubai Property overtakes the Alternate Investment by the flip, in month ${displayBreakEven}.`
                    : `The Alternate Investment still beats Dubai Property at the flip (month ${flipMonth}).`
                  : displayBreakEven
                    ? `Dubai Property overtakes the Alternate Investment in year ${displayBreakEven}.`
                    : 'Over 30 years, the Alternate Investment beats Dubai Property in this scenario.'}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label={isOffPlan ? 'Installment / mo (Construction)' : 'Mortgage (P&I) / mo'}
                  value={
                    isOffPlan
                      ? fmt(offPlanMonthlyInstallment, false)
                      : mortgagePayment > 0
                        ? fmt(mortgagePayment, false)
                        : 'N/A'
                  }
                  accentClass="text-white"
                  tooltip={
                    isOffPlan
                      ? `Regular monthly developer milestone payment (excludes the ${PAYMENT_PLANS[inputs.developerPlan]?.bookingPct ?? ''}% booking fee and any handover-time lump/post-handover spread). ${PAYMENT_PLANS[inputs.developerPlan]?.label ?? ''} — Danube's continues well past handover, alongside rental income tracked separately as Invested Rental Surplus.`
                      : undefined
                  }
                />
                <StatCard
                  label={isFlip ? `Dubai Property Net Worth (at Flip, Mo ${flipMonth})` : 'Dubai Property Net Worth (Yr 30)'}
                  value={finalYear ? fmt(finalYear.buyerNetWorth, false) : '-'}
                  accentClass={buyerWinsAt30 ? 'text-amber-400' : 'text-slate-300'}
                  tooltip="Ready/Off-Plan-Hold: home value if sold this year, minus selling costs, any remaining balance, and exit tax (full investment-property rate by default, unless Personal Primary Residence is on below) — plus accumulated rental surplus (rent collected, net of vacancy, minus the mortgage/installment and carrying costs, reinvested). Off-Plan-Flip: the reinvested flip proceeds, right at the moment of the flip."
                />
                <StatCard
                  label={isFlip ? `Alternate Investment Net Worth (at Flip, Mo ${flipMonth})` : 'Alternate Investment Net Worth (Yr 30)'}
                  value={finalYear ? fmt(finalYear.renterNetWorth, false) : '-'}
                  accentClass={!buyerWinsAt30 ? 'text-rose-400' : 'text-slate-300'}
                  tooltip="Starting capital equal to Dubai Property's own month-0 cash outlay, plus every month's mortgage payment (or off-plan developer installment) that would have gone into building home equity — invested here instead, compounding at your Global Tax Profile's net stock return. Rent isn't part of this comparison; it's Dubai Property's own rental income (Invested Rental Surplus)."
                />
                {isFlip && (
                  <StatCard
                    label={`Flip IRR (${flipYearsLabel}-yr)`}
                    value={flipCAGR != null ? `${(flipCAGR * 100).toFixed(1)}%` : '-'}
                    accentClass="text-emerald-400"
                    tooltip="A true internal rate of return, not a simple lump-sum CAGR — it accounts for exactly when each booking fee, installment, and the DLD fee were paid, not just the total invested. Since it's on capital actually paid in (not the full price), it's a leveraged figure — part of the price was never at risk."
                  />
                )}
                {!isFlip && (
                  <>
                    <StatCard
                      label="Dubai Property Annualized Return (30-yr)"
                      value={buyerIRR != null ? `${(buyerIRR * 100).toFixed(1)}%` : '-'}
                      accentClass="text-emerald-400"
                      tooltip="A true internal rate of return over the full 30 years, not Net Worth alone — it accounts for exactly when each mortgage/installment payment and rental cash flow landed, ending with the property's Year-30 value if sold then."
                    />
                    <StatCard
                      label="Alternate Investment Annualized Return (30-yr)"
                      value={renterIRR != null ? `${(renterIRR * 100).toFixed(1)}%` : '-'}
                      accentClass="text-emerald-400"
                      tooltip="Same true-IRR treatment as the Dubai Property figure, over the same monthly contributions — for a lump-sum-only Ready purchase (100% down), this converges to your Global Tax Profile's net stock return exactly."
                    />
                  </>
                )}
                {!isOffPlan && (
                  <>
                    <StatCard
                      label="Net Rental Yield (Yr 1)"
                      value={netRentalYieldPct != null ? `${netRentalYieldPct.toFixed(2)}%` : '-'}
                      accentClass="text-white"
                      tooltip="Annual rent minus annual carrying costs (service charges, insurance, maintenance) — not vacancy or financing — divided by Property Price. A quick after-costs complement to the Monthly Rent slider's gross-yield note above; changes over time with Rent/Cost Inflation, shown here as of Year 1."
                    />
                    <StatCard
                      label="Cash-on-Cash Return (Yr 1)"
                      value={cashOnCashPct != null ? `${cashOnCashPct.toFixed(1)}%` : '-'}
                      accentClass="text-white"
                      tooltip="Year 1's after-tax rental profit (rent minus mortgage payment and carrying costs) divided by the Down Payment — the annual yield on the cash you actually put in, not the full price. Fluctuates with Rent/Cost Inflation in later years."
                    />
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
              <h3 className="mb-4 text-sm font-semibold text-slate-300">
                {isFlip ? `Net Worth Projection Through the Flip (Month ${flipMonth})` : '30-Year Net Worth Projection'}
              </h3>
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey={isFlip ? 'month' : 'year'}
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{
                        value: isFlip ? 'Months' : 'Years',
                        position: 'insideBottom',
                        offset: -3,
                        fill: '#64748b',
                      }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(v) => fmt(v)}
                      width={70}
                    />
                    <Tooltip
                      formatter={tooltipFormatter(fmt)}
                      labelFormatter={(value) => (isFlip ? `Month ${value}` : `Year ${value}`)}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '0.75rem',
                        color: '#e2e8f0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                    {displayBreakEven && (
                      <ReferenceLine
                        x={displayBreakEven}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{ value: 'Break-even', fill: '#f59e0b', fontSize: 11, position: 'top' }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="buyerNetWorth"
                      name="Dubai Property"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="renterNetWorth"
                      name="Alternate Investment"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {isFlip &&
                  `Chart and figures above stop at the flip (month ${flipMonth}) — past that point the Dubai Property path is just a generic reinvested portfolio, not a real estate projection. `}
                Tax calculations are simplified estimates based on standard 2026 tax rules — Hold
                exits default to investment-property rates unless marked a Personal Primary
                Residence (Global Tax Profile). Off-plan milestones, appreciation, and rental
                income are estimates; the mortgage model assumes one fixed rate for the full term
                and doesn't enforce real UAE loan-to-value limits. Figures are illustrative
                projections, not financial advice.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
              <h3 className="mb-1 text-sm font-semibold text-slate-300">Dubai Property Net Worth: Equity vs Appreciation</h3>
              <p className="mb-4 text-xs text-slate-500">
                Cost-Basis Equity is what you've actually paid in (mortgage paydown or developer
                milestones), at the original price. Appreciation Gain is the price-growth portion,
                net of exit tax and selling costs. Invested Rental Surplus is the landlord's
                accumulated rental profit — rent collected, net of vacancy, minus the mortgage (or
                off-plan installment) and carrying costs — reinvested and compounding; it's real,
                earned income, so it counts too. Together, these three are Dubai Property Net
                Worth — the Dubai Property line in the chart above.
                {isOffPlan &&
                  " Cash / Uncommitted (shown for reference) is capital not yet tied up in the property — the off-plan float before handover — and is deliberately excluded from Dubai Property Net Worth, since it's idle capital, not realized property value."}
                {isFlip &&
                  ' In the flip year itself, the payout is attributed back to Cost-Basis Equity and Appreciation Gain (where it actually came from) rather than shown as cash — only in years after the flip does it become an undifferentiated reinvested portfolio.'}
              </p>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey={isFlip ? 'month' : 'year'}
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{
                        value: isFlip ? 'Months' : 'Years',
                        position: 'insideBottom',
                        offset: -3,
                        fill: '#64748b',
                      }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(v) => fmt(v)}
                      width={70}
                    />
                    <Tooltip
                      formatter={tooltipFormatter(fmt)}
                      labelFormatter={(value) => (isFlip ? `Month ${value}` : `Year ${value}`)}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '0.75rem',
                        color: '#e2e8f0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar dataKey="buyerCostBasisEquity" name="Cost-Basis Equity" stackId="buyer" fill="#f59e0b" />
                    <Bar dataKey="buyerAppreciationGain" name="Appreciation Gain" stackId="buyer" fill="#22c55e" />
                    <Bar dataKey="buyerLandlordSurplus" name="Invested Rental Surplus" stackId="buyer" fill="#14b8a6" />
                    {isOffPlan && (
                      <Bar dataKey="buyerCashPortion" name="Cash / Uncommitted" stackId="buyer" fill="#94a3b8" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
              <h3 className="mb-1 text-sm font-semibold text-slate-300">
                Alternate Investment: Contributed Capital vs Growth
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Contributed Capital is cash actually put in so far — the starting capital plus
                every month's mortgage payment (or off-plan developer installment) that would have
                gone into building home equity, same figures as the Dubai Property chart above, just
                invested here instead. Investment Growth is everything above that from compounding.
                Together, these two are Alternate Investment Net Worth — the Alternate Investment
                line in the Net Worth chart above.
              </p>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey={isFlip ? 'month' : 'year'}
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{
                        value: isFlip ? 'Months' : 'Years',
                        position: 'insideBottom',
                        offset: -3,
                        fill: '#64748b',
                      }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(v) => fmt(v)}
                      width={70}
                    />
                    <Tooltip
                      formatter={tooltipFormatter(fmt)}
                      labelFormatter={(value) => (isFlip ? `Month ${value}` : `Year ${value}`)}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '0.75rem',
                        color: '#e2e8f0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar dataKey="renterContributed" name="Contributed Capital" stackId="renter" fill="#38bdf8" />
                    <Bar dataKey="renterGrowth" name="Investment Growth" stackId="renter" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300">Return on Investment Over Time</h3>
                  <p className="mt-1 max-w-xl text-xs text-slate-500">
                    Return relative to capital actually invested so far (Contributed Capital, or its
                    Dubai Property equivalent) — not Net Worth itself, which mixes leverage/timing
                    effects in. {isFlip ? `As of the flip (month ${flipMonth})` : 'As of Year 30'},
                    Dubai Property is {finalROI?.buyerROIPct != null ? `${finalROI.buyerROIPct.toFixed(0)}%` : '-'}{' '}
                    ({buyerMoic != null ? `${buyerMoic.toFixed(1)}x` : '-'}) vs. Alternate Investment's{' '}
                    {finalROI?.renterROIPct != null ? `${finalROI.renterROIPct.toFixed(0)}%` : '-'} (
                    {renterMoic != null ? `${renterMoic.toFixed(1)}x` : '-'}).
                  </p>
                </div>
              </div>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={roiChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey={isFlip ? 'month' : 'year'}
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{
                        value: isFlip ? 'Months' : 'Years',
                        position: 'insideBottom',
                        offset: -3,
                        fill: '#64748b',
                      }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
                      labelFormatter={(value) => (isFlip ? `Month ${value}` : `Year ${value}`)}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '0.75rem',
                        color: '#e2e8f0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Line
                      type="monotone"
                      dataKey="buyerROIPct"
                      name="Dubai Property"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="renterROIPct"
                      name="Alternate Investment"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        <footer className="mt-8 text-center text-xs text-slate-600">
          Anonymous usage data (scenario inputs and approximate location) is logged for the site
          owner's analytics.
        </footer>
      </div>

      <PrintReport
        inputs={inputs}
        data={chartData}
        mortgagePayment={mortgagePayment}
        downPayment={downPayment}
        breakEven={displayBreakEven}
        finalYear={finalYear}
        displayCurrency={displayCurrency}
        effectivePreHandoverAppreciation={effectivePreHandoverAppreciation}
        effectivePostHandoverAppreciation={effectivePostHandoverAppreciation}
        flipCAGR={flipCAGR}
        isFlip={isFlip}
        flipMonth={flipMonth}
        flipYearsLabel={flipYearsLabel}
        offPlanMonthlyInstallment={offPlanMonthlyInstallment}
        buyerIRR={buyerIRR}
        renterIRR={renterIRR}
        roiChartData={roiChartData}
        buyerMoic={buyerMoic}
        renterMoic={renterMoic}
        netRentalYieldPct={netRentalYieldPct}
        cashOnCashPct={cashOnCashPct}
      />
    </div>
  )
}
