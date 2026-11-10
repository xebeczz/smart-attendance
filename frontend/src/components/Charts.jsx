import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

// Shorten long subject names so bar labels fit side by side instead of
// colliding; the full name is still shown in the tooltip.
const shortLabel = (name) => {
  const s = String(name ?? '')
  return s.length > 12 ? `${s.slice(0, 11)}…` : s
}

export function BarChart({ data, xKey = 'name', yKey = 'value', height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11 }}
          tickFormatter={shortLabel}
          angle={-30}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis domain={[0, 100]} width={32} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value, name, props) => [value, props?.payload?.[xKey] ?? name]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey={yKey} fill="#2563eb">
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  )
}

export function PieChart({ data, height = 300 }) {
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
          label={{ fontSize: 11 }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RePieChart>
    </ResponsiveContainer>
  )
}
