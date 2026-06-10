import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || null,
  user:  JSON.parse(localStorage.getItem('user') || 'null'),
  setAuth: (token, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ token: null, user: null })
  },
}))

export const useThemeStore = create((set, get) => ({
  dark: localStorage.getItem('theme') !== 'light',
  toggle: () => {
    const next = !get().dark
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
    set({ dark: next })
  },
  init: () => {
    const dark = localStorage.getItem('theme') !== 'light'
    document.documentElement.classList.toggle('dark', dark)
  }
}))

export const useToastStore = create((set, get) => ({
  toasts: [],
  add: (msg, type = 'info') => {
    const id = Date.now()
    set({ toasts: [...get().toasts, { id, msg, type }] })
    setTimeout(() => set({ toasts: get().toasts.filter(t => t.id !== id) }), 3500)
  },
}))
