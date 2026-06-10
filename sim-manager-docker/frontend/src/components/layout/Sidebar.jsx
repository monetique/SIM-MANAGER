import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useThemeStore } from '../../store'
import { can } from '../../lib/api'
import {
  LayoutDashboard, Package, Truck, History,
  BarChart2, Settings, LogOut, Sun, Moon, Cpu
} from 'lucide-react'

const NAV = [
  { to: '/',           label: 'Tableau de bord', icon: LayoutDashboard, perm: null },
  { to: '/stock',      label: 'Stock',           icon: Package,         perm: 'stock:read' },
  { to: '/livraison',  label: 'Livraison',       icon: Truck,           perm: 'livraison:write' },
  { to: '/historique', label: 'Historique',      icon: History,         perm: 'livraison:read' },
  { to: '/stats',      label: 'Statistiques',    icon: BarChart2,       perm: 'stats:read' },
  { to: '/config',     label: 'Configuration',   icon: Settings,        perm: null, adminOnly: true },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { dark, toggle } = useThemeStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside style={{
      width: 'var(--sidebar-w)', flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, background:'var(--accent)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Cpu size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, letterSpacing:'-0.02em' }}>SIM Manager</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>v2.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto' }}>
        {NAV.filter(item => {
          if (item.adminOnly && user?.role !== 'admin') return false
          if (item.perm && !can(user?.role, item.perm) && user?.role !== 'admin') return false
          return true
        }).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 12px', borderRadius:8, marginBottom:2,
              textDecoration:'none', fontSize:13, fontWeight:500,
              color: isActive ? '#fff' : 'var(--text-muted)',
              background: isActive ? 'var(--accent)' : 'transparent',
              transition:'all .15s',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding:'12px 10px', borderTop:'1px solid var(--border)' }}>
        {/* User info */}
        <div style={{ padding:'8px 12px', marginBottom:8, borderRadius:8, background:'var(--surface2)' }}>
          <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{user?.full_name}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' }}>{user?.role}</div>
        </div>
        {/* Theme toggle */}
        <button onClick={toggle} style={{
          display:'flex', alignItems:'center', gap:8, width:'100%',
          padding:'8px 12px', borderRadius:8, border:'none',
          background:'transparent', color:'var(--text-muted)',
          cursor:'pointer', fontSize:13, fontWeight:500,
          transition:'background .15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {dark ? <Sun size={15}/> : <Moon size={15}/>}
          {dark ? 'Mode clair' : 'Mode sombre'}
        </button>
        {/* Logout */}
        <button onClick={handleLogout} style={{
          display:'flex', alignItems:'center', gap:8, width:'100%',
          padding:'8px 12px', borderRadius:8, border:'none',
          background:'transparent', color:'var(--danger)',
          cursor:'pointer', fontSize:13, fontWeight:500,
          transition:'background .15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={15}/> Déconnexion
        </button>
      </div>
    </aside>
  )
}
