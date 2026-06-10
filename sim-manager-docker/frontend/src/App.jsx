import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, useThemeStore } from './store'
import { ToastContainer } from './components/ui'
import Sidebar from './components/layout/Sidebar'
import Login      from './pages/Login'
import Dashboard  from './pages/Dashboard'
import Stock      from './pages/Stock'
import Livraison  from './pages/Livraison'
import Historique from './pages/Historique'
import Stats      from './pages/Stats'
import Config     from './pages/Config'

function RequireAuth({ children }) {
  const token = useAuthStore(s => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function Layout({ children }) {
  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar />
      <main style={{ flex:1, padding:'28px 32px', overflowY:'auto', minWidth:0 }}>
        {children}
      </main>
    </div>
  )
}

export default function App() {
  const { init } = useThemeStore()
  useEffect(() => { init() }, [])

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
        <Route path="/stock" element={<RequireAuth><Layout><Stock /></Layout></RequireAuth>} />
        <Route path="/livraison" element={<RequireAuth><Layout><Livraison /></Layout></RequireAuth>} />
        <Route path="/historique" element={<RequireAuth><Layout><Historique /></Layout></RequireAuth>} />
        <Route path="/stats" element={<RequireAuth><Layout><Stats /></Layout></RequireAuth>} />
        <Route path="/config" element={<RequireAuth><Layout><Config /></Layout></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  )
}
