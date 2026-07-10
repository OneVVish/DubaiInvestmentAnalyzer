import { useEffect, useState } from 'react'

// Returns `value`, but delayed until it stops changing for `delay` ms.
// Useful for gating expensive recomputation (e.g. Monte Carlo) behind slider
// drags without making the slider itself feel laggy.
export function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handle)
  }, [value, delay])

  return debounced
}
