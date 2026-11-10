import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import StatCard from '../components/StatCard.jsx'
import RiskBadge from '../components/RiskBadge.jsx'

export default function Reports() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState('')

  useEffect(() => {
    api.get('/attendance/summary')
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const download = async (kind) => {
    setError('')
    setDownloading(kind)
    try {
      if (kind === 'csv') await api.download('/reports/export/csv', 'attendance-report.csv')
      else await api.download('/reports/export/pdf', 'attendance-report.pdf')
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading('')
    }
  }

  if (loading) return <div className="loading">Loading report…</div>
  if (error) return <div className="error">{error}</div>

  const subjects = summary?.subjects || []

  return (
    <div>
      <h1>Reports</h1>
      {subjects.length === 0 ? (
        <div className="card"><div className="empty">No attendance data yet. <Link to="/upload">Upload your attendance</Link> to generate a report.</div></div>
      ) : (
        <>
          <div className="grid grid-stats">
            <StatCard label="Overall attendance" value={`${Number(summary.overall_percentage ?? 0).toFixed(1)}%`} />
            <StatCard label="Total subjects" value={summary.total_subjects ?? subjects.length} />
            <StatCard label="Conducted" value={summary.total_conducted ?? 0} />
            <StatCard label="Attended" value={summary.total_attended ?? 0} />
            <StatCard label="Absent" value={summary.total_absent ?? 0} />
          </div>
          <div className="card mt">
            <h3 style={{ marginTop: 0 }}>Risk status</h3>
            <RiskBadge status={summary.risk_status} percentage={summary.overall_percentage} />
          </div>
          <div className="card mt">
            <h3 style={{ marginTop: 0 }}>Subject breakdown</h3>
            <table>
              <thead><tr><th>Subject</th><th>Conducted</th><th>Attended</th><th>Absent</th><th>%</th></tr></thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td>{s.subject_name}</td>
                    <td>{s.total_classes}</td>
                    <td>{s.attended}</td>
                    <td>{s.absent}</td>
                    <td>{Number(s.percentage ?? 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>Download report</h3>
        <div className="row">
          <button onClick={() => download('csv')} disabled={downloading !== ''}>
            {downloading === 'csv' ? 'Downloading…' : '⬇ Download CSV'}
          </button>
          <button onClick={() => download('pdf')} disabled={downloading !== ''}>
            {downloading === 'pdf' ? 'Downloading…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
