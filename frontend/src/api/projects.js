import client from './client'

export const getProjects = () => client.get('/projects')

export const createProject = (data) => client.post('/project', data)

export const deleteProject = (id) => client.delete('/project', { data: { id } })

export const recommendProjects = (body = {}) =>
  client.post('/projects/recommend', body)
