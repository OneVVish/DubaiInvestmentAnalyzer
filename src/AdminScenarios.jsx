import { useState } from 'react'
import { fetchLoggedScenarios } from './scenarioLog.js'
import { COMMUNITIES } from './communities.js'

// Hidden behind ?admin=1 — never linked from the normal calculator UI. Not
// meant to be discoverable; see google-apps-script/README.md for how the
// passphrase this checks against is set (a Script Property, never in this
// repo's code).
export default function AdminScenarios({ onLoad }) {
  const [secret, setSecret] = useState('')
  const [scenarios, setScenarios] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleUnlock = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchLoggedScenarios(secret)
      setScenarios(rows)
    } catch {
      // Never reveal whether the endpoint itself is reachable beyond this —
      // a bad passphrase and a misconfigured/unreachable backend look identical.
      setError('Incorrect passphrase, or the scenario log is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  if (!scenarios) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20"
        >
          <h1 className="mb-1 text-lg font-bold text-white">Saved Scenarios</h1>
          <p className="mb-4 text-sm text-slate-400">Enter the passphrase to view logged scenarios.</p>
          <input
            type="password"
            autoFocus
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            placeholder="Passphrase"
          />
          {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !secret}
            className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <h1 className="mb-4 text-lg font-bold text-white">Saved Scenarios ({scenarios.length})</h1>
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Visitor Location</th>
              <th className="px-4 py-3">Property Name</th>
              <th className="px-4 py-3">Community</th>
              <th className="px-4 py-3">Property Price</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((row) => {
              const community = COMMUNITIES.find((c) => c.key === row.scenario?.community)?.label
              return (
                <tr key={row.index} className="border-b border-slate-800/60">
                  <td className="px-4 py-3 text-slate-300">{String(row.timestamp)}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {[row.city, row.country].filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.scenario?.propertyName || '-'}</td>
                  <td className="px-4 py-3 text-slate-300">{community ?? row.scenario?.community ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.scenario?.propertyPrice != null ? row.scenario.propertyPrice.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={!row.scenario}
                      onClick={() => onLoad(row.scenario)}
                      className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-amber-400 hover:text-white disabled:opacity-40"
                    >
                      Load
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
