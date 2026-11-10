import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'

export default function Prediction() {
  const [pred, setPred] = useState(null)
  const [compare, setCompare] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/ml/predict'), api.get('/ml/compare')])
      .then(([p, c]) => { setPred(p); setCompare(c) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Running the AI prediction…</div>
  if (error) return <div className="error">{error}</div>
  if (!pred) {
    return (
      <div>
        <h1>AI Prediction</h1>
        <div className="card"><div className="empty">No prediction available yet. <Link to="/upload">Upload your attendance</Link> first.</div></div>
      </div>
    )
  }

  const models = compare?.models
  const modelRows = Array.isArray(models)
    ? models
    : models && typeof models === 'object'
      ? Object.entries(models).map(([name, m]) => ({ name, ...(typeof m === 'object' ? m : { value: m }) }))
      : []

  return (
    <div>
      <h1>AI Prediction</h1>
      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your risk</h3>
          <p><RiskBadge status={pred.risk} /></p>
          <p><strong>Model used:</strong> {pred.model_used || '—'}</p>
          {pred.probabilities && (
            <p>
              <strong>Probabilities:</strong>{' '}
              {Array.isArray(pred.probabilities)
                ? pred.probabilities.map((v, i) => `${['SAFE', 'WARNING', 'HIGH RISK'][i] || i}: ${typeof v === 'number' ? v.toFixed(3) : v}`).join(' · ')
                : Object.entries(pred.probabilities).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`).join(' · ')}
            </p>
          )}
          {pred.note && <p className="muted">{pred.note}</p>}
          {pred.recommendation && <p><strong>Recommendation:</strong> {pred.recommendation}</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Features used</h3>
          {pred.features ? (
            <div className="table-wrap">
            <table>
              <tbody>
                {Object.entries(pred.features).map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td>{typeof v === 'number' ? v.toFixed(3) : String(v)}</td></tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p className="muted">No feature breakdown returned by the model.</p>
          )}
        </div>
      </div>

      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>Model comparison</h3>
        {compare?.note && <p className="muted">{compare.note}</p>}
        {modelRows.length === 0 ? (
          <div className="empty">No model comparison data returned.</div>
        ) : (
          <div className="table-wrap">
          <table>
            <thead><tr><th>Model</th><th>Details</th></tr></thead>
            <tbody>
              {modelRows.map((m, i) => (
                <tr key={i}>
                  <td>{m.name || m.model || `Model ${i + 1}`}</td>
                  <td>
                    {Object.entries(m)
                      .filter(([k]) => k !== 'name' && k !== 'model')
                      .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : String(v)}`)
                      .join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <p className="muted">Models are trained on the synthetic dataset in ml/ — see the ML honesty note in the README. No accuracy is claimed here beyond what ml/evaluation.json reports.</p>
      </div>
    </div>
  )
}
