import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../api.js'
import {
  IconAnalytics,
  IconClose,
  IconDashboard,
  IconMenu,
  IconPrediction,
  IconProfile,
  IconReports,
  IconSubjects,
  IconUpload,
  IconWhatIf,
  LogoMark
} from './icons.jsx'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/upload', label: 'Upload Attendance', Icon: IconUpload },
  { to: '/subjects', label: 'Subjects', Icon: IconSubjects },
  { to: '/analytics', label: 'Analytics', Icon: IconAnalytics },
  { to: '/prediction', label: 'AI Prediction', Icon: IconPrediction },
  { to: '/what-if', label: 'What-If Planner', Icon: IconWhatIf },
  { to: '/reports', label: 'Reports', Icon: IconReports },
  { to: '/profile', label: 'Profile', Icon: IconProfile }
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
        <div className="brand"><LogoMark /> Smart Attendance</div>
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
        {LINKS.map((l) => (
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
      </nav>
      <div className="side-foot">
        <button className="secondary small" onClick={handleLogout}>Log out</button>
      </div>
    </aside>
  )
}
