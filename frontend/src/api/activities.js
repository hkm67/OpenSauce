import client from './client'

export const createActivity = (data) => client.post('/activity', data)
