import { useEffect, useState } from 'react'
import { api } from '../api.js'
import StatCard from '../components/StatCard.jsx'
import { classesToAttend, statusOf } from '../utils/attendance.js'

function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(v, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export default function WhatIf() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState('overall')
  const [subjectId, setSubjectId] = useState('')
  const [upcoming, setUpcoming] = useState(20)
  const [attend, setAttend] = useState(20)

  useEffect(() => {
    api.get('/attendance/summary')
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading your attendance…</div>
  if (error) return <div className="error">{error}</div>
  if (!summary) return <div className="empty">No attendance data yet.</div>

  const subjects = summary.subjects || []
  const required = summary.required_percentage ?? 75
  const total = summary.total_conducted ?? 0
  const attended = summary.total_attended ?? 0

  const selected = subjects.find((s) => String(s.id) === subjectId) || null
  const baseAttended = mode === 'subject' && selected ? selected.attended : attended
  const baseTotal = mode === 'subject' && selected ? selected.total_classes : total

  const upcomingClamped = clampInt(upcoming, 0, 500, 20)
  const attendClamped = clampInt(attend, 0, upcomingClamped, upcomingClamped)
  const projected = baseTotal + upcomingClamped > 0
    ? ((baseAttended + attendClamped) / (baseTotal + upcomingClamped)) * 100
    : 0
  const reaches = projected >= required
  const stillNeeded = reaches ? 0 : classesToAttend(baseAttended + attendClamped, baseTotal + upcomingClamped, required)
  const st = statusOf(projected)
  const title = mode === 'subject' && selected ? selected.subject_name : 'Overall attendance'

  return (
    <div>
      <h1>What-If Planner</h1>
      <p className="muted">See how your attendance changes if you attend some, or all, of the upcoming classes. Every number here comes from your real totals.</p>

      {subjects.length === 0 ? (
        <div className="card mt">
          <div className="empty">No attendance data yet. Upload a file or load the sample data from the Dashboard to try the planner.</div>
        </div>
      ) : (
        <>
          <div className="stats-grid mt">
            <StatCard label="Current overall attendance" value={`${(summary.overall_percentage ?? 0).toFixed(1)}%`} />
            <StatCard label="Required attendance" value={`${required}%`} />
            <StatCard label="Classes attended / conducted" value={`${attended} / ${total}`} />
          </div>

          <div className="card mt">
            <div className="mode-toggle" role="tablist" aria-label="Planner mode">
              <button type="button" className={mode === 'overall' ? 'active' : ''} onClick={() => setMode('overall')}>Overall</button>
              <button type="button" className={mode === 'subject' ? 'active' : ''} onClick={() => setMode('subject')}>Per subject</button>
            </div>

            {mode === 'subject' && (
              <div className="form" style={{ maxWidth: 420 }}>
                <label>
                  Subject
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="">Select a subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name} — {Number(s.percentage ?? 0).toFixed(1)}%
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="form" style={{ maxWidth: 420, marginTop: '1rem' }}>
              <label>
                Upcoming classes
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={upcoming}
                  onChange={(e) => setUpcoming(e.target.value)}
                />
              </label>
              <label>
                Classes you will attend
                <input
                  type="number"
                  min="0"
                  max={upcomingClamped}
                  value={attend}
                  onChange={(e) => setAttend(e.target.value)}
                />
              </label>
              <p className="muted">You cannot attend more classes than are coming up.</p>
            </div>

            {mode === 'subject' && !selected ? (
              <div className="empty">Pick a subject above to see its projection.</div>
            ) : (
              <div className="result mt">
                <div className="result-row">
                  <span>Projected {title.toLowerCase()}</span>
                  <strong className={`status ${st.cls}`}>{projected.toFixed(1)}%</strong>
                </div>
                <div className="result-row">
                  <span>Required</span>
                  <strong>{required}%</strong>
                </div>
                <div className="result-row">
                  <span>After these classes</span>
                  <strong>{baseAttended + attendClamped} / {baseTotal + upcomingClamped} attended</strong>
                </div>
                {reaches ? (
                  <div className="result-ok">This plan gets you to {required}% — on track.</div>
                ) : (
                  <div className="result-warn">
                    Still short of {required}%. Attend {stillNeeded} more class{stillNeeded === 1 ? '' : 'es'} in a row after this to reach {required}%.
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
