import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { api, logout } from '../api.js'
import {
  IconAnalytics,
  IconClose,
  IconDashboard,
  IconMenu,
  IconPrediction,
  IconReports,
  IconSubjects,
  IconUpload,
  IconWhatIf,
  LogoMark
} from './icons.jsx'

const SECTIONS = [
  {
    label: 'OVERVIEW',
    links: [
      { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
      { to: '/upload', label: 'Upload Attendance', Icon: IconUpload },
      { to: '/subjects', label: 'Subjects', Icon: IconSubjects }
    ]
  },
  {
    label: 'INSIGHTS',
    links: [
      { to: '/analytics', label: 'Analytics', Icon: IconAnalytics },
      { to: '/prediction', label: 'AI Prediction', Icon: IconPrediction },
      { to: '/planner', label: 'What-If Planner', Icon: IconWhatIf },
      { to: '/reports', label: 'Reports', Icon: IconReports }
    ]
  }
]

export default function Sidebar() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState(null)

  useEffect(() => {
    api.get('/auth/me').then(setMe).catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const name = me?.full_name || 'Student'
  const sub = me?.department ? `B.Tech ${me.department}` : ''

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand"><LogoMark size={40} /> <span>Smart<br />Attendance</span></div>
        <button
          className="menu-btn"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <IconClose size={18} /> : <IconMenu size={18} />}
          <span>{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>
      <nav className={open ? 'open' : ''}>
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <l.Icon size={18} />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <Link to="/profile" className="user-card" onClick={() => setOpen(false)}>
          <div className="avatar">{name.charAt(0).toUpperCase()}</div>
          <div className="user-meta">
            <div className="user-name">{name}</div>
            {sub && <div className="user-sub">{sub}</div>}
          </div>
        </Link>
        <button className="logout-btn" onClick={handleLogout}>Log out</button>
      </div>
    </aside>
  )
}
