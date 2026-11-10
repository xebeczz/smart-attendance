import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import { getToken } from './api.js'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import Subjects from './pages/Subjects.jsx'
import Analytics from './pages/Analytics.jsx'
import Prediction from './pages/Prediction.jsx'
import WhatIf from './pages/WhatIf.jsx'
import Profile from './pages/Profile.jsx'
import Reports from './pages/Reports.jsx'

function RequireAuth({ children }) {
  const location = useLocation()
  if (!getToken()) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function ThemeToggle() {
  const [theme, setTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'light'
  )
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sa_theme', theme)
  }, [theme])
  useEffect(() => {
    const saved = localStorage.getItem('sa_theme')
    if (saved) setTheme(saved)
  }, [])
  return (
    <button
      className="theme-toggle small"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
    </button>
  )
}

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main">
        <div className="page-head">
          <span />
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
      <Route path="/upload" element={<RequireAuth><Layout><Upload /></Layout></RequireAuth>} />
      <Route path="/subjects" element={<RequireAuth><Layout><Subjects /></Layout></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><Layout><Analytics /></Layout></RequireAuth>} />
      <Route path="/prediction" element={<RequireAuth><Layout><Prediction /></Layout></RequireAuth>} />
      <Route path="/what-if" element={<RequireAuth><Layout><WhatIf /></Layout></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Layout><Profile /></Layout></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth><Layout><Reports /></Layout></RequireAuth>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
