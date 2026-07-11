// Private, owner-only scenario logging — see google-apps-script/README.md
// for the backend this talks to. Set at build time (baked into the static
// bundle, since there's no server to read it at request time); unset in a
// local dev checkout until you copy .env.example to .env. Read inside each
// function rather than cached at module load, so it reflects whatever's
// current at call time (and is straightforward to stub in tests).
const getLogUrl = () => import.meta.env.VITE_SCENARIO_LOG_URL

// Gathers what's available synchronously from the browser, then best-effort
// resolves an approximate IP-based location from a free, keyless lookup —
// silent, no permission prompt (unlike navigator.geolocation, which always
// shows one). Never throws; a failed/timed-out lookup just omits location.
export async function collectVisitorContext() {
  const context = {
    userAgent: navigator.userAgent,
    screenWidth: window.screen?.width ?? null,
    screenHeight: window.screen?.height ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  }
  try {
    const response = await fetch('https://ipapi.co/json/')
    const location = await response.json()
    return {
      ...context,
      city: location.city,
      region: location.region,
      country: location.country_name,
      country_code: location.country_code,
      ip: location.ip,
    }
  } catch {
    return context
  }
}

// Fire-and-forget — a logging failure must never disrupt the calculator
// itself. Content-Type is deliberately text/plain, not application/json: a
// custom Content-Type on a cross-origin request triggers a CORS preflight
// (an OPTIONS request) that Apps Script Web Apps don't handle, so the POST
// would silently fail. The Apps Script side still JSON.parses the raw body.
export function logScenario(inputs, visitorContext) {
  const logUrl = getLogUrl()
  if (!logUrl) return
  fetch(logUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ scenario: inputs, visitor: visitorContext }),
  }).catch(() => {
    // Best-effort only — ignore network/CORS/quota failures.
  })
}

// Throws on a bad passphrase, a misconfigured endpoint, or a network error —
// the admin view is responsible for turning that into a user-facing message.
export async function fetchLoggedScenarios(secret) {
  const logUrl = getLogUrl()
  if (!logUrl) throw new Error('Scenario log is not configured')
  const url = new URL(logUrl)
  url.searchParams.set('secret', secret)
  const response = await fetch(url.toString())
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load scenarios')
  return data.scenarios
}
