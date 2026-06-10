import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react'
import { PageHeader, Modal, ConfirmModal, Spinner, EmptyState } from '../components/ui'
import api, { fmtDate } from '../lib/api'
import { useToastStore } from '../store'

const ROLES = ['admin','stock','livraison','consultation']

export default function Config() {
  const [tab, setTab] = useState('clients')
  return (
    <div>
      <PageHeader title="Configuration" subtitle="Gestion des clients et des utilisateurs" />
      <div className="tabs" style={{ marginBottom:20 }}>
        <button className={`tab-btn${tab==='clients' ? ' active' : ''}`} onClick={() => setTab('clients')}>👥 Clients</button>
        <button className={`tab-btn${tab==='users'   ? ' active' : ''}`} onClick={() => setTab('users')}>👤 Utilisateurs</button>
      </div>
      {tab === 'clients' ? <ClientsTab /> : <UsersTab />}
    </div>
  )
}

// ── CLIENTS ───────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | {id,nom,adresse}
  const [deleteId, setDeleteId] = useState(null)
  const toast = useToastStore(s => s.add)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/clients'); setClients(data) }
    catch { toast('Erreur chargement clients', 'error') }
    finally { setLoading(false) }
  }

  const deleteClient = async (id) => {
    try { await api.delete(`/clients/${id}`); toast('Client supprimé', 'info'); load() }
    catch (err) { toast(err.response?.data?.error || 'Erreur', 'error') }
  }

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={14}/> Nouveau client</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          {loading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : clients.length === 0
              ? <EmptyState icon="👥" title="Aucun client" sub="Créez votre premier client" />
              : <table>
                  <thead><tr><th>Nom</th><th>Adresse</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight:600 }}>{c.nom}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{c.adresse || '—'}</td>
                        <td>
                          <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600,
                            background: c.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)',
                            color: c.is_active ? '#22c55e' : '#64748b' }}>
                            {c.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{fmtDate(c.created_at)}</td>
                        <td>
                          <div style={{ display:'flex', gap:6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setModal(c)}><Pencil size={12}/></button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(c.id)}><Trash2 size={12}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          }
        </div>
      </div>
      <ClientModal open={!!modal} onClose={() => setModal(null)} data={modal !== 'add' ? modal : null} onSuccess={load} />
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteClient(deleteId)}
        title="Supprimer le client" message="Cette action supprimera le client définitivement." danger />
    </>
  )
}

