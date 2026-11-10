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
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  return (
    <aside className="sidebar">
      <div className="brand">✅ Smart Attendance</div>
      <nav>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
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
