import { useEffect, useState } from 'react'
import { IconMoon, IconSun } from './icons.jsx'

export default function ThemeToggle() {
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
      {theme === 'light' ? (<><IconMoon size={15} /> Dark</>) : (<><IconSun size={15} /> Light</>)}
    </button>
  )
}
