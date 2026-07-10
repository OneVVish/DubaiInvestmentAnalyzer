const URL_PARAM = 's'

export function encodeState(state) {
  return btoa(JSON.stringify(state))
}

export function decodeState(encoded) {
  try {
    return JSON.parse(atob(encoded))
  } catch {
    return null
  }
}

export function getStateFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get(URL_PARAM)
  return encoded ? decodeState(encoded) : null
}

// Writes the encoded state into the address bar (so the visible URL is already
// shareable) and returns the full URL string for copying.
export function buildShareUrl(state) {
  const url = new URL(window.location.href)
  url.searchParams.set(URL_PARAM, encodeState(state))
  window.history.replaceState(null, '', url)
  return url.toString()
}
