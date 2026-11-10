// Risk badge. Accepts the backend risk_status string or a percentage.
// Backend thresholds: SAFE >= 75%, WARNING 65-74%, HIGH RISK < 65%.

export function riskClass(status, percentage) {
  const s = String(status || '').toLowerCase()
  if (s.includes('high') || s.includes('risk')) return 'high'
  if (s.includes('warn') || s.includes('medium') || s.includes('at risk')) return 'warning'
  if (s.includes('safe') || s.includes('good') || s.includes('low')) return 'safe'
  if (percentage !== undefined && percentage !== null) {
    if (percentage >= 75) return 'safe'
    if (percentage >= 65) return 'warning'
    return 'high'
  }
  return 'warning'
}

export function riskLabel(status, percentage) {
  const cls = riskClass(status, percentage)
  if (cls === 'safe') return 'SAFE'
  if (cls === 'warning') return 'WARNING'
  return 'HIGH RISK'
}

export default function RiskBadge({ status, percentage }) {
  const cls = riskClass(status, percentage)
  return <span className={`badge ${cls}`}>{riskLabel(status, percentage)}</span>
}
