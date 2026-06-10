import { useEffect, useState } from 'react'
import { StatCard, OpBadge, Spinner, EmptyState } from '../components/ui'
import { PageHeader } from '../components/ui'
import api, { fmtDate } from '../lib/api'
import { useToastStore, useAuthStore } from '../store'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [puces, setPuces] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToastStore(s => s.add)
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [s, r, p] = await Promise.all([
        api.get('/stats'),
        api.get('/livraisons'),
        api.get('/stats/puces-par-client'),
      ])
      setStats(s.data)
      setRecent(r.data.slice(0, 5))
      setPuces(p.data)
    } catch { toast('Erreur chargement dashboard', 'error') }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <Spinner size={32} />
    </div>
  )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${user?.full_name?.split(' ')[0]} 👋`}
        subtitle="Vue d'ensemble du stock et des livraisons"
      />

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16, marginBottom:28 }}>
        <StatCard label="SIM en stock"    value={stats?.total}      icon="📦" />
        <StatCard label="Disponibles"     value={stats?.disponible}  icon="✅" color="#22c55e" />
        <StatCard label="Livrées"         value={stats?.livre}       icon="🚚" color="#3b82f6" />
        <StatCard label="Livraisons"      value={stats?.livraisons}  icon="📋" color="#f59e0b" />
        <StatCard label="Clients actifs"  value={stats?.clients}     icon="👥" color="#8b5cf6" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Stock par opérateur */}
        <div className="card">
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>📡 Stock par opérateur</div>
          {stats?.parOperateur?.map(op => {
            const pct = Math.round((op.disponible / (op.total || 1)) * 100)
            return (
              <div key={op.operateur} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <OpBadge op={op.operateur} />
                  <span style={{ fontFamily:'Space Mono,monospace', fontSize:12, color:'var(--text-muted)' }}>
                    {op.disponible} / {op.total}
                  </span>
                </div>
                <div style={{ background:'var(--border)', borderRadius:20, height:5 }}>
                  <div style={{ background:'var(--accent)', width:`${pct}%`, height:5, borderRadius:20, transition:'width .5s' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* SIM par client */}
        <div className="card">
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>🏆 SIM par client</div>
          {puces.length === 0
            ? <EmptyState icon="👥" title="Aucune donnée" />
            : puces.slice(0,6).map(p => (
              <div key={p.client} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{p.client}</span>
                <span style={{ fontFamily:'Space Mono,monospace', fontSize:13, color:'var(--accent)', fontWeight:700 }}>{p.total_general}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Dernières livraisons */}
      <div className="card">
        <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>🕒 Dernières livraisons</div>
        {recent.length === 0
          ? <EmptyState icon="📦" title="Aucune livraison" sub="Créez votre première livraison" />
          : <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Référence</th><th>Client</th><th>Opérateur</th><th>Qté</th><th>Date</th>
                </tr></thead>
                <tbody>
                  {recent.map(l => (
                    <tr key={l.ref}>
                      <td><span className="mono" style={{fontSize:12}}>{l.ref}</span></td>
                      <td style={{fontWeight:500}}>{l.client_nom_complet}</td>
                      <td><OpBadge op={l.operateur} /></td>
                      <td><span className="mono" style={{color:'var(--accent)',fontWeight:700}}>{l.quantite}</span></td>
                      <td style={{color:'var(--text-muted)',fontSize:12}}>{fmtDate(l.date_livraison)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  )
}
