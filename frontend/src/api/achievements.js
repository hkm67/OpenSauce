import client from './client'

export const getSkills = () => client.get('/skills')

export const addAchievement = (data) => client.post('/achieve', data)

export const fetchSkillPrompt = (userId, projectIds) => {
  const params = new URLSearchParams()
  params.set('user_id', userId)
  projectIds.forEach((id) => params.append('project_id', id))
  return client.get('/skill', { params }).then((r) => r.data)
}

export const getDashboard = (topN = 50) =>
  client.get(`/achievement/dashboard?top_n=${topN}`)
