import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { BarChart, PieChart } from '../components/Charts.jsx'

// Consecutive classes to attend to reach 75% for one subject.
function classesToAttend(attended, total, target = 75) {
  if (total <= 0) return 0
  const pct = (attended / total) * 100
  if (pct >= target) return 0
  return Math.max(0, Math.ceil((target * total - 100 * attended) / (100 - target)))
}

export default function Analytics() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/attendance/summary')
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading analytics…</div>
  if (error) return <div className="error">{error}</div>

  const subjects = summary?.subjects || []
  if (subjects.length === 0) {
    return (
      <div>
        <h1>Analytics</h1>
        <div className="card"><div className="empty">No attendance data yet. <Link to="/upload">Upload your attendance</Link> to see charts here.</div></div>
      </div>
    )
  }

  const catchUpData = subjects.map((s) => ({
    name: s.subject_name,
    value: classesToAttend(s.attended ?? 0, s.total_classes ?? 0)
  }))
  const pieData = [
    { name: 'Attended', value: summary.total_attended ?? 0 },
    { name: 'Absent', value: summary.total_absent ?? 0 }
  ]
  const weakest = [...subjects].sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0))[0]
  const strongest = [...subjects].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0]

  return (
    <div>
      <h1>Analytics</h1>
      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Classes to attend to reach 75%</h3>
          <BarChart data={catchUpData} xKey="name" yKey="value" unit=" classes" yDomain={[0, 'auto']} />
          <p className="muted">How many classes in a row to attend, per subject, to get back to 75%. Subjects already at 75% or above show 0.</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Attended vs absent (all subjects)</h3>
          <PieChart data={pieData} colors={['#16a34a', '#dc2626']} />
        </div>
      </div>
      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>What the numbers say</h3>
        <p>
          Overall attendance is <strong>{Number(summary.overall_percentage ?? 0).toFixed(1)}%</strong> across{' '}
          {summary.total_conducted ?? 0} conducted classes.
        </p>
        <p>
          Strongest subject: <strong>{strongest.subject_name}</strong> ({Number(strongest.percentage ?? 0).toFixed(1)}%).
          Weakest subject: <strong>{weakest.subject_name}</strong> ({Number(weakest.percentage ?? 0).toFixed(1)}%) —{' '}
          attending the next classes in this subject moves your overall percentage fastest.
        </p>
        <p className="muted">
          These numbers come from your uploaded totals. Upload your attendance again after more classes and they update from the new file.
        </p>
      </div>
    </div>
  )
}
