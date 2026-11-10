import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const data = await api.post('/auth/forgot-password', { email })
      setMessage(data.message || 'If that email exists, a reset link has been sent.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-narrow">
      <h1>Forgot password</h1>
      <div className="card">
        <form onSubmit={submit}>
          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      </div>
      <div className="auth-links">
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  )
}
