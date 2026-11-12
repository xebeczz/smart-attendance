import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart as RePieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { chartColor, shortLabel } from '../utils/attendance.js'

const GREEN = '#16a34a'
const AMBER = '#d97706'
const RED = '#dc2626'

export function statusColor(pct) {
  if (pct >= 75) return GREEN
  if (pct >= 65) return AMBER
  return RED
}

// Wrap a long subject name onto at most two centred lines (≤12 chars
// each) instead of truncating it or tilting it diagonally.
function wrapLabel(name) {
  const words = String(name ?? '').split(' ')
  const lines = ['']
  for (const w of words) {
    const cur = lines[lines.length - 1]
    if ((cur + ' ' + w).trim().length <= 12) {
      lines[lines.length - 1] = (cur + ' ' + w).trim()
    } else if (lines.length < 2) {
      lines.push(w)
    } else {
      lines[1] = `${lines[1].slice(0, 10)}…`
    }
  }
  return lines
}

function WrappedTick({ x, y, payload }) {
  const lines = wrapLabel(payload?.value)
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill="currentColor">
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 12}>{line}</tspan>
      ))}
    </text>
  )
}

// One tooltip line: full subject name + value, never repeated.
function BarTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}>
      <strong>{p.payload?.name}</strong>: {p.value}
      {unit}
    </div>
  )
}

// Short x-axis label for the dashboard chart (e.g. "Data Structures" -> "DS").
function ShortTick({ x, y, payload }) {
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="currentColor">
      {shortLabel(payload?.value)}
    </text>
  )
}

export function BarChart({
  data,
  xKey = 'name',
  yKey = 'value',
  height = 300,
  colorByStatus = false,
  // Dashboard chart scheme: green on track, blue borderline, amber below 75%.
  chartColors = false,
  // One-line short labels under the bars (dashboard chart).
  shortLabels = false,
  // Value labels on top of each bar, e.g. "75%".
  showValueLabels = false,
  showTarget = false,
  target = 75,
  targetLabel = true,
  showGrid = true,
  yTicks,
  unit = '%',
  yDomain = [0, 100]
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis
          dataKey={xKey}
          tick={shortLabels ? <ShortTick /> : <WrappedTick />}
          height={shortLabels ? 28 : 52}
          interval={0}
        />
        <YAxis domain={yDomain} ticks={yTicks} width={32} tick={{ fontSize: 11 }} />
        <Tooltip content={<BarTooltip unit={unit} />} />
        {showTarget && (
          <ReferenceLine
            y={target}
            stroke={RED}
            strokeDasharray="5 4"
            label={targetLabel ? { value: `Required ${target}%`, position: 'insideTopRight', fontSize: 11, fill: RED } : undefined}
          />
        )}
        <Bar dataKey={yKey} fill="#2563eb" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={chartColors ? chartColor(Number(d[yKey] ?? 0)) : colorByStatus ? statusColor(Number(d[yKey] ?? 0)) : '#2563eb'} />
          ))}
          {showValueLabels && (
            <LabelList dataKey={yKey} position="top" formatter={(v) => `${Number(v).toFixed(0)}%`} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text)' }} />
          )}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  )
}

const PIE_COLORS = [GREEN, RED]

export function PieChart({ data, height = 300, colors = PIE_COLORS }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="75%"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
          labelLine
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value, name, props) => {
          const total = (props?.payload?.payload?.total ?? data.reduce((a, d) => a + (d.value || 0), 0)) || 1
          return [`${value} (${((value / total) * 100).toFixed(1)}%)`, name]
        }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RePieChart>
    </ResponsiveContainer>
  )
}
