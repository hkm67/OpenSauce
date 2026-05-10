import client from './client'

export const getSkills = () => client.get('/skill')

export const addAchievement = (data) => client.post('/achieve', data)
