const COLUMNS = [
  { key: 'year', label: 'Year' },
  { key: 'buyerNetWorth', label: 'Dubai Property Net Worth (AED)' },
  { key: 'renterNetWorth', label: 'Alternate Investment Net Worth (AED)' },
  { key: 'homeValue', label: 'Home Value (AED)' },
]

export function buildCsv(data) {
  const header = COLUMNS.map((c) => c.label).join(',')
  const rows = data.map((d) => COLUMNS.map((c) => d[c.key]).join(','))
  return [header, ...rows].join('\n')
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
