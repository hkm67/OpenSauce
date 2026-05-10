import { createContext, useContext, useState, useCallback } from 'react'
import { login as apiLogin, signup as apiSignup } from '../api/auth'

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

  const login = useCallback(async (username, password) => {
    const res = await apiLogin({ username, password })
    const { oauth_token, user } = res.data
    localStorage.setItem('token', oauth_token)
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
    return user
  }, [])

  const signup = useCallback(async (name, username, password) => {
    await apiSignup({ name, username, password })
    return login(username, password)
  }, [login])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
