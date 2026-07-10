const STORAGE_KEY = 'dubaiInvestmentAnalyzer.userDefaults.v1'

export function saveUserDefaults(inputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs))
    return true
  } catch {
    return false
  }
}

export function loadUserDefaults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function clearUserDefaults() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
