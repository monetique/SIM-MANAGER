import { useEffect, useState, useRef } from 'react'
import { Chart, CategoryScale, LinearScale, LogarithmicScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { PageHeader, OpBadge, Spinner, EmptyState } from '../components/ui'
import api, { fmtDate } from '../lib/api'
import { useToastStore } from '../store'

Chart.register(CategoryScale, LinearScale, LogarithmicScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

const OP_COLORS = { 'Tunisie Telecom':'#006bb6','Orange Telecom':'#ff7900','Ooredoo':'#e4002b' }
const MONTHS    = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export default function Stats() {
  const [annee, setAnnee]         = useState(new Date().getFullYear())
  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')
  const [moisData, setMoisData]   = useState([])
  const [moisClient, setMoisClient] = useState([])
  const [recap, setRecap]         = useState([])
  const [dispo, setDispo]         = useState([])
  const [top, setTop]             = useState([])
  const [loading, setLoading]     = useState(true)
  const [clients, setClients]     = useState([])
  const [detailClientId, setDetailClientId] = useState('all')
  const [detailOp, setDetailOp]   = useState('all')
  const [detailFrom, setDetailFrom] = useState('')
  const [detailTo, setDetailTo]   = useState('')
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const toast = useToastStore(s => s.add)

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data.filter(c => c.is_active)))
  }, [])
  useEffect(() => { load() }, [annee, from, to])

  const load = async () => {
    setLoading(true)
    try {
      const params = { from: from || undefined, to: to || undefined }
      const [m, mc, r, d, t] = await Promise.all([
        api.get(`/stats/par-mois?annee=${annee}`),
        api.get(`/stats/par-mois-client?annee=${annee}`),
        api.get('/stats/recap', { params }),
        api.get('/stats/disponibilite'),
        api.get('/stats/top-clients?limit=5', { params }),
      ])
      setMoisData(m.data)
      setMoisClient(mc.data)
      setRecap(r.data)
      setDispo(d.data)
      setTop(t.data)
    } catch (e) { toast('Erreur stats', 'error') }
    finally { setLoading(false) }
  }

  // Build chart data for par-mois
  const chartMois = {
    labels: MONTHS,
    datasets: Object.keys(OP_COLORS).map(op => ({
      label: op,
      data: MONTHS.map((_, i) => {
        const r = moisData.find(d => d.operateur === op && parseInt(d.mois.split('-')[1]) === i+1)
        return parseInt(r?.nb_sims) || 0
      }),
      borderColor: OP_COLORS[op],
      backgroundColor: OP_COLORS[op] + '22',
      tension: 0.3, fill: true, pointRadius: 4,
    }))
  }

  // Build monthly-client table
  const buildMoisClientTable = () => {
    const moisOrder = []; const moisMap = {}
    moisClient.forEach(r => {
      if (!moisMap[r.mois]) { moisMap[r.mois] = { label: r.mois_label, clients: {} }; moisOrder.push(r.mois) }
      if (!moisMap[r.mois].clients[r.client_nom]) moisMap[r.mois].clients[r.client_nom] = {}
      moisMap[r.mois].clients[r.client_nom][r.operateur] = r.nb_sims
    })
    return { moisOrder, moisMap }
  }
  const { moisOrder, moisMap } = buildMoisClientTable()

  const chartOpts = {
    responsive: true,
    plugins: { legend: { position: 'top', labels: { color: 'var(--text-muted)', font:{ size:11 } } } },
    scales: {
      x: { ticks: { color:'var(--text-muted)' }, grid: { color:'var(--border)' } },
      y: { type:'logarithmic', min:1, ticks: { color:'var(--text-muted)' }, grid: { color:'var(--border)' } }
    }
  }

  const searchDetail = async () => {
    setDetailLoading(true)
    try {
      const params = {}
      if (detailClientId !== 'all') params.client_id = detailClientId
      if (detailOp !== 'all')       params.operateur  = detailOp
      if (detailFrom)               params.from       = detailFrom
      if (detailTo)                 params.to         = detailTo
      const { data } = await api.get('/stats/client-detail', { params })
      setDetailData(data)
    } catch (e) { toast('Erreur recherche', 'error') }
    finally { setDetailLoading(false) }
  }

  return (
    <div>
      <PageHeader title="Statistiques" subtitle="Analyse des livraisons et disponibilité du stock" />

      {/* Filters */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label className="form-label">Année</label>
            <select className="select" style={{ width:110 }} value={annee} onChange={e => setAnnee(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Du</label>
            <input className="input" type="date" style={{ width:155 }} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Au</label>
            <input className="input" type="date" style={{ width:155 }} value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="btn btn-secondary" onClick={() => { setFrom(''); setTo('') }}>✕ Réinitialiser</button>
        </div>
      </div>

      {/* Recherche détaillée par client / opérateur */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>🔎 Recherche détaillée par client et opérateur</div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end', marginBottom:16 }}>
          <div style={{ flex:'1 1 180px' }}>
            <label className="form-label">Client</label>
            <select className="select" value={detailClientId} onChange={e => setDetailClientId(e.target.value)}>
              <option value="all">— Tous les clients —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div style={{ flex:'0 0 180px' }}>
            <label className="form-label">Opérateur</label>
            <select className="select" value={detailOp} onChange={e => setDetailOp(e.target.value)}>
              <option value="all">— Tous —</option>
              <option value="Ooredoo">Ooredoo</option>
              <option value="Tunisie Telecom">Tunisie Telecom</option>
              <option value="Orange Telecom">Orange Telecom</option>
            </select>
          </div>
          <div>
            <label className="form-label">Du</label>
            <input className="input" type="date" style={{ width:155 }} value={detailFrom} onChange={e => setDetailFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Au</label>
            <input className="input" type="date" style={{ width:155 }} value={detailTo} onChange={e => setDetailTo(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={searchDetail} disabled={detailLoading}>
            {detailLoading ? <span className="spinner" style={{width:14,height:14}}/> : '🔍 Rechercher'}
          </button>
        </div>

        {detailData && (
          <>
            {/* Totaux */}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 20px', minWidth:150 }}>
                <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--text-muted)', marginBottom:4 }}>Total SIM</div>
                <div style={{ fontFamily:'Space Mono,monospace', fontSize:28, fontWeight:800, color:'var(--accent)' }}>{detailData.totaux.total_sims}</div>
                <div style={{ fontSize:11, color:'#22c55e', marginTop:4 }}>● {detailData.simActuelles?.total ?? '—'} actives</div>
              </div>
              {Object.entries(detailData.parOperateur).map(([op, d]) => (
                <div key={op} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 20px', minWidth:150 }}>
                  <div style={{ marginBottom:6 }}><OpBadge op={op} /></div>
                  <div style={{ fontFamily:'Space Mono,monospace', fontSize:22, fontWeight:700, color:'var(--text)' }}>{d.sims}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{d.livraisons} livraison(s)</div>
                  <div style={{ fontSize:11, color:'#22c55e', marginTop:4 }}>● {detailData.simActuelles?.parOperateur?.[op] ?? 0} actives</div>
                </div>
              ))}
            </div>

            {/* Table */}
            {detailData.livraisons.length === 0
              ? <div style={{ color:'var(--text-muted)', fontSize:13, padding:12 }}>Aucune livraison pour ces critères.</div>
              : <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>Référence</th><th>Client</th><th>Opérateur</th><th>Date</th><th>SIM livrées</th><th>Par</th>
                    </tr></thead>
                    <tbody>
                      {detailData.livraisons.map(l => (
                        <tr key={l.ref}>
                          <td className="mono" style={{fontSize:12}}>{l.ref}</td>
                          <td style={{fontWeight:500}}>{l.client_nom}</td>
                          <td><OpBadge op={l.operateur} /></td>
                          <td style={{color:'var(--text-muted)',fontSize:12}}>{fmtDate(l.date_livraison)}</td>
                          <td className="mono" style={{color:'var(--accent)',fontWeight:700,textAlign:'center'}}>{l.quantite}</td>
                          <td style={{color:'var(--text-muted)',fontSize:12}}>{l.created_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </>
        )}
        {!detailData && !detailLoading && (
          <div style={{ color:'var(--text-muted)', fontSize:13, padding:4 }}>
            Choisissez un client et/ou opérateur puis cliquez sur Rechercher.
          </div>
        )}
      </div>

      {loading
        ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
        : <>
          {/* Dispo par opérateur */}
          <div className="card" style={{ marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>📡 Disponibilité par opérateur</div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {dispo.map(d => (
                <div key={d.operateur} style={{ flex:'1 1 200px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
                  <div style={{ marginBottom:10 }}><OpBadge op={d.operateur} /></div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>Disponible</span>
                    <span style={{ fontFamily:'Space Mono,monospace', fontWeight:700, color:'#22c55e' }}>{d.disponible}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>Total</span>
                    <span style={{ fontFamily:'Space Mono,monospace', fontWeight:700 }}>{d.total}</span>
                  </div>
                  <div style={{ background:'var(--border)', borderRadius:20, height:5 }}>
                    <div style={{ background:'#22c55e', width:`${d.pct_disponible}%`, height:5, borderRadius:20 }} />
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, textAlign:'right' }}>{d.pct_disponible}% disponible</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <div className="card">
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>📅 Livraisons par mois — {annee}</div>
              <Line data={chartMois} options={chartOpts} />
            </div>
            <div className="card">
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>🏆 Top 5 clients</div>
              {top.length === 0
                ? <EmptyState icon="👥" title="Aucune donnée" />
                : <div>
                    {top.map((c, i) => {
                      const pct = Math.round(c.nb_sims / (top[0].nb_sims || 1) * 100)
                      return (
                        <div key={c.client_nom} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                          <span style={{ fontSize:18, minWidth:28 }}>{'🥇🥈🥉4️⃣5️⃣'[i*2]}{'🥇🥈🥉4️⃣5️⃣'[i*2+1]}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>{c.client_nom}</div>
                            <div style={{ background:'var(--border)', borderRadius:20, height:5 }}>
                              <div style={{ background:'var(--accent)', width:`${pct}%`, height:5, borderRadius:20 }} />
                            </div>
                          </div>
                          <span className="mono" style={{ color:'var(--accent)', fontWeight:700 }}>{c.nb_sims}</span>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>
          </div>

          {/* Tableau mensuel par client */}
          <div className="card" style={{ marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>📆 SIM livrées par mois, client et opérateur — {annee}</div>
            {moisOrder.length === 0
              ? <EmptyState icon="📊" title="Aucune donnée" sub="Aucune livraison pour cette année" />
              : <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>Mois</th><th>Client</th>
                      {Object.keys(OP_COLORS).map(op => (
                        <th key={op} style={{ textAlign:'center', color:OP_COLORS[op] }}>{op.split(' ')[0]}</th>
                      ))}
                      <th style={{ textAlign:'center' }}>Total</th>
                    </tr></thead>
                    <tbody>
                      {[...moisOrder].reverse().map(mois => {
                        const m = moisMap[mois]
                        const clientKeys = Object.keys(m.clients)
                        const moisTotals = {}
                        Object.keys(OP_COLORS).forEach(op => moisTotals[op] = 0)
                        clientKeys.forEach(c => Object.keys(OP_COLORS).forEach(op => { moisTotals[op] += m.clients[c][op] || 0 }))
                        const grandTotal = Object.values(moisTotals).reduce((a,b) => a+b, 0)
                        return [
                          ...clientKeys.map((client, ci) => {
                            const c = m.clients[client]
                            const rowTotal = Object.keys(OP_COLORS).reduce((s,op) => s+(c[op]||0), 0)
                            return (
                              <tr key={`${mois}-${client}`}>
                                {ci === 0 && (
                                  <td rowSpan={clientKeys.length + 1} style={{ fontWeight:700, fontSize:12, verticalAlign:'top', paddingTop:12, borderRight:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                                    {m.label}
                                  </td>
                                )}
                                <td style={{ fontSize:13 }}>{client}</td>
                                {Object.keys(OP_COLORS).map(op => (
                                  <td key={op} style={{ textAlign:'center', fontFamily:'Space Mono,monospace', fontSize:12 }}>{c[op] || 0}</td>
                                ))}
                                <td style={{ textAlign:'center', fontFamily:'Space Mono,monospace', fontWeight:700, color:'var(--accent)' }}>{rowTotal}</td>
                              </tr>
                            )
                          }),
                          <tr key={`${mois}-total`} style={{ background:'var(--surface2)' }}>
                            <td style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>Sous-total</td>
                            {Object.keys(OP_COLORS).map(op => (
                              <td key={op} style={{ textAlign:'center', fontFamily:'Space Mono,monospace', fontWeight:700, color:OP_COLORS[op], fontSize:12 }}>{moisTotals[op] || 0}</td>
                            ))}
                            <td style={{ textAlign:'center', fontFamily:'Space Mono,monospace', fontWeight:700, color:'var(--accent)' }}>{grandTotal}</td>
                          </tr>
                        ]
                      })}
                    </tbody>
                  </table>
                </div>
            }
          </div>

          {/* Recap table */}
          <div className="card">
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>📋 Tableau récapitulatif</div>
            {recap.length === 0
              ? <EmptyState icon="📊" title="Aucune donnée" />
              : <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>Client</th><th>Opérateur</th><th>Livraisons</th>
                      <th>SIM livrées</th><th>Première liv.</th><th>Dernière liv.</th>
                    </tr></thead>
                    <tbody>
                      {recap.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{r.client_nom}</td>
                          <td><OpBadge op={r.operateur} /></td>
                          <td className="mono" style={{ textAlign:'center' }}>{r.nb_livraisons}</td>
                          <td className="mono" style={{ textAlign:'center', color:'var(--accent)', fontWeight:700 }}>{r.nb_sims}</td>
                          <td style={{ color:'var(--text-muted)', fontSize:12 }}>{fmtDate(r.premiere_livraison)}</td>
                          <td style={{ color:'var(--text-muted)', fontSize:12 }}>{fmtDate(r.derniere_livraison)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </>
      }
    </div>
  )
}
