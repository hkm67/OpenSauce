import client from './client'

export const searchGithubRepos = (query, limit = 20, page = 1) =>
  client.get('/github/search', { params: { q: query, limit, page } })

export const getGithubRepo = (githubRepo) =>
  client.get(`/github/repos/${githubRepo}`)
