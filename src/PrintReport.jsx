import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from './format.js'
import { PAYMENT_PLANS } from './paymentPlans.js'
import { COMMUNITIES } from './communities.js'
import { computeAnnualServiceCharges } from './serviceCharges.js'
import { resolveTaxProfile } from './taxEngine.js'

const CITIZENSHIP_LABELS = { USA: 'USA', UK: 'UK', Canada: 'Canada', India: 'India', 'UAE/Other': 'UAE / Other' }
const RESIDENCE_LABELS = { UAE: 'UAE', USA: 'USA', UK: 'UK', Canada: 'Canada', India: 'India', Other: 'Other' }

function InputRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-200 py-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}

export default function PrintReport({
  inputs,
  data,
  mortgagePayment,
  downPayment,
  breakEven,
  finalYear,
  displayCurrency,
  effectivePreHandoverAppreciation,
  effectivePostHandoverAppreciation,
  flipCAGR,
  isFlip,
  flipMonth,
  flipYearsLabel,
  offPlanMonthlyInstallment,
  buyerIRR,
  renterIRR,
  roiChartData,
  buyerMoic,
  renterMoic,
  netRentalYieldPct,
  cashOnCashPct,
}) {
  const buyerWinsAt30 = finalYear && finalYear.buyerNetWorth > finalYear.renterNetWorth
  const fmt = (value, compact = true) => formatCurrency(value, displayCurrency, compact)
  const isOffPlan = inputs.propertyStatus === 'OFFPLAN'
  const taxProfile = resolveTaxProfile(inputs.citizenship, inputs.taxResidence)
  const generatedOn = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="print-only bg-white p-10 text-slate-900">
      <header className="mb-6 border-b-2 border-slate-900 pb-4">
        <h1 className="text-2xl font-bold">Dubai Real Estate Opportunity Cost Report</h1>
        <p className="mt-1 text-sm text-slate-500">Generated {generatedOn}</p>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Bottom Line</h2>
        <p className="mb-3 text-base">
          {isFlip
            ? breakEven
              ? `Dubai Property overtakes the Alternate Investment by the flip, in month ${breakEven}.`
              : `The Alternate Investment still beats Dubai Property at the flip (month ${flipMonth}).`
            : breakEven
              ? `Dubai Property overtakes the Alternate Investment in year ${breakEven}.`
              : 'Over 30 years, the Alternate Investment beats Dubai Property in this scenario.'}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">
              {isOffPlan ? 'Installment / mo (Construction)' : 'Mortgage (P&amp;I) / mo'}
            </p>
            <p className="text-lg font-bold">
              {isOffPlan ? fmt(offPlanMonthlyInstallment, false) : mortgagePayment > 0 ? fmt(mortgagePayment, false) : 'N/A'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">
              {isFlip ? `Dubai Property Net Worth (at Flip, Mo ${flipMonth})` : 'Dubai Property Net Worth (Yr 30)'}
            </p>
            <p className={`text-lg font-bold ${buyerWinsAt30 ? 'text-amber-600' : ''}`}>
              {finalYear ? fmt(finalYear.buyerNetWorth, false) : '-'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">
              {isFlip ? `Alternate Investment Net Worth (at Flip, Mo ${flipMonth})` : 'Alternate Investment Net Worth (Yr 30)'}
            </p>
            <p className={`text-lg font-bold ${!buyerWinsAt30 ? 'text-sky-600' : ''}`}>
              {finalYear ? fmt(finalYear.renterNetWorth, false) : '-'}
            </p>
          </div>
          {isFlip && (
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Flip IRR ({flipYearsLabel}-yr)</p>
              <p className="text-lg font-bold text-emerald-600">
                {flipCAGR != null ? `${(flipCAGR * 100).toFixed(1)}%` : '-'}
              </p>
            </div>
          )}
          {!isFlip && (
            <>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Dubai Property Annualized Return (30-yr)</p>
                <p className="text-lg font-bold text-emerald-600">
                  {buyerIRR != null ? `${(buyerIRR * 100).toFixed(1)}%` : '-'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Alternate Investment Annualized Return (30-yr)</p>
                <p className="text-lg font-bold text-emerald-600">
                  {renterIRR != null ? `${(renterIRR * 100).toFixed(1)}%` : '-'}
                </p>
              </div>
            </>
          )}
          {!isOffPlan && (
            <>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Net Rental Yield (Yr 1)</p>
                <p className="text-lg font-bold">{netRentalYieldPct != null ? `${netRentalYieldPct.toFixed(2)}%` : '-'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Cash-on-Cash Return (Yr 1)</p>
                <p className="text-lg font-bold">{cashOnCashPct != null ? `${cashOnCashPct.toFixed(1)}%` : '-'}</p>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mb-6" style={{ breakInside: 'avoid' }}>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {isFlip ? `Net Worth Projection Through the Flip (Month ${flipMonth})` : '30-Year Net Worth Projection'}
        </h2>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={isFlip ? 'month' : 'year'} stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis
                stroke="#475569"
                tick={{ fill: '#475569', fontSize: 11 }}
                tickFormatter={(v) => fmt(v)}
                width={65}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {breakEven && <ReferenceLine x={breakEven} stroke="#f59e0b" strokeDasharray="4 4" />}
              <Line
                type="monotone"
                dataKey="buyerNetWorth"
                name="Dubai Property"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="renterNetWorth"
                name="Alternate Investment"
                stroke="#0284c7"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-6" style={{ breakInside: 'avoid' }}>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Dubai Property Net Worth: Equity vs Appreciation
        </h2>
        <p className="mb-3 text-sm">
          Cost-Basis Equity is what you've actually paid in (mortgage paydown or developer
          milestones), at the original price. Appreciation Gain is the price-growth portion, net
          of exit tax and selling costs. Invested Rental Surplus is the landlord's accumulated
          rental profit — rent collected, net of vacancy, minus the mortgage (or off-plan
          installment) and carrying costs — reinvested and compounding. Together, these three are
          Dubai Property Net Worth — the Dubai Property line in the chart above.
          {isOffPlan &&
            " Cash / Uncommitted (shown for reference) is capital not yet tied up in the property — the off-plan float before handover — and is deliberately excluded from Dubai Property Net Worth, since it's idle capital, not realized property value."}
          {isFlip &&
            ' In the flip year itself, the payout is attributed back to Cost-Basis Equity and Appreciation Gain (where it actually came from) rather than shown as cash — only in years after the flip does it become an undifferentiated reinvested portfolio.'}
        </p>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={isFlip ? 'month' : 'year'} stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis
                stroke="#475569"
                tick={{ fill: '#475569', fontSize: 11 }}
                tickFormatter={(v) => fmt(v)}
                width={65}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar
                dataKey="buyerCostBasisEquity"
                name="Cost-Basis Equity"
                stackId="buyer"
                fill="#f59e0b"
                isAnimationActive={false}
              />
              <Bar
                dataKey="buyerAppreciationGain"
                name="Appreciation Gain"
                stackId="buyer"
                fill="#22c55e"
                isAnimationActive={false}
              />
              <Bar
                dataKey="buyerLandlordSurplus"
                name="Invested Rental Surplus"
                stackId="buyer"
                fill="#14b8a6"
                isAnimationActive={false}
              />
              {isOffPlan && (
                <Bar
                  dataKey="buyerCashPortion"
                  name="Cash / Uncommitted"
                  stackId="buyer"
                  fill="#94a3b8"
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-6" style={{ breakInside: 'avoid' }}>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Alternate Investment: Contributed Capital vs Growth
        </h2>
        <p className="mb-3 text-sm">
          Contributed Capital is cash actually put in so far — the starting capital plus every
          month's mortgage payment (or off-plan developer installment) that would have gone into
          building home equity, same figures as the Dubai Property chart above, just invested here
          instead. Investment Growth is everything above that from compounding. Together, these two
          are Alternate Investment Net Worth — the Alternate Investment line in the first chart.
        </p>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={isFlip ? 'month' : 'year'} stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis
                stroke="#475569"
                tick={{ fill: '#475569', fontSize: 11 }}
                tickFormatter={(v) => fmt(v)}
                width={65}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="renterContributed" name="Contributed Capital" stackId="renter" fill="#38bdf8" isAnimationActive={false} />
              <Bar dataKey="renterGrowth" name="Investment Growth" stackId="renter" fill="#22c55e" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-6" style={{ breakInside: 'avoid' }}>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Return on Investment Over Time</h2>
        <p className="mb-3 text-sm">
          Return relative to capital actually invested so far, not Net Worth itself.{' '}
          {isFlip ? `As of the flip (month ${flipMonth})` : 'As of Year 30'}, Dubai Property is{' '}
          {buyerMoic != null ? `${buyerMoic.toFixed(1)}x` : '-'} your invested capital, vs.
          Alternate Investment's {renterMoic != null ? `${renterMoic.toFixed(1)}x` : '-'}.
        </p>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={roiChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={isFlip ? 'month' : 'year'} stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis
                stroke="#475569"
                tick={{ fill: '#475569', fontSize: 11 }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                width={55}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Line
                type="monotone"
                dataKey="buyerROIPct"
                name="Dubai Property"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="renterROIPct"
                name="Alternate Investment"
                stroke="#0284c7"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-x-10" style={{ breakInside: 'avoid' }}>
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">The Property</h2>
          {inputs.propertyName && <InputRow label="Property Name" value={inputs.propertyName} />}
          {inputs.propertyType && <InputRow label="Property Type" value={inputs.propertyType} />}
          <InputRow label="Property Price" value={fmt(inputs.propertyPrice, false)} />
          <InputRow label="Monthly Rent (Collected)" value={fmt(inputs.monthlyRent, false)} />
          <InputRow label="Asset Class" value={inputs.assetClass === 'CONDO' ? 'Condo' : 'Townhouse / Villa'} />
          <InputRow label="Near Metro Blue Line Expansion" value={inputs.nearMetro ? 'Yes' : 'No'} />
          <InputRow label="Near Al Maktoum Airport Expansion" value={inputs.nearAirport ? 'Yes' : 'No'} />
          <InputRow label="Property Status" value={isOffPlan ? 'Off-Plan' : 'Ready'} />
          {isOffPlan && (
            <>
              <InputRow label="Developer Payment Plan" value={PAYMENT_PLANS[inputs.developerPlan]?.label ?? '-'} />
              <InputRow
                label="Exit Strategy"
                value={inputs.exitStrategy === 'FLIP' ? 'Flip Before Handover' : 'Hold Long Term'}
              />
            </>
          )}

          <h2 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            {isOffPlan ? 'Purchase' : 'Financing'}
          </h2>
          {isOffPlan ? (
            <InputRow
              label="Booking Fee (Month 0)"
              value={`${PAYMENT_PLANS[inputs.developerPlan]?.bookingPct ?? ''}% (${fmt(downPayment, false)})`}
            />
          ) : (
            <>
              <InputRow label="Down Payment" value={`${inputs.downPaymentPct}% (${fmt(downPayment, false)})`} />
              <InputRow label="Mortgage Rate" value={`${inputs.mortgageRate.toFixed(1)}%`} />
              <InputRow label="Mortgage Term" value={`${inputs.mortgageTermYears} yrs`} />
            </>
          )}

          <h2 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            Homeownership Costs
          </h2>
          <InputRow label="Community" value={COMMUNITIES.find((c) => c.key === inputs.community)?.label ?? '-'} />
          <InputRow label="Property Size" value={`${inputs.propertySizeSqft.toLocaleString()} sq ft`} />
          <InputRow label="Service Charge Rate" value={`${inputs.serviceChargeRate.toFixed(1)} AED/sq ft/yr`} />
          <InputRow
            label="Annual Service Charges"
            value={fmt(computeAnnualServiceCharges(inputs.propertySizeSqft, inputs.serviceChargeRate), false)}
          />
          <InputRow label="Annual Home Insurance" value={fmt(inputs.homeInsuranceAnnual, false)} />
          <InputRow label="Yearly Maintenance" value={fmt(inputs.yearlyMaintenance, false)} />
          <InputRow label="Cost Inflation" value={`${inputs.costInflation.toFixed(1)}%`} />
          <InputRow label="Selling Costs" value={`${inputs.sellingCostPct.toFixed(1)}%`} />
          <InputRow label="DLD Transfer Fee" value={`${inputs.dldFeePct.toFixed(1)}%`} />
          <InputRow
            label="DLD Fee Waiver"
            value={inputs.dldWaiverPct > 0 ? `${inputs.dldWaiverPct}%` : 'None'}
          />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Market Assumptions</h2>
          {isOffPlan && (
            <>
              <InputRow label="Pre-Handover Appreciation" value={`${inputs.preHandoverAppreciation.toFixed(1)}%`} />
              <InputRow
                label="Effective Pre-Handover Rate"
                value={`${effectivePreHandoverAppreciation.toFixed(1)}%`}
              />
            </>
          )}
          <InputRow label="Post-Handover Appreciation" value={`${inputs.postHandoverAppreciation.toFixed(1)}%`} />
          <InputRow
            label="Effective Post-Handover Rate"
            value={`${effectivePostHandoverAppreciation.toFixed(1)}%`}
          />
          <InputRow label="Rental Yield" value={`${inputs.rentalYield.toFixed(1)}%`} />
          <InputRow label="Vacancy Rate" value={`${inputs.vacancyRatePct.toFixed(1)}%`} />
          <InputRow label="Rent Inflation" value={`${inputs.rentInflation.toFixed(1)}%`} />
          <InputRow label="Expected Stock Market Return (gross)" value={`${inputs.stockReturn.toFixed(1)}%`} />

          <h2 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            Global Tax Profile
          </h2>
          <InputRow label="Citizenship" value={CITIZENSHIP_LABELS[inputs.citizenship] ?? inputs.citizenship} />
          <InputRow label="Tax Residence" value={RESIDENCE_LABELS[inputs.taxResidence] ?? inputs.taxResidence} />
          {(taxProfile.key === 'US' || taxProfile.key === 'CANADA') && (
            <>
              <InputRow label="Federal Marginal Tax Rate" value={`${inputs.marginalTaxRateFed.toFixed(1)}%`} />
              <InputRow
                label={taxProfile.key === 'US' ? 'State Marginal Tax Rate' : 'Provincial Marginal Tax Rate'}
                value={`${inputs.marginalTaxRateState.toFixed(1)}%`}
              />
            </>
          )}
          {(taxProfile.key === 'UK' || taxProfile.key === 'INDIA') && (
            <InputRow label="Marginal Tax Rate" value={`${inputs.marginalTaxRateSingle.toFixed(1)}%`} />
          )}
          {taxProfile.key !== 'FREE' && (
            <InputRow label="Capital Gains Tax Rate" value={`${inputs.capitalGainsTaxRatePct.toFixed(1)}%`} />
          )}
          <InputRow label="Personal Primary Residence" value={inputs.isPrimaryResidence ? 'Yes' : 'No'} />

          <h2 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            Local Dubai Taxes
          </h2>
          <InputRow label="Property Tax" value="0%" />
          <InputRow label="Capital Gains Tax" value="0%" />
          <InputRow label="Rental / Personal Income Tax" value="0%" />
        </div>
      </section>

      <footer className="border-t border-slate-200 pt-3 text-xs text-slate-400">
        {isFlip &&
          `Chart and figures above stop at the flip (month ${flipMonth}) — past that point the Dubai Property path is just a generic reinvested portfolio, not a real estate projection. `}
        Tax calculations are simplified estimates based on standard 2026 tax rules — Hold exits
        default to investment-property rates unless marked a Personal Primary Residence (Global
        Tax Profile). Off-plan milestones, appreciation, and rental income are estimates; the
        mortgage model assumes one fixed rate for the full term and doesn't enforce real UAE
        loan-to-value limits. Figures are illustrative projections, not financial advice.
      </footer>
    </div>
  )
}
