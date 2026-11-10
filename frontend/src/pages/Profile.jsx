import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Profile() {
  const [me, setMe] = useState(null)
  const [form, setForm] = useState({ full_name: '', department: '', year: '', section: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/auth/me')
      .then((d) => {
        setMe(d)
        setForm({
          full_name: d.full_name || '',
          department: d.department || '',
          year: d.year || '',
          section: d.section || ''
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setMessage(''); setSaving(true)
    try {
      const updated = await api.put('/auth/me', form)
      setMe(updated)
      setMessage('Profile updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Loading profile…</div>
  if (error) return <div className="error">{error}</div>
  if (!me) return <div className="empty">No profile data.</div>

  return (
    <div>
      <h1>Profile</h1>
      {message && <div className="success">{message}</div>}
      <div className="card">
        <p><strong>Name:</strong> {me.full_name}</p>
        <p><strong>Student ID:</strong> {me.student_id}</p>
        <p><strong>Email:</strong> {me.email}</p>
        <p><strong>Department:</strong> {me.department}</p>
        <p><strong>Year:</strong> {me.year}</p>
        <p><strong>Section:</strong> {me.section}</p>
      </div>
      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>Edit profile</h3>
        <form onSubmit={submit}>
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          <label htmlFor="department">Department</label>
          <input id="department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />
          <label htmlFor="year">Year</label>
          <input id="year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
          <label htmlFor="section">Section</label>
          <input id="section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} required />
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>
    </div>
  )
}
