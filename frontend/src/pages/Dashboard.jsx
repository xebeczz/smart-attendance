import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import StatCard from '../components/StatCard.jsx'
import RiskBadge, { riskClass } from '../components/RiskBadge.jsx'
import { BarChart } from '../components/Charts.jsx'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sampleLoading, setSampleLoading] = useState(false)

  useEffect(() => {
    api.get('/attendance/summary')
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const loadSample = async () => {
    setError('')
    setSampleLoading(true)
    try {
      await api.post('/attendance/sample')
      setSummary(await api.get('/attendance/summary'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSampleLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading your attendance…</div>
  if (error) return <div className="error">{error}</div>
  if (!summary) return <div className="empty">No attendance data yet.</div>

  const subjects = summary.subjects || []
  const pct = summary.overall_percentage ?? 0
  const required = summary.required_percentage ?? 75
  const barCls = pct >= required ? 'green' : pct >= 65 ? 'amber' : 'red'

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <RiskBadge status={summary.risk_status} percentage={pct} />
      </div>

      <div className="grid grid-stats">
        <StatCard label="Total subjects" value={summary.total_subjects ?? subjects.length} />
        <StatCard label="Overall attendance" value={`${Number(pct).toFixed(1)}%`} sub={`Required: ${required}%`} />
        <StatCard label="Classes conducted" value={summary.total_conducted ?? 0} />
        <StatCard label="Attended" value={summary.total_attended ?? 0} />
        <StatCard label="Absent" value={summary.total_absent ?? 0} />
        <StatCard label="Risk status" value={summary.risk_status || riskClass(null, pct)} />
      </div>

      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>Overall progress — {Number(pct).toFixed(1)}% of {required}% required</h3>
        <div className={`progress ${barCls}`}>
          <div style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="card mt">
          <div className="empty">
            No subjects yet. <Link to="/upload">Upload your attendance file</Link> or add subjects manually to get started.
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <button onClick={loadSample} disabled={sampleLoading}>
              {sampleLoading ? 'Loading…' : 'Load sample data'}
            </button>
            <p className="muted">Adds 8 sample subjects (Maths, Physics, Python…) so you can see the dashboard, charts and prediction in action.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card mt">
            <h3 style={{ marginTop: 0 }}>Attendance by subject</h3>
            <BarChart
              data={subjects.map((s) => ({ name: s.subject_name, value: Number(s.percentage ?? 0) }))}
              xKey="name"
              yKey="value"
            />
          </div>

          <div className="card mt">
            <h3 style={{ marginTop: 0 }}>Recent subjects</h3>
            <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Subject</th><th>Conducted</th><th>Attended</th><th>Absent</th><th>%</th><th>Status</th></tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td>{s.subject_name}</td>
                    <td>{s.total_classes}</td>
                    <td>{s.attended}</td>
                    <td>{s.absent}</td>
                    <td>{Number(s.percentage ?? 0).toFixed(1)}%</td>
                    <td><RiskBadge status={s.status} percentage={s.percentage} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="mt"><Link to="/subjects">View all subjects →</Link></div>
          </div>
        </>
      )}
    </div>
  )
}
