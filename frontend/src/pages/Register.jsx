import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setToken } from '../api.js'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', student_id: '', email: '',
    department: '', year: '', section: '', password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/auth/register', form)
      setToken(data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-narrow">
      <h1>Create your account</h1>
      <div className="card">
        <form onSubmit={submit}>
          {error && <div className="error">{error}</div>}
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" value={form.full_name} onChange={set('full_name')} required />
          <label htmlFor="student_id">Student ID</label>
          <input id="student_id" value={form.student_id} onChange={set('student_id')} required />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} required />
          <label htmlFor="department">Department</label>
          <input id="department" value={form.department} onChange={set('department')} placeholder="e.g. AI & Data Science" required />
          <label htmlFor="year">Year</label>
          <input id="year" value={form.year} onChange={set('year')} placeholder="e.g. 3rd Year" required />
          <label htmlFor="section">Section</label>
          <input id="section" value={form.section} onChange={set('section')} placeholder="e.g. A" required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={form.password} onChange={set('password')} required />
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>
      </div>
      <div className="auth-links">
        Already have an account? <Link to="/login">Log in</Link>
      </div>
    </div>
  )
}
