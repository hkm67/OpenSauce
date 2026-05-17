import client from './client'

export const addAchievement = (data) => client.post('/achieve', data)

export const fetchSkillPrompt = (userId, githubRepos) => {
  const params = new URLSearchParams()
  params.set('user_id', userId)
  githubRepos.forEach((repo) => params.append('github_repo', repo))
  return client.get('/skill', { params }).then((r) => r.data)
}

export const getDashboard = (topN = 50) =>
  client.get(`/achievement/dashboard?top_n=${topN}`)

export const getAchievements = (params = {}) =>
  client.get('/achievements', { params })
