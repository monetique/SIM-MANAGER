import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, RotateCcw, Scissors } from 'lucide-react'
import { PageHeader, OpBadge, StatusBadge, Spinner, EmptyState, Modal, ConfirmModal } from '../components/ui'
import api, { fmtDate } from '../lib/api'
import { useToastStore, useAuthStore } from '../store'
import { can } from '../lib/api'

const OPS = ['Tous', 'Ooredoo', 'Tunisie Telecom', 'Orange Telecom']
const STATUTS = [
  { value: '', label: 'Tous statuts' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'livre', label: 'Livré' },
  { value: 'resiliee', label: 'Résiliée' },
]

export default function Stock() {
  const [sims, setSims] = useState([])
  const [loading, setLoading] = useState(true)
  const [op, setOp] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [confirm, setConfirm] = useState(null) // { iccid }
  const toast = useToastStore(s => s.add)
  const user = useAuthStore(s => s.user)
  const canWrite = can(user?.role, 'stock:write') || user?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 500 }
      if (op) params.operateur = op
      if (status) params.status = status
      if (search) params.search = search
      const { data } = await api.get('/sims', { params })
      setSims(data)
    } catch { toast('Erreur chargement stock', 'error') }
    finally { setLoading(false) }
  }, [op, status, search])

  useEffect(() => { load() }, [load])

  const resilier = async (iccid) => {
    try {
      await api.patch(`/sims/${encodeURIComponent(iccid)}/resilier`)
      toast(`SIM ${iccid} résiliée`, 'success')
      load()
    } catch (err) { toast(err.response?.data?.error || 'Erreur', 'error') }
  }

  const counts = {
    total: sims.length,
    dispo: sims.filter(s => s.status === 'disponible').length,
    livre: sims.filter(s => s.status === 'livre').length,
    resiliee: sims.filter(s => s.status === 'resiliee').length,
  }

  return (
    <div>
      <PageHeader
        title="Gestion du Stock"
        subtitle="Réception et consultation des puces SIM"
        action={canWrite && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={15}/> Ajouter un lot
          </button>
        )}
      />

      {/* Mini KPIs */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'Total', val: counts.total, color:'var(--text)' },
          { label:'Disponibles', val: counts.dispo, color:'#22c55e' },
          { label:'Livrées', val: counts.livre, color:'#3b82f6' },
          { label:'Résiliées', val: counts.resiliee, color:'#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 18px' }}>
            <div style={{ fontFamily:'Space Mono,monospace', fontSize:20, fontWeight:700, color:k.color }}>{k.val}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em', marginTop:2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          {/* Op tabs */}
          <div className="tabs">
            {OPS.map(o => (
              <button key={o} className={`tab-btn${op === (o === 'Tous' ? '' : o) ? ' active' : ''}`}
                onClick={() => setOp(o === 'Tous' ? '' : o)}>{o}</button>
            ))}
          </div>
          {/* Status */}
          <select className="select" style={{ width:160 }} value={status} onChange={e => setStatus(e.target.value)}>
            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {/* Search */}
          <div style={{ position:'relative', flex:1, minWidth:180 }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input className="input" style={{ paddingLeft:32 }} placeholder="Rechercher ICCID…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load} title="Actualiser">
            <RotateCcw size={13}/>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {loading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : sims.length === 0
              ? <EmptyState icon="📦" title="Aucun résultat" sub="Modifiez vos filtres ou ajoutez des puces" />
              : <table>
                  <thead><tr>
                    <th style={{width:40}}>#</th>
                    <th>ICCID</th>
                    <th>Opérateur</th>
                    <th>Lot</th>
                    <th>Date entrée</th>
                    <th>Statut</th>
                    {canWrite && <th style={{width:100}}>Actions</th>}
                  </tr></thead>
                  <tbody>
                    {sims.map((s, i) => (
                      <tr key={s.iccid}>
                        <td style={{ color:'var(--text-muted)', fontSize:11 }}>{i+1}</td>
                        <td className="iccid">{s.iccid}</td>
                        <td><OpBadge op={s.operateur} /></td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{s.lot}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{fmtDate(s.date_entree)}</td>
                        <td><StatusBadge status={s.status} /></td>
                        {canWrite && (
                          <td>
                            {s.status === 'livre' && (
                              <button className="btn btn-danger btn-sm"
                                onClick={() => setConfirm({ iccid: s.iccid })}>
                                <Scissors size={12}/> Résilier
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
          }
        </div>
      </div>

      {/* Add lot modal */}
      <AddLotModal open={showAdd} onClose={() => setShowAdd(false)} onSuccess={load} />

      {/* Confirm resilier */}
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => resilier(confirm.iccid)}
        title="Résilier la SIM"
        message={`Voulez-vous résilier la SIM ${confirm?.iccid} ? Cette action est irréversible.`}
        danger
      />
    </div>
  )
}

// ── Add Lot Modal ─────────────────────────────────────
function AddLotModal({ open, onClose, onSuccess }) {
  const [op, setOp] = useState('')
  const [lot, setLot] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToastStore(s => s.add)

  const count = text.split('\n').filter(l => l.trim()).length

  const submit = async () => {
    const iccids = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (!op) return toast('Choisissez un opérateur', 'error')
    if (!lot) return toast('Entrez un nom de lot', 'error')
    if (!iccids.length) return toast('Entrez au moins un ICCID', 'error')
    setLoading(true)
    try {
      const { data } = await api.post('/sims/lot', { operateur: op, lot, iccids })
      toast(`✓ ${data.added} ajoutée(s)${data.skipped ? ` · ${data.skipped} doublon(s)` : ''}`, 'success')
      setOp(''); setLot(''); setText('')
      onClose(); onSuccess()
    } catch (err) { toast(err.response?.data?.error || 'Erreur', 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="➕ Ajouter un lot de puces" maxWidth={520}>
      <div style={{ marginBottom:14 }}>
        <label className="form-label">Opérateur</label>
        <select className="select" value={op} onChange={e => setOp(e.target.value)}>
          <option value="">-- Choisir --</option>
          <option>Ooredoo</option>
          <option>Tunisie Telecom</option>
          <option>Orange Telecom</option>
        </select>
      </div>
      <div style={{ marginBottom:14 }}>
        <label className="form-label">Nom du lot</label>
        <input className="input" value={lot} onChange={e => setLot(e.target.value)} placeholder="ex: LOT-2026-S01" />
      </div>
      <div style={{ marginBottom:20 }}>
        <label className="form-label">ICCIDs — un par ligne <span style={{textTransform:'none',fontWeight:400,color:'var(--text-muted)'}}>{count} puce(s)</span></label>
        <textarea className="input" rows={8} style={{ fontFamily:'Space Mono,monospace', fontSize:11, resize:'vertical' }}
          value={text} onChange={e => setText(e.target.value)}
          placeholder="89216030000000000001&#10;89216030000000000002" />
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? <span className="spinner" style={{width:14,height:14}}/> : '💾 Enregistrer'}
        </button>
      </div>
    </Modal>
  )
}
