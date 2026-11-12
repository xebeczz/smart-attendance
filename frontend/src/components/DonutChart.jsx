// Donut ring for the dashboard: overall % with a black tick marking the
// 75% requirement. The arc is coloured by the risk band (green >= 75,
// amber 65-74, red < 65). 0% is at the top, so the 75% tick sits on the
// left side of the ring.

import { donutColor } from '../utils/attendance.js'

const CX = 105
const CY = 105
const R = 82
const CIRC = 2 * Math.PI * R

export default function DonutChart({ percentage }) {
  const has = percentage !== null && percentage !== undefined
  const pct = has ? Math.max(0, Math.min(100, Number(percentage))) : 0
  const color = donutColor(pct)
  const arc = (pct / 100) * CIRC
  // Tick at 75%: angle 180 deg (left side). Radial line from R-9 to R+9.
  const x1 = CX - (R - 9)
  const x2 = CX - (R + 9)
  return (
    <svg width="210" height="210" viewBox="0 0 210 210" role="img"
      aria-label={has ? `Overall attendance ${pct.toFixed(1)} percent` : 'No attendance data yet'}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth="17" />
      {has && pct > 0 && (
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth="17"
          strokeDasharray={`${arc} ${CIRC}`} transform={`rotate(-90 ${CX} ${CY})`} />
      )}
      <line x1={x1} y1={CY} x2={x2} y2={CY} stroke="var(--text)" strokeWidth="5" strokeLinecap="round" />
      <text x={CX} y={CY - 2} textAnchor="middle" fontSize="38" fontWeight="800"
        style={{ fill: 'var(--text)' }}>
        {has ? `${pct.toFixed(1)}%` : '—'}
      </text>
      <text x={CX} y={CY + 26} textAnchor="middle" fontSize="14"
        style={{ fill: 'var(--muted)' }}>
        Required 75%
      </text>
    </svg>
  )
}
