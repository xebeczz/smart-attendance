import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import RiskBadge from '../components/RiskBadge.jsx'

export default function Subjects() {
  const [subjects, setSubjects] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [manual, setManual] = useState({ subject_name: '', total_classes: '', attended: '' })
  const [editing, setEditing] = useState(null) // {id, subject_name, total_classes, attended}
  const [confirming, setConfirming] = useState(null) // {id, name} awaiting delete confirmation

  const loadSubjects = () => {
    setLoading(true)
    api.get('/attendance/subjects')
      .then((d) => setSubjects(d.subjects || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }
  useEffect(loadSubjects, [])

  const addManual = async (e) => {
    e.preventDefault()
    setError(''); setMessage('')
    try {
      await api.post('/attendance/manual', {
        subject_name: manual.subject_name,
        total_classes: Number(manual.total_classes),
        attended: Number(manual.attended)
      })
      setMessage(`Added ${manual.subject_name}.`)
      setManual({ subject_name: '', total_classes: '', attended: '' })
      loadSubjects()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveEdit = async () => {
    setError(''); setMessage('')
    try {
      await api.put(`/attendance/subjects/${editing.id}`, {
        subject_name: editing.subject_name,
        total_classes: Number(editing.total_classes),
        attended: Number(editing.attended)
      })
      setMessage('Subject updated.')
      setEditing(null)
      loadSubjects()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteSubject = async (id, name) => {
    setError(''); setMessage('')
    try {
      await api.del(`/attendance/subjects/${id}`)
      setMessage(`Deleted ${name}.`)
      setConfirming(null)
      loadSubjects()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="loading">Loading subjects…</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div>
      <h1>Subjects</h1>
      {message && <div className="success">{message}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add a subject</h3>
        <form onSubmit={addManual}>
          <div className="grid grid-2">
            <div>
              <label htmlFor="s-subject">Subject name</label>
              <input id="s-subject" value={manual.subject_name} onChange={(e) => setManual({ ...manual, subject_name: e.target.value })} placeholder="e.g. Mathematics" required />
            </div>
            <div>
              <label htmlFor="s-total">Total classes conducted</label>
              <input id="s-total" type="number" min="0" value={manual.total_classes} onChange={(e) => setManual({ ...manual, total_classes: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="s-attended">Classes attended</label>
              <input id="s-attended" type="number" min="0" value={manual.attended} onChange={(e) => setManual({ ...manual, attended: e.target.value })} required />
            </div>
          </div>
          <button type="submit">Add subject</button>
        </form>
      </div>

      {subjects.length === 0 ? (
        <div className="card mt">
          <div className="empty">
            No subjects yet. <Link to="/upload">Upload your attendance</Link> to see them here, or add one above.
          </div>
        </div>
      ) : (
        <div className="grid mt">
          {subjects.map((s) => {
            const pct = Number(s.percentage ?? 0)
            const barCls = pct >= 75 ? 'green' : pct >= 60 ? 'amber' : 'red'
            const isEditing = editing && editing.id === s.id
            return (
              <div className="card" key={s.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  {isEditing ? (
                    <input
                      value={editing.subject_name}
                      onChange={(e) => setEditing({ ...editing, subject_name: e.target.value })}
                      aria-label="Subject name"
                    />
                  ) : (
                    <strong>{s.subject_name}</strong>
                  )}
                  <RiskBadge status={s.status} percentage={pct} />
                </div>
                {isEditing ? (
                  <>
                    <div className="row">
                      <label>
                        Total classes
                        <input type="number" value={editing.total_classes} onChange={(e) => setEditing({ ...editing, total_classes: e.target.value })} />
                      </label>
                      <label>
                        Attended
                        <input type="number" value={editing.attended} onChange={(e) => setEditing({ ...editing, attended: e.target.value })} />
                      </label>
                    </div>
                    <div className="row">
                      <button className="small" onClick={saveEdit}>Save</button>
                      <button className="small secondary" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="subject-pct">{pct.toFixed(1)}%</div>
                    <p className="subject-sub">
                      {s.attended} / {s.total_classes} attended · {s.absent ?? (s.total_classes - s.attended)} absent
                    </p>
                    <div className="progress-wrap has-marker">
                      <span className="progress-marker-label" style={{ left: '75%' }}>75%</span>
                      <span className="progress-marker" style={{ left: '75%' }} />
                      <div className={`progress ${barCls}`}>
                        <div style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                    <div className="row mt">
                      <button className="small secondary" onClick={() => setEditing({ id: s.id, subject_name: s.subject_name, total_classes: s.total_classes, attended: s.attended })}>Edit</button>
                      <button className="small danger" onClick={() => setConfirming({ id: s.id, name: s.subject_name })}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={`Delete ${confirming.name}?`}
          message="This removes the subject and its attendance record. This can't be undone."
          onConfirm={() => deleteSubject(confirming.id, confirming.name)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
