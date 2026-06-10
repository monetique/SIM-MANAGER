import { useToastStore } from '../../store'
import { normalizeOp } from '../../lib/api'

// ── Toast ─────────────────────────────────────────────
export function ToastContainer() {
  const toasts = useToastStore(s => s.toasts)
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 480 }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div className="modal-title" style={{margin:0}}>{title}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── OpBadge ───────────────────────────────────────────
export function OpBadge({ op }) {
  const n = normalizeOp(op)
  const cls = n === 'Tunisie Telecom' ? 'badge-tt' : n === 'Orange Telecom' ? 'badge-orange' : 'badge-ooredoo'
  return <span className={cls}>{n}</span>
}

// ── StatusBadge ───────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    disponible: ['badge-disponible', '● Disponible'],
    livre:      ['badge-livre',      '● Livré'],
    resiliee:   ['badge-resiliee',   '● Résiliée'],
  }
  const [cls, label] = map[status] || ['', status]
  return <span className={cls}>{label}</span>
}

// ── Spinner ───────────────────────────────────────────
export function Spinner({ size = 18 }) {
  return <div className="spinner" style={{ width: size, height: size }} />
}

// ── EmptyState ────────────────────────────────────────
export function EmptyState({ icon = '📦', title, sub }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
    </div>
  )
}

// ── ConfirmModal ──────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={400}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>
          Confirmer
        </button>
      </div>
    </Modal>
  )
}

// ── PageHeader ────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────
export function StatCard({ label, value, icon, color }) {
  return (
    <div className="stat-card" style={{ '--accent': color || 'var(--accent)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div className="stat-value">{value ?? '—'}</div>
          <div className="stat-label">{label}</div>
        </div>
        {icon && <div style={{ fontSize:28, opacity:.6 }}>{icon}</div>}
      </div>
    </div>
  )
}
