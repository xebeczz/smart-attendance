import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'

// Friendly labels + formatting for the raw model features.
function featureRows(features) {
  const pct = (v) => `${Number(v ?? 0).toFixed(1)}%`
  return [
    { label: 'Current attendance', value: pct(features.current_percentage) },
    { label: 'Previous attendance', value: pct(features.previous_percentage) },
    { label: 'Total classes', value: String(features.total_classes ?? 0) },
    { label: 'Classes attended', value: String(features.classes_attended ?? 0) },
    { label: 'Share of classes missed', value: `${(Number(features.absence_frequency ?? 0) * 100).toFixed(1)}%` },
    { label: 'Trend vs previous', value: Number(features.attendance_trend ?? 0) === 0 ? '0.0 (no earlier record yet)' : String(features.attendance_trend) },
    { label: 'Previously at risk', value: features.historical_risk ? 'Yes' : 'No' }
  ]
}

const PRETTY_MODEL = {
  random_forest: 'Random Forest',
  logistic_regression: 'Logistic Regression',
  knn_k5: 'KNN (k=5)'
}
const prettyModel = (m) => PRETTY_MODEL[m?.model || m?.name] || m?.model || m?.name || 'Model'
const asPct = (v) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—')

const PROB_ORDER = [
  { key: 'SAFE', cls: 'green' },
  { key: 'WARNING', cls: 'amber' },
  { key: 'HIGH RISK', cls: 'high' }
]

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

  if (loading) {
    return (
      <div>
        <h1>AI Prediction</h1>
        <div className="card loading-block">
          <div className="spinner" role="status" aria-label="Loading prediction" />
          <div>Running the AI prediction…</div>
          <p className="muted">This usually takes a few seconds.</p>
        </div>
      </div>
    )
  }
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
      ? Object.entries(models).map(([name, m]) => ({ model: name, ...(typeof m === 'object' ? m : { value: m }) }))
      : []
  const bestName = compare?.best_model
  const bestRow = modelRows.find((m) => (m.model || m.name) === bestName)
    || [...modelRows].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0]

  const probs = pred.probabilities && typeof pred.probabilities === 'object' && !Array.isArray(pred.probabilities)
    ? pred.probabilities
    : null

  return (
    <div>
      <h1>AI Prediction</h1>
      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your risk</h3>
          <p><RiskBadge status={pred.risk} /></p>
          <p><strong>Model used:</strong> {pred.model_used ? prettyModel({ model: pred.model_used }) : '—'}</p>
          {probs && (
            <div className="mt">
              <strong>How sure is the model?</strong>
              <div className="mt">
                {PROB_ORDER.map(({ key, cls }) => {
                  const v = Number(probs[key] ?? 0)
                  return (
                    <div className="prob-row" key={key}>
                      <span className="prob-label">{key}</span>
                      <div className="prob-bar">
                        <div className={`progress ${cls}`}>
                          <div style={{ width: `${Math.round(v * 100)}%` }} />
                        </div>
                      </div>
                      <span className="prob-val">{(v * 100).toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {pred.note && (
            <p className="muted">No trained model was available, so this is a simple rule-based estimate from your attendance bands.</p>
          )}
          {pred.recommendation && <p><strong>Recommendation:</strong> {pred.recommendation}</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Features used</h3>
          {pred.features ? (
            <div>
              {featureRows(pred.features).map((r) => (
                <div className="kv-row" key={r.label}>
                  <span className="k">{r.label}</span>
                  <span className="v">{r.value}</span>
                </div>
              ))}
              <p className="muted">Previous attendance matches current because only one upload exists so far — upload again later and the two will differ.</p>
            </div>
          ) : (
            <p className="muted">No feature breakdown returned by the model.</p>
          )}
        </div>
      </div>

      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>Model comparison</h3>
        {modelRows.length === 0 ? (
          <div className="empty">No model comparison data returned.</div>
        ) : (
          <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Model</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1 score</th><th>Confusion matrix</th></tr>
            </thead>
            <tbody>
              {modelRows.map((m, i) => {
                const isBest = bestRow && m === bestRow
                const cm = Array.isArray(m.confusion_matrix) ? m.confusion_matrix.flat() : null
                return (
                  <tr key={i} className={isBest ? 'best' : ''}>
                    <td>
                      {prettyModel(m)}
                      {isBest && <span className="badge safe" style={{ marginLeft: '0.5rem' }}>Best</span>}
                    </td>
                    <td>{asPct(m.accuracy)}</td>
                    <td>{asPct(m.precision)}</td>
                    <td>{asPct(m.recall)}</td>
                    <td>{asPct(m.f1)}</td>
                    <td>
                      {cm ? (
                        <span className="cm" title="Rows: actual SAFE / WARNING / HIGH RISK; columns: predicted">
                          {cm.map((v, j) => (
                            <span key={j} className={j % 4 === 0 ? 'diag' : ''}>{v}</span>
                          ))}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
        <p className="muted">Higher is better on every score. {bestRow ? `${prettyModel(bestRow)} did best, so it is the model used for your prediction.` : ''} The confusion matrix counts correct predictions on the diagonal (green) and mistakes off it.</p>
      </div>
    </div>
  )
}
