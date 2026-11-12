import { useEffect, useState } from 'react'
import { api } from '../api.js'
import StatCard from '../components/StatCard.jsx'
import {
  downloadCSV,
  projectionCSV,
  projectionRows,
  subjectReportCSV
} from '../utils/attendance.js'

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

  const downloadPdf = async () => {
    setError('')
    setDownloading('pdf')
    try {
      await api.download('/reports/export/pdf', 'attendance-report.pdf')
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading('')
    }
  }

  if (loading) return <div className="loading">Loading your report…</div>
  if (error) return <div className="error">{error}</div>
  if (!summary) return <div className="empty">No attendance data yet.</div>

  const subjects = summary.subjects || []
  const required = summary.required_percentage ?? 75
  const total = summary.total_conducted ?? 0
  const attended = summary.total_attended ?? 0

  const downloadSubjectReport = () => {
    downloadCSV('subject-report.csv', subjectReportCSV(subjects, summary))
  }

  const downloadProjectionSummary = () => {
    downloadCSV('projection-summary.csv', projectionCSV(attended, total))
  }

  return (
    <div>
      <h1>Reports</h1>
      <p className="muted">Your overall numbers, plus downloads you can share or keep for your records.</p>

      <div className="stats-grid mt">
        <StatCard label="Overall attendance" value={`${(summary.overall_percentage ?? 0).toFixed(1)}%`} />
        <StatCard label="Total subjects" value={subjects.length} />
        <StatCard label="Classes conducted" value={total} />
        <StatCard label="Attended" value={attended} />
        <StatCard label="Absent" value={summary.total_absent ?? 0} />
      </div>

      <div className="card mt">
        <div className="table-title">Downloads</div>
        <p className="muted">Each file is generated from your current attendance data.</p>
        <div className="report-actions">
          <button type="button" onClick={downloadSubjectReport} disabled={subjects.length === 0}>
            Download subject report (CSV)
          </button>
          <button type="button" onClick={downloadProjectionSummary} disabled={total === 0}>
            Download projection summary (CSV)
          </button>
          <button type="button" className="secondary" onClick={downloadPdf} disabled={total === 0 || downloading !== ''}>
            {downloading === 'pdf' ? 'Downloading…' : 'Download detailed report (PDF)'}
          </button>
        </div>
        <p className="muted">The subject report lists every subject with attended / total, percentage and status. The projection summary lists the three next-20-classes scenarios from the Dashboard.</p>
        {subjects.length === 0 && (
          <div className="empty">No attendance data yet — upload a file or load the sample data from the Dashboard.</div>
        )}
      </div>

      {subjects.length > 0 && (
        <div className="card mt">
          <div className="table-title">Projection: next 20 classes</div>
          <div className="result">
            {projectionRows(attended, total).map((r) => (
              <div className="result-row" key={r.key}>
                <span>{r.label} — {r.sub}</span>
                <strong>{r.value.toFixed(1)}%</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
