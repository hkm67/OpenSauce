import client from './client'

export const signup = (data) => client.post('/user', data)

export const login = (data) => client.post('/login', data)

export const getCurrentUser = () => client.get('/user')

export const logout = () => client.post('/logout')

export const resetPassword = (email) => client.post('/reset-password', { email })

export const healthCheck = () => client.get('/health')
