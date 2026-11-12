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
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value })
    if (fieldErrors[k]) setFieldErrors({ ...fieldErrors, [k]: '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    // Year must be a whole number 1-6 (the server rejects anything else,
    // e.g. "3rd Year"). Catch it here with a clear message under the field
    // instead of failing with a cryptic server error.
    const yearNum = Number(form.year)
    if (!form.year || !Number.isInteger(yearNum) || yearNum < 1 || yearNum > 6) {
      setFieldErrors({ year: 'Enter your year as a number from 1 to 6 (e.g. 3).' })
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      const data = await api.post('/auth/register', { ...form, year: yearNum })
      setToken(data.access_token)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.message || ''
      // Surface a server-side year validation error under the field too.
      if (/year/i.test(msg)) {
        setFieldErrors({ year: 'Enter your year as a number from 1 to 6 (e.g. 3).' })
      } else {
        setError(msg)
      }
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
          <input
            id="year"
            type="text"
            inputMode="numeric"
            value={form.year}
            onChange={set('year')}
            placeholder="e.g. 3"
            required
          />
          {fieldErrors.year && <div className="field-error">{fieldErrors.year}</div>}
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
