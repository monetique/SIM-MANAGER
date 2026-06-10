import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, Eye, EyeOff } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore, useThemeStore, useToastStore } from '../store'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const { dark, toggle } = useThemeStore()
  const toast = useToastStore(s => s.add)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    if (!username || !password) return toast('Remplissez tous les champs', 'error')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { username, password })
      setAuth(data.token, data.user)
      navigate('/')
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur de connexion', 'error')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg)',
      backgroundImage:'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,.05) 0%, transparent 50%)',
      padding:20,
    }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ width:56, height:56, background:'var(--accent)', borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
            <Cpu size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.03em', marginBottom:4 }}>SIM Manager</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>Connectez-vous à votre espace</p>
        </div>

        {/* Form */}
        <div className="card" style={{ borderRadius:16 }}>
          <form onSubmit={submit}>
            <div style={{ marginBottom:16 }}>
              <label className="form-label">Identifiant</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="admin" autoFocus autoComplete="username" />
            </div>
            <div style={{ marginBottom:24 }}>
              <label className="form-label">Mot de passe</label>
              <div style={{ position:'relative' }}>
                <input className="input" type={showPwd ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  style={{ paddingRight:40 }} />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                  position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)',
                }}>
                  {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width:'100%', justifyContent:'center', padding:'11px' }}>
              {loading ? <span className="spinner" style={{width:16,height:16}}/> : 'Se connecter'}
            </button>
          </form>
        </div>

        {/* Theme toggle */}
        <div style={{ textAlign:'center', marginTop:20 }}>
          <button onClick={toggle} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:12 }}>
            {dark ? '☀ Mode clair' : '🌙 Mode sombre'}
          </button>
        </div>
      </div>
    </div>
  )
}