function ClientModal({ open, onClose, data, onSuccess }) {
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [actif, setActif] = useState(true)
  const [loading, setLoading] = useState(false)
  const toast = useToastStore(s => s.add)

  useEffect(() => {
    if (data) { setNom(data.nom || ''); setAdresse(data.adresse || ''); setActif(data.is_active ?? true) }
    else { setNom(''); setAdresse(''); setActif(true) }
  }, [data, open])

  const submit = async () => {
    if (!nom.trim()) return toast('Le nom est requis', 'error')
    setLoading(true)
    try {
      if (data?.id) await api.put(`/clients/${data.id}`, { adresse: adresse || null, is_active: actif })
      else          await api.post('/clients', { nom: nom.trim(), adresse: adresse || null })
      toast(data?.id ? '✓ Client modifié' : '✓ Client créé', 'success')
      onClose(); onSuccess()
    } catch (err) { toast(err.response?.data?.error || 'Erreur', 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={data ? 'Modifier le client' : 'Nouveau client'}>
      <div style={{ marginBottom:14 }}>
        <label className="form-label">Nom *</label>
        <input className="input" value={nom} onChange={e => setNom(e.target.value)} disabled={!!data} placeholder="Société ABC" />
      </div>
      <div style={{ marginBottom:14 }}>
        <label className="form-label">Adresse</label>
        <input className="input" value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Tunis, Tunisie" />
      </div>
      {data && (
        <div style={{ marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
          <input type="checkbox" id="is_active" checked={actif} onChange={e => setActif(e.target.checked)} style={{ width:16, height:16 }} />
          <label htmlFor="is_active" style={{ fontSize:13, cursor:'pointer' }}>Client actif</label>
        </div>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? <span className="spinner" style={{width:14,height:14}}/> : '💾 Enregistrer'}
        </button>
      </div>
    </Modal>
  )
}

// ── USERS ─────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const toast = useToastStore(s => s.add)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/auth/users'); setUsers(data) }
    catch { toast('Erreur chargement utilisateurs', 'error') }
    finally { setLoading(false) }
  }

  const deleteUser = async (id) => {
    try { await api.delete(`/auth/users/${id}`); toast('Utilisateur supprimé', 'info'); load() }
    catch (err) { toast(err.response?.data?.error || 'Erreur', 'error') }
  }

  const ROLE_COLORS = { admin:'#8b5cf6', stock:'#3b82f6', livraison:'#f59e0b', consultation:'#22c55e' }

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <button className="btn btn-primary" onClick={() => setModal('add')}><UserPlus size={14}/> Nouvel utilisateur</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          {loading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : users.length === 0
              ? <EmptyState icon="👤" title="Aucun utilisateur" />
              : <table>
                  <thead><tr><th>Nom complet</th><th>Identifiant</th><th>Rôle</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight:600 }}>{u.full_name}</td>
                        <td className="mono" style={{ fontSize:12 }}>{u.username}</td>
                        <td>
                          <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                            background: (ROLE_COLORS[u.role] || '#64748b') + '22',
                            color: ROLE_COLORS[u.role] || '#64748b', textTransform:'capitalize' }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{u.last_login ? fmtDate(u.last_login) : '—'}</td>
                        <td>
                          <div style={{ display:'flex', gap:6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setModal(u)}><Pencil size={12}/></button>
                            {u.username !== 'admin' && (
                              <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(u.id)}><Trash2 size={12}/></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          }
        </div>
      </div>
      <UserModal open={!!modal} onClose={() => setModal(null)} data={modal !== 'add' ? modal : null} onSuccess={load} />
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteUser(deleteId)}
        title="Supprimer l'utilisateur" message="Cette action est irréversible." danger />
    </>
  )
}

function UserModal({ open, onClose, data, onSuccess }) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]     = useState('consultation')
  const [loading, setLoading] = useState(false)
  const toast = useToastStore(s => s.add)

  useEffect(() => {
    if (data) { setFullName(data.full_name || ''); setUsername(data.username || ''); setRole(data.role || 'consultation'); setPassword('') }
    else { setFullName(''); setUsername(''); setRole('consultation'); setPassword('') }
  }, [data, open])

  const submit = async () => {
    if (!fullName || !username) return toast('Nom et identifiant requis', 'error')
    if (!data && !password)     return toast('Mot de passe requis', 'error')
    setLoading(true)
    try {
      const body = { full_name: fullName, username, role, ...(password ? { password } : {}) }
      if (data?.id) await api.put(`/auth/users/${data.id}`, body)
      else          await api.post('/auth/users', body)
      toast(data?.id ? '✓ Utilisateur modifié' : '✓ Utilisateur créé', 'success')
      onClose(); onSuccess()
    } catch (err) { toast(err.response?.data?.error || 'Erreur', 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={data ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}>
      <div style={{ marginBottom:14 }}>
        <label className="form-label">Nom complet *</label>
        <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jean Dupont" />
      </div>
      <div style={{ marginBottom:14 }}>
        <label className="form-label">Identifiant *</label>
        <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="jdupont" disabled={!!data} />
      </div>
      <div style={{ marginBottom:14 }}>
        <label className="form-label">{data ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}</label>
        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div style={{ marginBottom:20 }}>
        <label className="form-label">Rôle *</label>
        <select className="select" value={role} onChange={e => setRole(e.target.value)}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
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
