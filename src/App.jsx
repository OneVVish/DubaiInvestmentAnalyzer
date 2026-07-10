import { useMemo, useState } from 'react'
import {
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
  AIRPORT_BONUS_PCT,
  METRO_BONUS_PCT,
  getEffectiveAppreciation,
  runSimulation,
} from './simulation.js'
import { CITIZENSHIP_OPTIONS, RESIDENCE_OPTIONS } from './taxEngine.js'
import { PAYMENT_PLANS } from './paymentPlans.js'
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

const DEFAULT_INPUTS = {
  propertyPrice: 1500000,
  monthlyRent: 8750,
  rentInflation: 5,
  rentalYield: 7,
  assetClass: 'CONDO',
  nearMetro: false,
  nearAirport: false,
  homeAppreciation: ASSET_CLASS_APPRECIATION_DEFAULTS.CONDO,
  propertyStatus: 'READY',
  developerPlan: 'EMAAR',
  exitStrategy: 'HOLD',
  downPaymentPct: 25,
  mortgageRate: 4.5,
  mortgageTermYears: 25,
  monthlyServiceCharges: 500,
  homeInsuranceAnnual: 1500,
  yearlyMaintenance: 5000,
  costInflation: 3,
  sellingCostPct: 2,
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
    setInputs((prev) => ({ ...prev, assetClass, homeAppreciation: ASSET_CLASS_APPRECIATION_DEFAULTS[assetClass] }))

  const { data, mortgagePayment, downPayment, breakEvenYear } = useMemo(() => runSimulation(inputs), [inputs])
  const finalYear = data[data.length - 1]
  const effectiveAppreciation = getEffectiveAppreciation(inputs)

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
              <Slider
                label="Property Price"
                value={inputs.propertyPrice}
                onChange={setField('propertyPrice')}
                min={300000}
                max={20000000}
                step={10000}
                format={(v) => fmt(v)}
              />
              <Slider
                label="Monthly Rent (comparable)"
                value={inputs.monthlyRent}
                onChange={setField('monthlyRent')}
                min={1000}
                max={100000}
                step={250}
                format={(v) => fmt(v)}
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
                label="Monthly Service Charges"
                value={inputs.monthlyServiceCharges}
                onChange={setField('monthlyServiceCharges')}
                min={0}
                max={5000}
                step={50}
                format={(v) => fmt(v)}
                description="Building/community fees — paid by the owner, not the tenant."
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
                description="Dubai's typical range is 6-10%. Used to offset Danube-style post-handover installments."
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
                {breakEvenYear ? `Year ${breakEvenYear}` : 'Renting Wins'}
              </p>
              <p className="mt-1 max-w-xl text-sm text-slate-400">
                {breakEvenYear
                  ? `Buying overtakes investing the same capital in year ${breakEvenYear}.`
                  : 'Over 30 years, investing the same capital beats buying in this scenario.'}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Mortgage (P&I) / mo"
                  value={mortgagePayment > 0 ? fmt(mortgagePayment, false) : 'N/A (Off-Plan)'}
                  accentClass="text-white"
                />
                <StatCard
                  label="Buyer Net Worth (Yr 30)"
                  value={finalYear ? fmt(finalYear.buyerNetWorth, false) : '-'}
                  accentClass={buyerWinsAt30 ? 'text-amber-400' : 'text-slate-300'}
                  tooltip="Ready/Off-Plan-Hold: home value if sold this year, minus selling costs, any remaining balance, and exit tax. Off-Plan-Flip: the reinvested flip proceeds, compounding alone from month 37."
                />
                <StatCard
                  label="Renter Net Worth (Yr 30)"
                  value={finalYear ? fmt(finalYear.renterNetWorth, false) : '-'}
                  accentClass={!buyerWinsAt30 ? 'text-rose-400' : 'text-slate-300'}
                  tooltip="Starting capital equal to the Buyer's own month-0 cash outlay, plus every month's difference between what the Buyer actually spends on the property and rent — compounding at your Global Tax Profile's net stock return."
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
              <h3 className="mb-4 text-sm font-semibold text-slate-300">30-Year Net Worth Projection</h3>
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                    {breakEvenYear && (
                      <ReferenceLine
                        x={breakEvenYear}
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
                Tax calculations are simplified estimates based on standard 2026 primary residence
                and capital gains laws. Off-plan milestones are estimates.
              </p>
            </div>
          </div>
        </div>
      </div>

      <PrintReport
        inputs={inputs}
        data={data}
        mortgagePayment={mortgagePayment}
        downPayment={downPayment}
        breakEvenYear={breakEvenYear}
        finalYear={finalYear}
        displayCurrency={displayCurrency}
        effectiveAppreciation={effectiveAppreciation}
      />
    </div>
  )
}
