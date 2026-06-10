import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Helpers ────────────────────────────────────────────
export const normalizeOp = (op = '') => {
  const l = op.toLowerCase()
  if (['tt','tunisie telecom','tunisietelecom'].includes(l)) return 'Tunisie Telecom'
  if (['orange','orange telecom','orangetelecom'].includes(l)) return 'Orange Telecom'
  if (l === 'ooredoo') return 'Ooredoo'
  return op
}

export const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

export const PERMISSIONS = {
  admin:        ['*'],
  stock:        ['stock:read','stock:write'],
  livraison:    ['stock:read','livraison:read','livraison:write'],
  consultation: ['stock:read','livraison:read','stats:read'],
}

export const can = (role, perm) => {
  const perms = PERMISSIONS[role] || []
  return perms.includes('*') || perms.includes(perm)
}
