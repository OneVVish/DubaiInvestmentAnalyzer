import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectVisitorContext, fetchLoggedScenarios, isLikelyBot, logScenario } from './scenarioLog.js'

// No jsdom in this project — stub just enough of the browser globals
// collectVisitorContext() reads, rather than pulling in a DOM environment.
beforeEach(() => {
  vi.stubGlobal('navigator', { userAgent: 'test-agent', language: 'en-US' })
  vi.stubGlobal('window', { screen: { width: 1920, height: 1080 } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('isLikelyBot', () => {
  it('flags navigator.webdriver — set by essentially every headless automation framework by default', () => {
    vi.stubGlobal('navigator', { userAgent: 'test-agent', language: 'en-US', webdriver: true })
    expect(isLikelyBot()).toBe(true)
  })

  it('flags common bot/crawler/non-browser user-agent substrings, case-insensitively', () => {
    for (const ua of ['Googlebot/2.1', 'curl/8.0', 'python-requests/2.31', 'Mozilla/5.0 HEADLESSCHROME']) {
      vi.stubGlobal('navigator', { userAgent: ua, language: 'en-US', webdriver: false })
      expect(isLikelyBot()).toBe(true)
    }
  })

  it('does not flag an ordinary browser', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      language: 'en-US',
      webdriver: false,
    })
    expect(isLikelyBot()).toBe(false)
  })

  it('flags a missing navigator entirely (not a real browser context)', () => {
    vi.stubGlobal('navigator', undefined)
    expect(isLikelyBot()).toBe(true)
  })
})

describe('collectVisitorContext', () => {
  it('merges browser info with a successful IP-geolocation lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          city: 'Dubai',
          region: 'Dubai',
          country_name: 'United Arab Emirates',
          country_code: 'AE',
          ip: '1.2.3.4',
        }),
      }),
    )
    const context = await collectVisitorContext()
    expect(context).toEqual({
      userAgent: 'test-agent',
      screenWidth: 1920,
      screenHeight: 1080,
      timezone: expect.any(String),
      language: 'en-US',
      city: 'Dubai',
      region: 'Dubai',
      country: 'United Arab Emirates',
      country_code: 'AE',
      ip: '1.2.3.4',
    })
  })

  it('falls back to just browser info when the geolocation lookup fails — never throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const context = await collectVisitorContext()
    expect(context).toEqual({
      userAgent: 'test-agent',
      screenWidth: 1920,
      screenHeight: 1080,
      timezone: expect.any(String),
      language: 'en-US',
    })
  })

  it('skips the geolocation lookup entirely for detected automation — no point spending the free quota', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test-agent', language: 'en-US', webdriver: true })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const context = await collectVisitorContext()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(context).toEqual({
      userAgent: 'test-agent',
      screenWidth: 1920,
      screenHeight: 1080,
      timezone: expect.any(String),
      language: 'en-US',
    })
  })
})

describe('logScenario', () => {
  it('does nothing when the log URL is not configured', () => {
    vi.stubEnv('VITE_SCENARIO_LOG_URL', '')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    logScenario({ propertyPrice: 1000000 }, { city: 'Dubai' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('POSTs the scenario and visitor context as a text/plain body (avoids a CORS preflight)', () => {
    vi.stubEnv('VITE_SCENARIO_LOG_URL', 'https://script.google.com/macros/s/fake/exec')
    const fetchSpy = vi.fn().mockResolvedValue({})
    vi.stubGlobal('fetch', fetchSpy)
    logScenario({ propertyPrice: 1000000 }, { city: 'Dubai' }, 'open')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://script.google.com/macros/s/fake/exec',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          scenario: { propertyPrice: 1000000, logTrigger: 'open' },
          visitor: { city: 'Dubai' },
        }),
      }),
    )
  })

  it('folds the trigger into the scenario payload even when omitted (undefined, not a crash)', () => {
    vi.stubEnv('VITE_SCENARIO_LOG_URL', 'https://script.google.com/macros/s/fake/exec')
    const fetchSpy = vi.fn().mockResolvedValue({})
    vi.stubGlobal('fetch', fetchSpy)
    logScenario({ propertyPrice: 1000000 }, { city: 'Dubai' })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://script.google.com/macros/s/fake/exec',
      expect.objectContaining({
        body: JSON.stringify({
          scenario: { propertyPrice: 1000000, logTrigger: undefined },
          visitor: { city: 'Dubai' },
        }),
      }),
    )
  })

  it('swallows a failed request — logging must never disrupt the calculator', async () => {
    vi.stubEnv('VITE_SCENARIO_LOG_URL', 'https://script.google.com/macros/s/fake/exec')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(() => logScenario({}, {})).not.toThrow()
  })

  it('does nothing for detected automation, even with a configured log URL', () => {
    vi.stubEnv('VITE_SCENARIO_LOG_URL', 'https://script.google.com/macros/s/fake/exec')
    vi.stubGlobal('navigator', { userAgent: 'test-agent', language: 'en-US', webdriver: true })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    logScenario({ propertyPrice: 1000000 }, { city: 'Dubai' }, 'open')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('fetchLoggedScenarios', () => {
  it('throws when the log URL is not configured', async () => {
    vi.stubEnv('VITE_SCENARIO_LOG_URL', '')
    await expect(fetchLoggedScenarios('secret')).rejects.toThrow('not configured')
  })

  it('sends the secret as a query param and returns the scenarios array on success', async () => {
    vi.stubEnv('VITE_SCENARIO_LOG_URL', 'https://script.google.com/macros/s/fake/exec')
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, scenarios: [{ index: 0, scenario: { propertyPrice: 1000000 } }] }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    const scenarios = await fetchLoggedScenarios('the-passphrase')
    expect(fetchSpy).toHaveBeenCalledWith('https://script.google.com/macros/s/fake/exec?secret=the-passphrase')
    expect(scenarios).toEqual([{ index: 0, scenario: { propertyPrice: 1000000 } }])
  })

  it('throws on a wrong passphrase', async () => {
    vi.stubEnv('VITE_SCENARIO_LOG_URL', 'https://script.google.com/macros/s/fake/exec')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: false, error: 'unauthorized' }) }))
    await expect(fetchLoggedScenarios('wrong')).rejects.toThrow('unauthorized')
  })
})
