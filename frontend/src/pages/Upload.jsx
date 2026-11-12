import { useEffect, useState } from 'react'
import { api } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sampleLoading, setSampleLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [manual, setManual] = useState({ subject_name: '', total_classes: '', attended: '' })
  const [editing, setEditing] = useState(null) // {id, subject_name, total_classes, attended}

  const loadSubjects = () => {
    setListLoading(true)
    api.get('/attendance/subjects')
      .then((d) => setSubjects(d.subjects || []))
      .catch((err) => setError(err.message))
      .finally(() => setListLoading(false))
  }
  useEffect(loadSubjects, [])

  const uploadFile = async (e) => {
    e.preventDefault()
    if (!file) { setError('Choose a CSV or XLSX file first.'); return }
    setError(''); setMessage(''); setResult(null); setLoading(true)
    try {
      const data = await api.upload('/attendance/upload', file)
      setResult(data)
      setMessage(`Upload complete: ${data.saved ?? 0} saved, ${data.updated ?? 0} updated, ${data.skipped ?? 0} skipped.`)
      loadSubjects()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const pickFile = (f) => {
    if (!f) return
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Only .csv and .xlsx files are accepted.')
      return
    }
    setError('')
    setFile(f)
  }

  const downloadTemplate = async () => {
    setError('')
    try {
      await api.download('/attendance/template', 'sample_attendance.csv')
    } catch (err) {
      setError(err.message)
    }
  }

  const loadSample = async () => {
    setError(''); setMessage('')
    setSampleLoading(true)
    try {
      const data = await api.post('/attendance/sample')
      setMessage(`Sample data loaded: ${data.saved ?? 0} new subjects added.`)
      loadSubjects()
    } catch (err) {
      setError(err.message)
    } finally {
      setSampleLoading(false)
    }
  }

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

  const saveEdit = async (e) => {
    e.preventDefault()
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
    if (!window.confirm(`Delete ${name}?`)) return
    setError(''); setMessage('')
    try {
      await api.del(`/attendance/subjects/${id}`)
      setMessage(`Deleted ${name}.`)
      loadSubjects()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1>Upload Attendance</h1>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Upload a file</h3>
          <p className="muted">CSV or XLSX with columns: subject_name, total_classes, attended.</p>
          <form onSubmit={uploadFile}>
            <div
              className={`dropzone${dragging ? ' dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => pickFile(e.target.files[0] || null)}
              />
              <div>Drop your CSV or XLSX file here, or click to choose one</div>
              {file ? (
                <div className="file-name">{file.name}</div>
              ) : (
                <div className="muted">Columns: subject_name, total_classes, attended</div>
              )}
            </div>
            <div className="row mt">
              <button type="submit" disabled={loading}>
                {loading ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" className="secondary" onClick={downloadTemplate}>
                Download sample CSV
              </button>
            </div>
          </form>
          {result && (
            <div className="mt">
              <p><strong>Saved:</strong> {result.saved ?? 0} · <strong>Updated:</strong> {result.updated ?? 0} · <strong>Skipped:</strong> {result.skipped ?? 0}</p>
              {result.errors && result.errors.length > 0 && (
                <div className="error">
                  <strong>Errors:</strong>
                  <ul>{result.errors.map((e, i) => <li key={i}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>)}</ul>
                </div>
              )}
              {result.preview && result.preview.length > 0 && (
                <div className="table-wrap">
                <table>
                  <thead><tr><th>Subject</th><th>Conducted</th><th>Attended</th></tr></thead>
                  <tbody>
                    {result.preview.map((r, i) => (
                      <tr key={i}>
                        <td>{r.subject_name}</td><td>{r.total_classes}</td><td>{r.attended}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add one subject manually</h3>
          <form onSubmit={addManual}>
            <label htmlFor="m-subject">Subject name</label>
            <input id="m-subject" value={manual.subject_name} onChange={(e) => setManual({ ...manual, subject_name: e.target.value })} required />
            <label htmlFor="m-total">Total classes conducted</label>
            <input id="m-total" type="number" min="0" value={manual.total_classes} onChange={(e) => setManual({ ...manual, total_classes: e.target.value })} required />
            <label htmlFor="m-attended">Classes attended</label>
            <input id="m-attended" type="number" min="0" value={manual.attended} onChange={(e) => setManual({ ...manual, attended: e.target.value })} required />
            <button type="submit">Add subject</button>
          </form>
        </div>
      </div>

      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>Your subjects</h3>
        {listLoading ? (
          <div className="loading">Loading subjects…</div>
        ) : subjects.length === 0 ? (
          <div className="empty">
            No subjects yet — upload a file or add one manually above.
            <div className="mt">
              <button onClick={loadSample} disabled={sampleLoading}>
                {sampleLoading ? 'Loading…' : 'Load sample data'}
              </button>
              <p className="muted">Adds the same 8 sample subjects used in the demo file.</p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>Conducted</th><th>Attended</th><th>%</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  {editing && editing.id === s.id ? (
                    <>
                      <td><input value={editing.subject_name} onChange={(e) => setEditing({ ...editing, subject_name: e.target.value })} /></td>
                      <td><input type="number" value={editing.total_classes} onChange={(e) => setEditing({ ...editing, total_classes: e.target.value })} /></td>
                      <td><input type="number" value={editing.attended} onChange={(e) => setEditing({ ...editing, attended: e.target.value })} /></td>
                      <td colSpan="2">—</td>
                      <td>
                        <button className="small" onClick={saveEdit}>Save</button>{' '}
                        <button className="small secondary" onClick={() => setEditing(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{s.subject_name}</td>
                      <td>{s.total_classes}</td>
                      <td>{s.attended}</td>
                      <td>{Number(s.percentage ?? 0).toFixed(1)}%</td>
                      <td><RiskBadge status={s.status} percentage={s.percentage} /></td>
                      <td>
                        <button className="small secondary" onClick={() => setEditing({ id: s.id, subject_name: s.subject_name, total_classes: s.total_classes, attended: s.attended })}>Edit</button>{' '}
                        <button className="small danger" onClick={() => deleteSubject(s.id, s.subject_name)}>Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
