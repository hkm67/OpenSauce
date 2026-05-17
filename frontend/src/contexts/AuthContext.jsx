import { createContext, useContext, useState, useCallback } from 'react'
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
} from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email, password) => {
    const res = await apiLogin({ email, password })
    const { oauth_token, user } = res.data
    localStorage.setItem('token', oauth_token)
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
    return user
  }, [])

  const signup = useCallback(async (name, username, email, password) => {
    const res = await apiSignup({ name, username, email, password })
    const { oauth_token, user } = res.data
    localStorage.setItem('token', oauth_token)
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
    return user
  }, [])

  const completeOAuthLogin = useCallback(async (token) => {
    localStorage.setItem('token', token)
    const res = await getCurrentUser()
    const { user } = res.data
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    apiLogout().catch(() => {})
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading: false, login, signup, logout, completeOAuthLogin, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
