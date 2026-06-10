import { useEffect, useState } from 'react'
import { Search, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { PageHeader, OpBadge, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import api, { fmtDate } from '../lib/api'
import { useToastStore, useAuthStore } from '../store'

export default function Historique() {
  const [livraisons, setLivraisons] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [deleteRef, setDeleteRef] = useState(null)
  const toast = useToastStore(s => s.add)
  const user = useAuthStore(s => s.user)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/livraisons')
      setLivraisons(data)
    } catch { toast('Erreur chargement', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    let data = livraisons
    if (clientFilter) data = data.filter(l => l.client_id === parseInt(clientFilter))
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(l =>
        l.ref?.toLowerCase().includes(q) ||
        l.client_nom_complet?.toLowerCase().includes(q) ||
        l.operateur?.toLowerCase().includes(q)
      )
    }
    setFiltered(data)
  }, [livraisons, search, clientFilter])

  const deleteLiv = async (ref) => {
    try {
      await api.delete(`/livraisons/${encodeURIComponent(ref)}`)
      toast('Livraison supprimée', 'info')
      load()
    } catch (err) { toast(err.response?.data?.error || 'Erreur', 'error') }
  }

  const clients = [...new Map(livraisons.map(l => [l.client_id, l.client_nom_complet])).entries()]

  return (
    <div>
      <PageHeader title="Historique des Livraisons" subtitle="Tous les bordereaux générés" />

      {/* Filters */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input className="input" style={{ paddingLeft:32 }} placeholder="Rechercher réf / client…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width:200 }} value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
            <option value="">Tous les clients</option>
            {clients.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
          </select>
          <span style={{ color:'var(--text-muted)', fontSize:12 }}>{filtered.length} livraison(s)</span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {loading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : filtered.length === 0
              ? <EmptyState icon="📦" title="Aucune livraison" sub="Aucun bordereau ne correspond à vos critères" />
              : <table>
                  <thead><tr>
                    <th style={{width:32}}/>
                    <th>Référence</th><th>Client</th><th>Adresse</th>
                    <th>Opérateur</th><th>Qté</th><th>Date</th><th>Par</th>
                    {user?.role === 'admin' && <th>Actions</th>}
                  </tr></thead>
                  <tbody>
                    {filtered.map(l => (
                      <>
                        <tr key={l.ref} style={{ cursor:'pointer' }} onClick={() => setExpanded(expanded === l.ref ? null : l.ref)}>
                          <td style={{ color:'var(--text-muted)' }}>
                            {expanded === l.ref ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                          </td>
                          <td><span className="mono" style={{fontSize:12}}>{l.ref}</span></td>
                          <td style={{ fontWeight:500 }}>{l.client_nom_complet}</td>
                          <td style={{ color:'var(--text-muted)', fontSize:12 }}>{l.client_adresse || '—'}</td>
                          <td><OpBadge op={l.operateur} /></td>
                          <td><span className="mono" style={{color:'var(--accent)',fontWeight:700}}>{l.quantite}</span></td>
                          <td style={{ color:'var(--text-muted)', fontSize:12 }}>{fmtDate(l.date_livraison)}</td>
                          <td style={{ color:'var(--text-muted)', fontSize:12 }}>{l.created_by}</td>
                          {user?.role === 'admin' && (
                            <td onClick={e => e.stopPropagation()}>
                              <button className="btn btn-danger btn-sm" onClick={() => setDeleteRef(l.ref)}>
                                <Trash2 size={12}/>
                              </button>
                            </td>
                          )}
                        </tr>
                        {expanded === l.ref && (
                          <tr key={`${l.ref}-detail`}>
                            <td colSpan={user?.role === 'admin' ? 9 : 8} style={{ padding:'0 14px 14px 46px', background:'var(--surface2)' }}>
                              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
                                ICCIDs ({l.sims?.length || 0}) :
                              </div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {(l.sims || []).map(iccid => (
                                  <span key={iccid} style={{ fontFamily:'Space Mono,monospace', fontSize:11, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 8px', color:'var(--accent)' }}>
                                    {iccid}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
          }
        </div>
      </div>

      <ConfirmModal
        open={!!deleteRef}
        onClose={() => setDeleteRef(null)}
        onConfirm={() => deleteLiv(deleteRef)}
        title="Supprimer la livraison"
        message={`Supprimer la livraison ${deleteRef} ? Les SIM repasseront en statut "disponible".`}
        danger
      />
    </div>
  )
}
