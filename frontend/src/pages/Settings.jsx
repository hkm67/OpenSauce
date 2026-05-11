import { useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { addAchievement } from '../api/achievements'
import { getPreferences, setPreferences } from '../api/preferences'
import { CATEGORIES } from '../utils/category'

export default function Settings() {
  const { user } = useAuth()
  const [tab, setTab] = useState('profile')
  const [skillForm, setSkillForm] = useState({ name: '', description: '' })
  const [skillSuccess, setSkillSuccess] = useState('')
  const [skillError, setSkillError] = useState('')

  const [prefs, setPrefs] = useState({ categories: [], notes: '' })
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsStatus, setPrefsStatus] = useState('')

  const tabs = [
    { key: 'profile',       label: 'Profile' },
    { key: 'preferences',   label: 'Preferences' },
    { key: 'api',           label: 'API Keys' },
    { key: 'skills',        label: 'Skills' },
    { key: 'security',      label: 'Security' },
    { key: 'integrations',  label: 'Integrations' },
  ]

  useEffect(() => {
    getPreferences()
      .then((r) => setPrefs(r.data.preferences || { categories: [], notes: '' }))
      .catch(() => {})
      .finally(() => setPrefsLoading(false))
  }, [])

  const togglePrefCategory = (cat) =>
    setPrefs((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }))

  const savePrefs = async () => {
    setPrefsSaving(true)
    setPrefsStatus('')
    try {
      const r = await setPreferences(prefs)
      setPrefs(r.data.preferences || prefs)
      setPrefsStatus('Saved')
      setTimeout(() => setPrefsStatus(''), 1800)
    } catch {
      setPrefsStatus('Failed to save')
    } finally {
      setPrefsSaving(false)
    }
  }

  const handleAddSkill = async (e) => {
    e.preventDefault()
    setSkillError('')
    try {
      await addAchievement(skillForm)
      setSkillSuccess(`Skill "${skillForm.name}" added!`)
      setSkillForm({ name: '', description: '' })
    } catch (err) {
      setSkillError(err.response?.data?.error || 'Failed to add skill')
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-heading font-normal text-factory-black">Settings</h1>
          <p className="text-body-sm text-graphite mt-1">Manage your profile, keys, and integrations.</p>
        </div>

        <div className="flex gap-1 border-b border-cool-gray/30 mb-8">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`pb-3 px-1 mr-5 text-body-sm border-b-2 transition-colors ${
                tab === t.key ? 'border-factory-black text-factory-black' : 'border-transparent text-ash-gray hover:text-factory-black'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-w-xl">
          {tab === 'profile' && (
            <div className="card space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded bg-factory-light-gray border border-cool-gray/40 flex items-center justify-center text-factory-black text-body font-mono">
                  {(user?.name || user?.username || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-body-sm text-factory-black">{user?.name}</p>
                  <p className="text-caption text-ash-gray font-mono">@{user?.username}</p>
                </div>
              </div>
              <div>
                <label className="label">Full name</label>
                <input type="text" className="input" defaultValue={user?.name} />
              </div>
              <div>
                <label className="label">Username</label>
                <input type="text" className="input bg-factory-light-gray text-ash-gray cursor-not-allowed" defaultValue={user?.username} disabled />
                <p className="text-caption text-ash-gray mt-1">Username cannot be changed.</p>
              </div>
              <button className="btn-primary">Save changes</button>
            </div>
          )}

          {tab === 'preferences' && (
            <div className="card space-y-5">
              <div>
                <p className="text-body text-factory-black">Preferred areas</p>
                <p className="text-caption text-ash-gray mt-0.5">
                  Pick the categories you'd like to contribute to. We use these to
                  recommend projects in the marketplace.
                </p>
              </div>

              {prefsLoading ? (
                <p className="text-caption text-ash-gray">Loading…</p>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map((cat) => {
                      const on = prefs.categories.includes(cat)
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => togglePrefCategory(cat)}
                          className={`rounded px-3 py-1 text-caption border transition-colors ${
                            on
                              ? 'bg-factory-black text-faded-silver border-factory-black'
                              : 'bg-transparent text-graphite border-cool-gray hover:border-graphite'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>

                  <div>
                    <label className="label">Notes for the recommender</label>
                    <textarea
                      className="input min-h-[96px]"
                      placeholder="e.g. I prefer Rust + systems work, no JS frameworks please."
                      value={prefs.notes}
                      onChange={(e) => setPrefs((p) => ({ ...p, notes: e.target.value }))}
                      maxLength={1000}
                    />
                    <p className="text-caption text-ash-gray mt-1">
                      {prefs.notes.length}/1000
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={savePrefs}
                      disabled={prefsSaving}
                      className="btn-primary disabled:opacity-60"
                    >
                      {prefsSaving ? 'Saving…' : 'Save preferences'}
                    </button>
                    {prefsStatus && (
                      <span className="text-caption text-ash-gray">{prefsStatus}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'api' && (
            <div className="card space-y-5">
              <div>
                <p className="text-body-sm text-factory-black mb-1">Your API key</p>
                <p className="text-caption text-ash-gray mb-3">Use this key to authenticate the OpenSauce Agent SDK.</p>
                <div className="flex gap-2">
                  <input type="password" className="input flex-1 font-mono" value="sk-opensauce-••••••••••••••••" readOnly />
                  <button className="btn-outline shrink-0">Reveal</button>
                  <button className="btn-outline shrink-0">Copy</button>
                </div>
              </div>
              <div className="border-t border-cool-gray/30 pt-4">
                <p className="text-body-sm text-factory-black mb-2">Regenerate key</p>
                <p className="text-caption text-ash-gray mb-3">This will invalidate your existing key immediately.</p>
                <button className="btn-outline border-red-300 text-red-500 hover:border-red-500">Regenerate API key</button>
              </div>
            </div>
          )}

          {tab === 'skills' && (
            <div className="card">
              <h3 className="text-body-sm text-factory-black mb-4">Add a skill</h3>
              {skillSuccess && (
                <div className="bg-factory-light-gray border border-cool-gray/40 text-factory-black rounded px-4 py-3 text-body-sm mb-4">
                  {skillSuccess}
                </div>
              )}
              {skillError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-body-sm mb-4">{skillError}</div>
              )}
              <form onSubmit={handleAddSkill} className="space-y-3">
                <div>
                  <label className="label">Skill name</label>
                  <input type="text" className="input" placeholder="e.g. Python, React, Rust"
                    value={skillForm.name} onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Description <span className="text-ash-gray">(optional)</span></label>
                  <input type="text" className="input" placeholder="e.g. 3 years professional experience"
                    value={skillForm.description} onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })} />
                </div>
                <button type="submit" className="btn-primary">Add skill</button>
              </form>
            </div>
          )}

          {tab === 'security' && (
            <div className="card space-y-3">
              <p className="text-body-sm text-factory-black">Change password</p>
              <input type="password" className="input" placeholder="Current password" />
              <input type="password" className="input" placeholder="New password" />
              <input type="password" className="input" placeholder="Confirm new password" />
              <button className="btn-primary">Update password</button>
            </div>
          )}

          {tab === 'integrations' && (
            <div className="space-y-3">
              {[
                { name: 'GitHub',  desc: 'Connect to auto-import your repositories.' },
                { name: 'Slack',   desc: 'Receive donation notifications in Slack.' },
                { name: 'Webhook', desc: 'Send events to your own endpoint.' },
              ].map((int) => (
                <div key={int.name} className="card flex items-center justify-between">
                  <div>
                    <p className="text-body-sm text-factory-black">{int.name}</p>
                    <p className="text-caption text-ash-gray">{int.desc}</p>
                  </div>
                  <button className="btn-outline">Connect</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
