import client from './client'

export const getSkills = () => client.get('/skill')

export const addAchievement = (data) => client.post('/achieve', data)

export const fetchSkillPrompt = (userId, projectIds) => {
  const url = new URL('http://localhost:8000/skill')
  url.searchParams.set('user_id', userId)
  projectIds.forEach((id) => url.searchParams.append('project_id', id))
  return fetch(url).then((r) => r.json())
}

export const getDashboard = (topN = 50) =>
  client.get(`/achievement/dashboard?top_n=${topN}`)
