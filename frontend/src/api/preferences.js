import client from './client'

export const getPreferences = () => client.get('/preferences')

export const setPreferences = (preferences) =>
  client.put('/preferences', preferences)
