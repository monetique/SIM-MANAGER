import { useEffect, useState, useCallback } from 'react'
import { PageHeader, OpBadge, Spinner, Modal } from '../components/ui'
import api, { fmtDate } from '../lib/api'
import { useToastStore } from '../store'

export default function Livraison() {
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [clientNom, setClientNom] = useState('')
  const [clientAdresse, setClientAdresse] = useState('')
  const [op, setOp] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [ref, setRef] = useState('')
  const [availSims, setAvailSims] = useState([])
  const [selectedSims, setSelectedSims] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [loadingSims, setLoadingSims] = useState(false)
  const toast = useToastStore(s => s.add)

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data.filter(c => c.is_active)))
    setRef(genRef())
  }, [])

  const genRef = () => {
    const now = new Date()
    return `LIV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`
  }

  const onClientChange = (id) => {
    setClientId(id)
    const c = clients.find(c => String(c.id) === id)
    setClientNom(c?.nom || '')
    setClientAdresse(c?.adresse || '')
  }

  const loadSims = useCallback(async () => {
    if (!op) return
    setLoadingSims(true)
    setSelectedSims(new Set())
    try {
      const { data } = await api.get('/sims', { params: { operateur: op, status: 'disponible', limit: 500 } })
      setAvailSims(data)
    } catch { toast('Erreur chargement SIMs', 'error') }
    finally { setLoadingSims(false) }
  }, [op])

  useEffect(() => { loadSims() }, [loadSims])

  const toggleSim = (iccid) => {
    const next = new Set(selectedSims)
    next.has(iccid) ? next.delete(iccid) : next.add(iccid)
    setSelectedSims(next)
  }

  const selectAll = () => setSelectedSims(new Set(availSims.map(s => s.iccid)))
  const clearAll  = () => setSelectedSims(new Set())

  const submit = async () => {
    if (!clientId)            return toast('Choisissez un client', 'error')
    if (!op)                  return toast("Choisissez l'opérateur", 'error')
    if (!date)                return toast('Entrez une date', 'error')
    if (!selectedSims.size)   return toast('Sélectionnez au moins une SIM', 'error')
    setLoading(true)
    try {
      await api.post('/livraisons', {
        ref, client_id: clientId, client_nom: clientNom,
        operateur: op, date_livraison: date,
        iccids: [...selectedSims],
      })
      toast(`✓ Livraison ${ref} créée (${selectedSims.size} SIM)`, 'success')
      reset()
    } catch (err) { toast(err.response?.data?.error || 'Erreur', 'error') }
    finally { setLoading(false) }
  }

  const reset = () => {
    setClientId(''); setClientNom(''); setClientAdresse(''); setOp('')
    setAvailSims([]); setSelectedSims(new Set()); setRef(genRef())
    setDate(new Date().toISOString().split('T')[0])
  }

  return (
    <div>
      <PageHeader title="Nouvelle Livraison" subtitle="Créer un bordereau de livraison client" />

      {/* Client + Infos */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>📋 Informations</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Client *</label>
            <select className="select" value={clientId} onChange={e => onClientChange(e.target.value)}>
              <option value="">-- Choisir un client --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          {clientAdresse && (
            <div>
              <label className="form-label">Adresse</label>
              <input className="input" value={clientAdresse} readOnly style={{ opacity:.6 }} />
            </div>
          )}
          <div>
            <label className="form-label">Opérateur *</label>
            <select className="select" value={op} onChange={e => setOp(e.target.value)}>
              <option value="">-- Choisir --</option>
              <option>Ooredoo</option>
              <option>Tunisie Telecom</option>
              <option>Orange Telecom</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date de livraison *</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Référence</label>
            <input className="input" value={ref} readOnly style={{ opacity:.6, fontFamily:'Space Mono,monospace', fontSize:12 }} />
          </div>
        </div>
      </div>

      {/* SIM selector */}
      {op && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>
              📡 SIM disponibles — <OpBadge op={op} />
              <span style={{ fontFamily:'Space Mono,monospace', color:'var(--text-muted)', fontSize:12, marginLeft:10 }}>
                {selectedSims.size} sélectionnée(s) / {availSims.length} disponible(s)
              </span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={selectAll}>Tout</button>
              <button className="btn btn-secondary btn-sm" onClick={clearAll}>Aucun</button>
            </div>
          </div>
          {loadingSims
            ? <div style={{ textAlign:'center', padding:20 }}><Spinner /></div>
            : availSims.length === 0
              ? <div style={{ color:'var(--text-muted)', fontSize:13, padding:12 }}>Aucune SIM disponible pour cet opérateur.</div>
              : <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:260, overflowY:'auto' }}>
                  {availSims.map(s => (
                    <span key={s.iccid} className={`chip${selectedSims.has(s.iccid) ? ' selected' : ''}`}
                      onClick={() => toggleSim(s.iccid)}>
                      {s.iccid}
                    </span>
                  ))}
                </div>
          }
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:10 }}>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? <span className="spinner" style={{width:14,height:14}}/> : '🖨 Générer le bordereau'}
        </button>
        <button className="btn btn-secondary" onClick={reset}>✕ Réinitialiser</button>
      </div>
    </div>
  )
}
