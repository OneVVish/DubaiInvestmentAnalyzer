import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearUserDefaults, loadUserDefaults, saveUserDefaults } from './userDefaults.js'

function createMemoryStorage() {
  let store = {}
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value)
    },
    removeItem: (key) => {
      delete store[key]
    },
  }
}

beforeEach(() => {
  global.localStorage = createMemoryStorage()
})

afterEach(() => {
  delete global.localStorage
})

describe('saveUserDefaults / loadUserDefaults', () => {
  it('round-trips a saved inputs object', () => {
    const inputs = { propertyPrice: 1500000, stockReturn: 8 }
    saveUserDefaults(inputs)
    expect(loadUserDefaults()).toEqual(inputs)
  })

  it('returns null when nothing has been saved', () => {
    expect(loadUserDefaults()).toBeNull()
  })

  it('returns null gracefully on corrupted JSON', () => {
    global.localStorage.setItem('dubaiInvestmentAnalyzer.userDefaults.v1', '{not valid json')
    expect(loadUserDefaults()).toBeNull()
  })

  it('clearUserDefaults removes the saved entry', () => {
    saveUserDefaults({ propertyPrice: 1000000 })
    clearUserDefaults()
    expect(loadUserDefaults()).toBeNull()
  })
})
