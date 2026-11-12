import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'
import { BarChart } from '../components/Charts.jsx'
import DonutChart from '../components/DonutChart.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { IconBell, IconCalendar, IconCheck, IconSearch, IconSubjects, IconX } from '../components/icons.jsx'
import {
  actionNeeded,
  chartColor,
  classesToAttend,
  donutColor,
  downloadCSV,
  projectionRows,
  shortLabel,
  statusOf,
  subjectReportCSV
} from '../utils/attendance.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sampleLoading, setSampleLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [showBell, setShowBell] = useState(false)
  const tableRef = useRef(null)

  useEffect(() => {
    api.get('/attendance/summary')
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const loadSample = async () => {
    setError('')
    setSampleLoading(true)
    try {
      await api.post('/attendance/sample')
      setSummary(await api.get('/attendance/summary'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSampleLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading your attendance…</div>
  if (error) return <div className="error">{error}</div>
  if (!summary) return <div className="empty">No attendance data yet.</div>

  const subjects = summary.subjects || []
  const hasData = (summary.total_conducted ?? 0) > 0
  const pct = summary.overall_percentage ?? 0
  const required = summary.required_percentage ?? 75
  const total = summary.total_conducted ?? 0
  const attended = summary.total_attended ?? 0
  const absent = summary.total_absent ?? 0
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const belowCount = subjects.filter((s) => statusOf(Number(s.percentage ?? 0)).key === 'below').length
  const atOrAbove = subjects.length - subjects.filter((s) => statusOf(Number(s.percentage ?? 0)).key === 'below').length
  const toAttend = classesToAttend(attended, total, required)

  const filtered = subjects
    .filter((s) => s.subject_name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((s) => !showLowOnly || statusOf(Number(s.percentage ?? 0)).key === 'below')

  const viewLowSubjects = () => {
    setShowLowOnly(true)
    setQuery('')
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const exportReport = () => {
    downloadCSV('subject-report.csv', subjectReportCSV(subjects, summary))
  }

  return (
    <div>
      <div className="dash-header">
        <div>
          <div className="dash-title-row">
            <h1>Dashboard</h1>
            {hasData ? (
              <RiskBadge status={summary.risk_status} percentage={pct} />
            ) : (
              <span className="badge neutral">No data yet</span>
            )}
          </div>
          <div className="dash-subtitle">Academic year 2026–27 · Last updated {today}</div>
        </div>
        <div className="dash-actions">
          <label className="dash-search">
            <IconSearch size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects"
              aria-label="Search subjects"
            />
          </label>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" type="button" aria-label="Notifications" onClick={() => setShowBell(!showBell)}>
              <IconBell size={18} />
            </button>
            {showBell && (
              <>
                <div className="bell-backdrop" onClick={() => setShowBell(false)} />
                <div className="bell-pop">No new notifications</div>
              </>
            )}
          </div>
          <ThemeToggle />
        </div>
      </div>

      {hasData && pct < required && (
        <div className="banner amber">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          <div className="banner-text">
            <div className="banner-title">
              Overall attendance is {(required - pct).toFixed(1)}% below the {required}% requirement
            </div>
            <div className="banner-sub">
              Attend the next {toAttend} class{toAttend === 1 ? '' : 'es'} in a row to get back above {required}%. {belowCount} subject{belowCount === 1 ? ' is' : 's are'} currently below the limit.
            </div>
          </div>
          <button type="button" onClick={() => navigate('/planner')}>Open What-If Planner</button>
          <button type="button" className="secondary" onClick={viewLowSubjects}>View low subjects</button>
        </div>
      )}
      {hasData && pct >= required && (
        <div className="banner green">
          <span style={{ color: 'var(--green)', display: 'inline-flex' }}><IconCheck size={26} /></span>
          <div className="banner-text">
            <div className="banner-title">
              Overall attendance is above the {required}% requirement — keep it up!
            </div>
          </div>
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="card mt">
          <div className="empty">
            No subjects yet. <Link to="/upload">Upload your attendance file</Link> or add subjects manually to get started.
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <button onClick={loadSample} disabled={sampleLoading}>
              {sampleLoading ? 'Loading…' : 'Load sample data'}
            </button>
            <p className="muted">Adds 8 sample subjects (Data Structures, DBMS, Machine Learning…) so you can see the dashboard, charts and prediction in action.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="card donut-card">
              <div className="stat-label">Overall attendance</div>
              <div className="donut-wrap">
                <DonutChart percentage={pct} />
                <div className="donut-legend">
                  <span><span className="legend-dot" style={{ background: donutColor(pct) }} />Current</span>
                  <span><span className="legend-tick" />75% target</span>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="stat-top">
                <div className="stat-label">Total subjects</div>
                <div className="stat-icon" style={{ background: 'var(--indigo-bg)', color: 'var(--primary)' }}><IconSubjects size={18} /></div>
              </div>
              <div className="stat-big">{subjects.length}</div>
              <div className="stat-sub">{atOrAbove} at or above {required}% · {belowCount} below</div>
            </div>
            <div className="card">
              <div className="stat-top">
                <div className="stat-label">Classes conducted</div>
                <div className="stat-icon" style={{ background: 'var(--indigo-bg)', color: 'var(--primary)' }}><IconCalendar size={18} /></div>
              </div>
              <div className="stat-big">{total}</div>
              <div className="stat-sub">Across all {subjects.length} subjects</div>
            </div>
            <div className="card">
              <div className="stat-top">
                <div className="stat-label">Attended</div>
                <div className="stat-icon" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}><IconCheck size={18} /></div>
              </div>
              <div className="stat-big" style={{ color: 'var(--green)' }}>{attended}</div>
              <div className="stat-sub">{hasData ? `${pct.toFixed(1)}%` : '—'} of classes conducted</div>
            </div>
            <div className="card">
              <div className="stat-top">
                <div className="stat-label">Absent</div>
                <div className="stat-icon" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}><IconX size={18} /></div>
              </div>
              <div className="stat-big" style={{ color: 'var(--red)' }}>{absent}</div>
              <div className="stat-sub">{hasData ? `${(100 - pct).toFixed(1)}%` : '—'} of classes conducted</div>
            </div>
          </div>

          <div className="card table-card" ref={tableRef}>
            <div className="table-head">
              <div>
                <div className="table-title">Subject-wise attendance</div>
                <div className="table-sub">Sample subject names and counts; replace with your own data</div>
              </div>
              <button type="button" className="secondary" onClick={exportReport}>Export report</button>
            </div>
            {showLowOnly && (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                Showing subjects below {required}% only.{' '}
                <a href="#/" onClick={(e) => { e.preventDefault(); setShowLowOnly(false) }}>Show all</a>
              </p>
            )}
            {filtered.length === 0 ? (
              <div className="empty">
                {showLowOnly ? 'No subjects below 75%.' : 'No subjects match your search.'}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>SUBJECT</th><th>ATTENDED / TOTAL</th><th>ATTENDANCE</th><th>STATUS</th><th>ACTION NEEDED</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const p = Number(s.percentage ?? 0)
                      const st = statusOf(p)
                      return (
                        <tr key={s.id}>
                          <td className="subj">{s.subject_name}</td>
                          <td>{s.attended} / {s.total_classes}</td>
                          <td>
                            <div className="bar-cell">
                              <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${Math.min(100, p)}%`, background: chartColor(p) }} />
                                <div className="bar-tick" />
                              </div>
                              <span className="pct">{p.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td><span className={`status ${st.cls}`}>{st.label}</span></td>
                          <td className="action">{actionNeeded(s)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bottom-grid">
            <div className="card">
              <div className="chart-head">
                <div className="chart-title">Attendance by subject</div>
                <div className="chart-legend">
                  <span><i style={{ background: '#22c55e' }} />On track</span>
                  <span><i style={{ background: '#3b82f6' }} />Borderline</span>
                  <span><i style={{ background: '#f59e0b' }} />Below 75%</span>
                </div>
              </div>
              <BarChart
                data={subjects.map((s) => ({
                  name: s.subject_name,
                  short: shortLabel(s.subject_name),
                  value: Number(s.percentage ?? 0)
                }))}
                xKey="short"
                yKey="value"
                chartColors
                shortLabels
                showValueLabels
                showTarget
                target={required}
                targetLabel={false}
                showGrid={false}
                yTicks={[50, 100]}
                height={300}
              />
              <p className="muted">Dashed red line marks the {required}% requirement.</p>
            </div>
            <div className="card">
              <div className="proj-title">Projection: next 20 classes</div>
              <div className="proj-sub">Overall attendance if the current totals continue</div>
              {projectionRows(attended, total).map((r) => (
                <div className={`proj-row ${r.tone}`} key={r.key}>
                  <div>
                    <div className="proj-label">{r.label}</div>
                    <div className="proj-sub2">{r.sub}</div>
                  </div>
                  <div className="proj-val">{r.value.toFixed(1)}%</div>
                </div>
              ))}
              <button type="button" className="proj-btn" onClick={() => navigate('/planner')}>
                Plan with What-If Planner
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
