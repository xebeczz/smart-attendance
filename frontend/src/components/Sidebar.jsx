import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../api.js'

const LINKS = [
  { to: '/dashboard', label: '📊 Dashboard' },
  { to: '/upload', label: '📤 Upload Attendance' },
  { to: '/subjects', label: '📚 Subjects' },
  { to: '/analytics', label: '📈 Analytics' },
  { to: '/prediction', label: '🤖 AI Prediction' },
  { to: '/what-if', label: '🔮 What-If Planner' },
  { to: '/reports', label: '📄 Reports' },
  { to: '/profile', label: '👤 Profile' }
]

export default function Sidebar() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand">✅ Smart Attendance</div>
        <button
          className="menu-btn"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? '✕' : '☰ Menu'}
        </button>
      </div>
      <nav className={open ? 'open' : ''}>
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="side-foot">
        <button className="secondary small" onClick={handleLogout}>Log out</button>
      </div>
    </aside>
  )
}
