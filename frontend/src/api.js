// API wrapper. All calls go through the Vite dev proxy: /api -> http://localhost:8000
// In production, serve the built frontend behind the same host as the API
// (or set VITE_API_URL) so the relative "/api" base still works.

const TOKEN_KEY = 'sa_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  window.location.href = '/login'
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {}
  if (!isForm) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
  })

  if (res.status === 401) {
    // Token expired / invalid -> force re-login
    setToken(null)
    window.location.href = '/login'
    throw new Error('Session expired. Please log in again.')
  }

  // File downloads (CSV / PDF exports) are handled by downloadFile(), not here.
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const msg =
      (data && data.detail) ||
      (data && data.message) ||
      `Request failed (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),

  // Multipart upload (CSV / XLSX). `file` is a File object.
  upload: async (path, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(path, { method: 'POST', body: form, isForm: true })
  },

  // File download (CSV / PDF export). Triggers a browser save.
  download: async (path, filename) => {
    const token = getToken()
    const res = await fetch(`/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.status === 401) {
      setToken(null)
      window.location.href = '/login'
      throw new Error('Session expired. Please log in again.')
    }
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
}
