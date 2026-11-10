import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

const TARGETS = [60, 65, 70, 75, 80, 85, 90]

export default function WhatIf() {
  const [target, setTarget] = useState(75)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/attendance/what-if?target=${target}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [target])

  return (
    <div>
      <h1>What-If Planner</h1>
      <p className="muted">Pick a target percentage and see how many classes you must attend — or can afford to miss.</p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <label htmlFor="target">Target attendance %</label>
        <select id="target" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
          {TARGETS.map((t) => <option key={t} value={t}>{t}%</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading">Calculating…</div>
      ) : !data ? (
        <div className="card mt"><div className="empty">No data yet. <Link to="/upload">Upload your attendance</Link> first.</div></div>
      ) : (
        <>
          <div className="grid grid-stats mt">
            <div className="card stat-card"><div className="label">Current overall</div><div className="value">{Number(data.overall_percentage ?? 0).toFixed(1)}%</div></div>
            <div className="card stat-card"><div className="label">Classes conducted</div><div className="value">{data.total_conducted ?? 0}</div></div>
            <div className="card stat-card"><div className="label">Classes to attend (target {data.target ?? target}%)</div><div className="value">{data.classes_to_attend ?? 0}</div></div>
            <div className="card stat-card"><div className="label">Classes you can miss</div><div className="value">{data.classes_can_miss ?? 0}</div></div>
          </div>

          {data.scenarios && data.scenarios.length > 0 && (
            <div className="card mt">
              <h3 style={{ marginTop: 0 }}>All targets at a glance</h3>
              <table>
                <thead><tr><th>Target %</th><th>Classes to attend</th><th>Classes you can miss</th></tr></thead>
                <tbody>
                  {data.scenarios.map((s, i) => (
                    <tr key={i} style={s.target === (data.target ?? target) ? { fontWeight: 'bold' } : {}}>
                      <td>{s.target}%</td>
                      <td>{s.classes_to_attend}</td>
                      <td>{s.classes_can_miss}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
