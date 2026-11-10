import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'

export default function Subjects() {
  const [subjects, setSubjects] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/attendance/subjects')
      .then((d) => setSubjects(d.subjects || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading subjects…</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div>
      <h1>Subjects</h1>
      {subjects.length === 0 ? (
        <div className="card">
          <div className="empty">
            No subjects yet. <Link to="/upload">Upload your attendance</Link> to see them here.
          </div>
        </div>
      ) : (
        <div className="grid">
          {subjects.map((s) => {
            const pct = Number(s.percentage ?? 0)
            const barCls = pct >= 75 ? 'green' : pct >= 60 ? 'amber' : 'red'
            return (
              <div className="card" key={s.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{s.subject_name}</strong>
                  <RiskBadge status={s.status} percentage={pct} />
                </div>
                <p className="muted">
                  {s.attended} / {s.total_classes} attended · {s.absent ?? (s.total_classes - s.attended)} absent · {pct.toFixed(1)}%
                </p>
                <div className={`progress ${barCls}`}>
                  <div style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
