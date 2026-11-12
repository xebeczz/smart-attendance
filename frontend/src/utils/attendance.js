// Shared attendance helpers for the dashboard, planner and reports.
// All numbers come from the real /attendance/summary payload — nothing
// here is invented. Percentages from the backend are rounded to 2dp,
// so a subject at exactly 75% compares equal within a small epsilon.

const EPS = 0.01

// Three-way status used by the dashboard table, chart and planner:
// On track (> 75%), Borderline (exactly 75%), Below 75% (< 75%).
export function statusOf(pct) {
  const p = Number(pct ?? 0)
  if (Math.abs(p - 75) < EPS) return { key: 'borderline', label: 'Borderline', cls: 'borderline' }
  if (p > 75) return { key: 'on-track', label: 'On track', cls: 'ontrack' }
  return { key: 'below', label: 'Below 75%', cls: 'below' }
}

// Bar colour for the dashboard chart and table bars: green on track,
// blue borderline, amber below 75%.
export function chartColor(pct) {
  const s = statusOf(pct)
  if (s.key === 'on-track') return '#22c55e'
  if (s.key === 'borderline') return '#3b82f6'
  return '#f59e0b'
}

// Donut colour follows the risk bands: green >= 75, amber 65-74, red < 65.
export function donutColor(pct) {
  const p = Number(pct ?? 0)
  if (p >= 75) return '#16a34a'
  if (p >= 65) return '#f59e0b'
  return '#dc2626'
}

// Consecutive classes to attend to reach `target` % (0 if already there).
export function classesToAttend(attended, total, target = 75) {
  if (total <= 0) return 1
  if ((attended / total) * 100 >= target) return 0
  return Math.max(0, Math.ceil((target * total - 100 * attended) / (100 - target)))
}

// Consecutive classes that can be missed while staying >= `target` %.
export function classesCanSkip(attended, total, target = 75) {
  if (total <= 0 || (attended / total) * 100 < target) return 0
  return Math.max(0, Math.floor((100 * attended - target * total) / target))
}

// "Action needed" text for one subject, from its real numbers.
export function actionNeeded(subject) {
  const pct = Number(subject.percentage ?? 0)
  const attended = subject.attended ?? 0
  const total = subject.total_classes ?? 0
  if (pct < 75 - EPS) {
    const n = classesToAttend(attended, total, 75)
    return `Attend next ${n} class${n === 1 ? '' : 'es'}`
  }
  if (Math.abs(pct - 75) < EPS) return 'No spare classes'
  const skips = classesCanSkip(attended, total, 75)
  return skips >= 1 ? `Can skip up to ${skips}` : 'No spare classes'
}

// Short label for the bar chart x-axis, e.g. "Data Structures" -> "DS".
const SHORT_LABELS = {
  'Data Structures': 'DS',
  'DBMS': 'DBMS',
  'Machine Learning': 'ML',
  'Operating Systems': 'OS',
  'Probability & Statistics': 'P&S',
  'Python Programming': 'Python',
  'Computer Networks': 'CN',
  'Software Engineering': 'SE',
}

export function shortLabel(name) {
  const n = String(name ?? '').trim()
  if (SHORT_LABELS[n]) return SHORT_LABELS[n]
  const words = n.split(/\s+/).filter((w) => w !== '&')
  if (words.length === 0) return n
  if (words.length === 1) return words[0].slice(0, 6)
  const initials = words.map((w) => w[0].toUpperCase())
  return n.includes('&') ? initials.join('&') : initials.join('')
}

// ---- CSV downloads (client-side, real data) ----

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function subjectReportCSV(subjects, summary) {
  const rows = [['Subject', 'Total Classes', 'Attended', 'Absent', 'Percentage (%)', 'Status', 'Action Needed']]
  ;(subjects || []).forEach((s) => {
    const pct = Number(s.percentage ?? 0)
    rows.push([
      s.subject_name,
      s.total_classes,
      s.attended,
      s.absent ?? (s.total_classes - s.attended),
      pct.toFixed(1),
      statusOf(pct).label,
      actionNeeded(s)
    ])
  })
  rows.push([])
  rows.push(['Overall Percentage (%)', Number(summary?.overall_percentage ?? 0).toFixed(1)])
  rows.push(['Total Classes', summary?.total_conducted ?? 0])
  rows.push(['Attended', summary?.total_attended ?? 0])
  rows.push(['Absent', summary?.total_absent ?? 0])
  return toCSV(rows)
}

// The three "next 20 classes" scenarios, from the real totals.
export function projectionRows(attended, total) {
  const current = total > 0 ? (attended / total) * 100 : 0
  const scenarios = [
    { key: 'all', label: 'Attend all 20', attend: 20 },
    { key: 'miss5', label: 'Miss 5 of 20', attend: 15 },
    { key: 'miss10', label: 'Miss 10 of 20', attend: 10 }
  ]
  return scenarios.map((s) => {
    const value = total + 20 > 0 ? ((attended + s.attend) / (total + 20)) * 100 : 0
    const tone = value >= 75 ? 'green' : value >= current ? 'amber' : 'red'
    const sub = value >= 75
      ? 'Back above the requirement'
      : value >= current
        ? 'Still short of 75%'
        : 'Falls further behind'
    return { ...s, value, tone, sub }
  })
}

export function projectionCSV(attended, total) {
  const rows = [['Scenario', 'Attended after 20 classes', 'Total after 20 classes', 'Projected attendance (%)', 'Outcome']]
  projectionRows(attended, total).forEach((r) => {
    rows.push([r.label, attended + r.attend, total + 20, r.value.toFixed(1), r.sub])
  })
  return toCSV(rows)
}

export function downloadCSV(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
