import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setToken } from '../api.js'
import { LogoMark } from '../components/icons.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/auth/login', { email, password })
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
      <h1><LogoMark /> Smart Attendance</h1>
      <p className="muted" style={{ textAlign: 'center' }}>Log in to check your attendance risk.</p>
      <div className="card">
        <form onSubmit={submit}>
          {error && <div className="error">{error}</div>}
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
      <div className="auth-links">
        <Link to="/forgot-password">Forgot password?</Link>
        {' · '}
        <Link to="/register">Create an account</Link>
      </div>
    </div>
  )
}
