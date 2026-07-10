import { useMemo, useState } from 'react'
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
  ASSET_CLASS_SIZE_DEFAULTS,
  AIRPORT_BONUS_PCT,
  METRO_BONUS_PCT,
  getEffectiveAppreciation,
  runSimulation,
} from './simulation.js'
import { CITIZENSHIP_OPTIONS, RESIDENCE_OPTIONS } from './taxEngine.js'
import { HANDOVER_MONTH, PAYMENT_PLANS, amountDueInMonth, buildMilestoneSchedule } from './paymentPlans.js'
import { COMMUNITIES } from './communities.js'
import { computeAnnualServiceCharges, getServiceChargeRate } from './serviceCharges.js'
import { DUBAI_AVERAGE_YIELD_PCT, computeGrossYieldPct, getRentalYield } from './rentalYield.js'
import { getPricePerSqft } from './pricePerSqft.js'
import { CURRENCIES } from './currency.js'
import { formatCurrency } from './format.js'
import { buildShareUrl, getStateFromUrl } from './shareState.js'
import { loadUserDefaults, saveUserDefaults } from './userDefaults.js'
import { buildCsv, downloadCsv } from './csvExport.js'
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
  propertyPrice: DEFAULT_PROPERTY_PRICE,
  monthlyRent: Math.round((DEFAULT_PROPERTY_PRICE * (DEFAULT_RENTAL_YIELD / 100)) / 12),
  rentInflation: 5,
  rentalYield: DEFAULT_RENTAL_YIELD,
  assetClass: DEFAULT_ASSET_CLASS,
  nearMetro: false,
  nearAirport: false,
  homeAppreciation: ASSET_CLASS_APPRECIATION_DEFAULTS[DEFAULT_ASSET_CLASS],
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
  citizenship: 'UAE/Other',
  taxResidence: 'UAE',
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

  const setField = (key) => (value) => setInputs((prev) => ({ ...prev, [key]: value }))

  const handleAssetClassChange = (assetClass) =>
    setInputs((prev) => {
      const newSize = ASSET_CLASS_SIZE_DEFAULTS[assetClass]
      const yieldPct = getRentalYield(prev.community, assetClass)
      const pricePerSqft = getPricePerSqft(prev.community, assetClass)
      return {
        ...prev,
        assetClass,
        homeAppreciation: ASSET_CLASS_APPRECIATION_DEFAULTS[assetClass],
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

  const { data, mortgagePayment, downPayment, breakEvenYear, flipCAGR } = useMemo(
    () => runSimulation(inputs),
    [inputs],
  )
  const effectiveAppreciation = getEffectiveAppreciation(inputs)
  const isOffPlan = inputs.propertyStatus === 'OFFPLAN'
  const isFlip = isOffPlan && inputs.exitStrategy === 'FLIP'
  const flipYear = HANDOVER_MONTH / 12

  // Off-plan has no mortgage, but it does have a real recurring monthly
  // obligation — the regular construction-period installment (excludes the
  // 20% booking fee and any handover-time lump sum). Danube's continues
  // through month 80; shown here as a representative "during construction"
  // figure. Recomputed here purely for display — simulation.js builds its
  // own copy of this schedule internally.
  const offPlanMonthlyInstallment = useMemo(() => {
    if (!isOffPlan) return null
    const schedule = buildMilestoneSchedule(inputs.developerPlan, inputs.propertyPrice)
    return amountDueInMonth(schedule, 1)
  }, [isOffPlan, inputs.developerPlan, inputs.propertyPrice])

  // A flipped contract's story is over at handover — the buyer no longer
  // tracks home equity or rent past that point (see simulation.js), so the
  // remaining ~27 years are just generic compounding, not property-specific.
  // Truncate everything shown to the user at the flip point instead of
  // implying 30 years of real estate insight that isn't there.
  const chartData = isFlip ? data.slice(0, flipYear) : data
  const finalYear = chartData[chartData.length - 1]
  const displayBreakEvenYear = isFlip
    ? chartData.find((d) => d.buyerNetWorth > d.renterNetWorth)?.year ?? null
    : breakEvenYear

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
                label="Monthly Rent (comparable)"
                value={inputs.monthlyRent}
                onChange={setField('monthlyRent')}
                min={1000}
                max={100000}
                step={250}
                format={(v) => fmt(v)}
                description={`Implied gross yield: ${computeGrossYieldPct(inputs.monthlyRent * 12, inputs.propertyPrice).toFixed(2)}% — compare against the Rental Yield assumption below.`}
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
              <Slider
                label="Base Home Appreciation"
                value={inputs.homeAppreciation}
                onChange={setField('homeAppreciation')}
                min={0}
                max={30}
                step={0.5}
                format={(v) => `${v.toFixed(1)}%`}
                description={
                  inputs.nearMetro || inputs.nearAirport
                    ? `Effective rate with infrastructure bonuses: ${effectiveAppreciation.toFixed(1)}%`
                    : 'Condo default 11%, Villa default 20% — set by Asset Class above, then freely adjustable.'
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
                    ? `Set from Community + Asset Class above. Dubai average is ${DUBAI_AVERAGE_YIELD_PCT}%. Used to offset Danube-style post-handover installments.`
                    : `Dubai average is ${DUBAI_AVERAGE_YIELD_PCT}% — no yield data for this Community + Asset Class combination, so this stays freely set. Used to offset Danube-style post-handover installments.`
                }
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
                onChange={setField('citizenship')}
                options={CITIZENSHIP_OPTIONS.map((c) => ({ value: c, label: CITIZENSHIP_LABELS[c] }))}
              />
              <Dropdown
                label="Tax Residence"
                value={inputs.taxResidence}
                onChange={setField('taxResidence')}
                options={RESIDENCE_OPTIONS.map((r) => ({ value: r, label: RESIDENCE_LABELS[r] }))}
                description="US citizenship carries US tax exposure regardless of residence."
              />
            </SectionCard>
          </div>

          {/* Visualization */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/40 p-6 shadow-lg shadow-black/20">
              <p className="text-xs uppercase tracking-wider text-slate-400">Break-Even Point</p>
              <p className="text-2xl font-bold text-white">
                {displayBreakEvenYear ? `Year ${displayBreakEvenYear}` : 'Renting Wins'}
              </p>
              <p className="mt-1 max-w-xl text-sm text-slate-400">
                {isFlip
                  ? displayBreakEvenYear
                    ? `Buying overtakes investing the same capital by the flip, in year ${displayBreakEvenYear}.`
                    : `Investing the same capital still beats buying at the flip (year ${flipYear}).`
                  : displayBreakEvenYear
                    ? `Buying overtakes investing the same capital in year ${displayBreakEvenYear}.`
                    : 'Over 30 years, investing the same capital beats buying in this scenario.'}
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
                      ? `Regular monthly developer milestone payment (excludes the 20% booking fee and any handover-time lump sum). ${PAYMENT_PLANS[inputs.developerPlan]?.label ?? ''} — Danube's continues through month 80, offset by rental income after handover.`
                      : undefined
                  }
                />
                <StatCard
                  label={isFlip ? `Buyer Net Worth (at Flip, Yr ${flipYear})` : 'Buyer Net Worth (Yr 30)'}
                  value={finalYear ? fmt(finalYear.buyerNetWorth, false) : '-'}
                  accentClass={buyerWinsAt30 ? 'text-amber-400' : 'text-slate-300'}
                  tooltip="Ready/Off-Plan-Hold: home value if sold this year, minus selling costs, any remaining balance, and exit tax. Off-Plan-Flip: the reinvested flip proceeds, right at the moment of the flip."
                />
                <StatCard
                  label={isFlip ? `Renter Net Worth (at Flip, Yr ${flipYear})` : 'Renter Net Worth (Yr 30)'}
                  value={finalYear ? fmt(finalYear.renterNetWorth, false) : '-'}
                  accentClass={!buyerWinsAt30 ? 'text-rose-400' : 'text-slate-300'}
                  tooltip="Starting capital equal to the Buyer's own month-0 cash outlay, plus every month's difference between what the Buyer actually spends on the property and rent — compounding at your Global Tax Profile's net stock return."
                />
                {isFlip && (
                  <StatCard
                    label={`Flip IRR (${flipYear}-yr)`}
                    value={flipCAGR != null ? `${(flipCAGR * 100).toFixed(1)}%` : '-'}
                    accentClass="text-emerald-400"
                    tooltip="A true internal rate of return, not a simple lump-sum CAGR — it accounts for exactly when each booking fee, installment, and the DLD fee were paid, not just the total invested. Since it's on capital actually paid in (not the full price), it's a leveraged figure — part of the price was never at risk."
                  />
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
              <h3 className="mb-4 text-sm font-semibold text-slate-300">
                {isFlip ? `Net Worth Projection Through the Flip (Year ${flipYear})` : '30-Year Net Worth Projection'}
              </h3>
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="year"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{ value: 'Years', position: 'insideBottom', offset: -3, fill: '#64748b' }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(v) => fmt(v)}
                      width={70}
                    />
                    <Tooltip
                      formatter={tooltipFormatter(fmt)}
                      labelFormatter={(year) => `Year ${year}`}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '0.75rem',
                        color: '#e2e8f0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                    {displayBreakEvenYear && (
                      <ReferenceLine
                        x={displayBreakEvenYear}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{ value: 'Break-even', fill: '#f59e0b', fontSize: 11, position: 'top' }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="buyerNetWorth"
                      name="Buying"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="renterNetWorth"
                      name="Investing Instead"
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
                  `Chart and figures above stop at the flip (year ${flipYear}) — past that point the Buyer path is just a generic reinvested portfolio, not a real estate projection. `}
                Tax calculations are simplified estimates based on standard 2026 primary residence
                and capital gains laws. Off-plan milestones are estimates.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
              <h3 className="mb-1 text-sm font-semibold text-slate-300">Buyer Net Worth: Equity vs Appreciation</h3>
              <p className="mb-4 text-xs text-slate-500">
                Cost-Basis Equity is what you've actually paid in (mortgage paydown or developer
                milestones), at the original price. Appreciation Gain is the price-growth portion,
                net of exit tax and selling costs. Together, these two are Buyer Net Worth — the
                Buying line above.
                {isOffPlan &&
                  " Cash / Uncommitted (shown for reference) is capital not yet tied up in the property — the off-plan float before handover — and is deliberately excluded from Buyer Net Worth, since it's idle capital, not realized property value."}
                {isFlip &&
                  ' In the flip year itself, the payout is attributed back to Cost-Basis Equity and Appreciation Gain (where it actually came from) rather than shown as cash — only in years after the flip does it become an undifferentiated reinvested portfolio.'}
              </p>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="year"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{ value: 'Years', position: 'insideBottom', offset: -3, fill: '#64748b' }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(v) => fmt(v)}
                      width={70}
                    />
                    <Tooltip
                      formatter={tooltipFormatter(fmt)}
                      labelFormatter={(year) => `Year ${year}`}
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
                    {isOffPlan && (
                      <Bar dataKey="buyerCashPortion" name="Cash / Uncommitted" stackId="buyer" fill="#94a3b8" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrintReport
        inputs={inputs}
        data={chartData}
        mortgagePayment={mortgagePayment}
        downPayment={downPayment}
        breakEvenYear={displayBreakEvenYear}
        finalYear={finalYear}
        displayCurrency={displayCurrency}
        effectiveAppreciation={effectiveAppreciation}
        flipCAGR={flipCAGR}
        isFlip={isFlip}
        flipYear={flipYear}
        offPlanMonthlyInstallment={offPlanMonthlyInstallment}
      />
    </div>
  )
}
