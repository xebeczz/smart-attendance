import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { BarChart, PieChart } from '../components/Charts.jsx'

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

  const barData = subjects.map((s) => ({ name: s.subject_name, value: Number(s.percentage ?? 0) }))
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
          <h3 style={{ marginTop: 0 }}>Attendance % by subject</h3>
          <BarChart data={barData} xKey="name" yKey="value" />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Attended vs absent (all subjects)</h3>
          <PieChart data={pieData} />
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
          Trend note: this view is built from your current per-subject totals. Day-by-day trends
          appear once you upload attendance files regularly — each upload updates these totals.
        </p>
      </div>
    </div>
  )
}
