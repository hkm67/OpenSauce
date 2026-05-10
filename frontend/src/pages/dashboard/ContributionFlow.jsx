import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getSkills, fetchSkillPrompt, addAchievement } from '../../api/achievements'

const STEPS_DEFAULT  = ['Select Projects', 'Your Prompt']
const STEPS_PRESELECT = ['Project', 'Your Prompt']

const CATEGORIES = ['All', 'Infrastructure', 'Dev Tools', 'AI / ML', 'Security', 'Frontend', 'Backend']

const CATEGORY_KEYWORDS = {
  'Infrastructure': ['infrastructure', 'devops', 'cloud', 'kubernetes', 'docker', 'container', 'server', 'deploy', 'platform'],
  'Dev Tools':      ['tool', 'cli', 'sdk', 'ide', 'editor', 'build', 'lint', 'test', 'debug', 'workflow', 'automation'],
  'AI / ML':        ['ai', 'ml', 'machine learning', 'neural', 'model', 'llm', 'gpt', 'vector', 'embedding', 'data'],
  'Security':       ['security', 'auth', 'crypto', 'encryption', 'ssl', 'tls', 'vulnerability', 'permission', 'oauth'],
  'Frontend':       ['frontend', 'ui', 'react', 'vue', 'angular', 'css', 'html', 'web', 'design', 'component', 'interface'],
  'Backend':        ['backend', 'api', 'database', 'db', 'sql', 'rest', 'graphql', 'microservice', 'service', 'notification'],
}

function extractRepo(url) {
  const m = url.match(/github\.com\/(.+)/)
  return m ? m[1].replace(/\/$/, '') : url
}

export default function ContributionFlow({ projects, onClose, preselect = null }) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [skills, setSkills] = useState([])
  const [selected, setSelected] = useState(preselect ? [preselect] : [])
  const [category, setCategory] = useState('All')
  const [copied, setCopied] = useState(false)
  const [cursorOpened, setCursorOpened] = useState(false)
  const [skillLoading, setSkillLoading] = useState(false)
  const [skillError, setSkillError] = useState('')
  const [skillPrompt, setSkillPrompt] = useState('')
  const [magicUrl, setMagicUrl] = useState('')
  const [assignedIssue, setAssignedIssue] = useState(null)

  useEffect(() => {
    getSkills().then((r) => setSkills(r.data.skills || [])).catch(() => {})
  }, [])

  // Call /skill when entering step 1
  useEffect(() => {
    if (step !== 1) return
    setSkillLoading(true)
    setSkillError('')
    setSkillPrompt('')
    setMagicUrl('')
    setAssignedIssue(null)
    fetchSkillPrompt(user?.id, selected)
      .then((data) => {
        if (data.error) { setSkillError(data.error); return }
        setSkillPrompt(data.prompt || '')
        setMagicUrl(data.magic_url || '')
        setAssignedIssue(data.assigned_issue || null)
      })
      .catch(() => setSkillError('Failed to reach backend. Is the server running?'))
      .finally(() => setSkillLoading(false))
  }, [step, selected, user?.id])

  const skillKeywords = skills.flatMap((s) =>
    (s.skill || s.name || '').toLowerCase().split(/[\s,/]+/)
  )
  const isRecommended = (project) => {
    if (skillKeywords.length === 0) return false
    const haystack = (project.url + ' ' + project.description).toLowerCase()
    return skillKeywords.some((kw) => kw.length > 2 && haystack.includes(kw))
  }

  const toggleProject = (id) =>
    setSelected((prev) => prev.includes(id) ? [] : [id])

  const pickRandom = () => {
    const idx = Math.floor(Math.random() * projects.length)
    setSelected([projects[idx].id])
  }

  const filteredProjects = (category === 'All' ? projects : projects.filter((p) => {
    const haystack = (p.url + ' ' + p.description).toLowerCase()
    return (CATEGORY_KEYWORDS[category] || []).some((kw) => haystack.includes(kw))
  })).slice().sort((a, b) => (isRecommended(b) ? 1 : 0) - (isRecommended(a) ? 1 : 0))

  const selectedProjects = projects.filter((p) => selected.includes(p.id))

  const selectedRepoNames = selectedProjects.map((p) => extractRepo(p.url)).join(', ')
  const agentPrompt = magicUrl
    ? `Start an OpenSauce contribution for ${selectedRepoNames || 'the selected open source project'} at ${magicUrl}`
    : skillPrompt
  const cursorPrompt = agentPrompt

  const copyPrompt = () => {
    if (!agentPrompt) return
    navigator.clipboard.writeText(agentPrompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const openInCursor = () => {
    if (!cursorPrompt) return
    navigator.clipboard.writeText(cursorPrompt)
    const cursorUrl = `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(cursorPrompt)}`
    window.open(cursorUrl, '_self')
    setCursorOpened(true)
    setTimeout(() => setCursorOpened(false), 2000)

    const project = selectedProjects[0]
    addAchievement({
      name: 'Contribution Plan Started',
      project_id: project?.id ?? undefined,
      description: cursorPrompt,
      url: magicUrl || undefined,
    }).catch(() => {})
  }

  const canNext = step === 0 ? selected.length > 0 : true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-factory-black/40 backdrop-blur-sm p-4">
      <div className="bg-faded-silver border border-cool-gray/40 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cool-gray/40">
          <div>
            <h2 className="text-body text-factory-black">New Contribution Plan</h2>
            <div className="flex items-center gap-2 mt-1.5">
              {(preselect ? STEPS_PRESELECT : STEPS_DEFAULT).map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-caption font-mono
                      ${i < step ? 'bg-factory-black text-faded-silver' :
                        i === step ? 'bg-factory-black text-faded-silver' :
                        'border border-cool-gray/60 text-ash-gray'}`}>
                      {i < step ? '✓' : i + 1}
                    </span>
                    <span className={`text-caption ${i === step ? 'text-factory-black' : 'text-ash-gray'}`}>{label}</span>
                  </div>
                  {i < (preselect ? STEPS_PRESELECT : STEPS_DEFAULT).length - 1 && <span className="text-ash-gray text-caption">›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-ash-gray hover:text-factory-black transition-colors text-body">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 0: Project info (preselect) or Select Projects */}
          {step === 0 && preselect && (() => {
            const p = projects.find((p) => p.id === preselect)
            if (!p) return null
            return (
              <div className="flex flex-col gap-4">
                <p className="text-body-sm text-graphite">You're contributing to this project.</p>
                <div className="border border-cool-gray/40 rounded p-5 bg-factory-light-gray">
                  <p className="text-body font-mono text-factory-black mb-1">{extractRepo(p.url)}</p>
                  <a href={p.url} target="_blank" rel="noreferrer"
                    className="text-caption text-ash-gray hover:text-factory-black transition-colors font-mono mb-3 block">
                    {p.url}
                  </a>
                  <p className="text-body-sm text-graphite leading-relaxed">{p.description}</p>
                </div>
              </div>
            )
          })()}

          {step === 0 && !preselect && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-body-sm text-graphite">Choose a project to contribute to.</p>
                <button onClick={pickRandom} className="text-caption text-ash-gray hover:text-factory-black transition-colors border border-cool-gray/40 rounded px-3 py-1">
                  Random
                </button>
              </div>

              {/* Category tabs */}
              <div className="flex gap-1.5 flex-wrap mb-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded px-3 py-1 text-caption border transition-colors ${
                      category === cat
                        ? 'bg-factory-black text-faded-silver border-factory-black'
                        : 'bg-transparent text-graphite border-cool-gray/40 hover:border-graphite'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredProjects.length === 0 ? (
                  <p className="text-body-sm text-ash-gray text-center py-8">No projects in this category.</p>
                ) : null}
                {filteredProjects.map((project) => {
                  const rec = isRecommended(project)
                  const active = selected.includes(project.id)
                  return (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className={`w-full text-left rounded border px-4 py-3 transition-colors
                        ${active
                          ? 'bg-factory-black text-faded-silver border-factory-black'
                          : 'bg-transparent border-cool-gray/40 hover:border-cool-gray text-factory-black'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-body-sm font-mono">{extractRepo(project.url)}</span>
                            {rec && !active && (
                              <span className="text-caption border border-cool-gray/40 rounded px-1.5 py-0.5 text-ash-gray">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className={`text-caption line-clamp-1 ${active ? 'text-faded-silver/70' : 'text-graphite'}`}>
                            {project.description}
                          </p>
                        </div>
                        <span className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center
                          ${active ? 'border-faded-silver' : 'border-cool-gray/60'}`}>
                          {active && <span className="w-2 h-2 rounded-full bg-faded-silver" />}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 1: Copy Prompt */}
          {step === 1 && (
            <div>
              <p className="text-body-sm text-graphite mb-4">
                Copy this prompt and paste it into your AI agent to start volunteering work.
              </p>
              {skillLoading ? (
                <div className="bg-factory-light-gray border border-cool-gray/40 rounded p-4 text-caption text-ash-gray font-mono animate-pulse">
                  Generating prompt…
                </div>
              ) : skillError ? (
                <div className="bg-factory-light-gray border border-cool-gray/40 rounded p-4 text-caption text-red-600 font-mono">
                  {skillError}
                </div>
              ) : (
                <div className="relative">
                  <pre className="bg-factory-light-gray border border-cool-gray/40 rounded p-4 text-caption text-factory-black font-mono whitespace-pre-wrap break-all leading-relaxed">
                    {agentPrompt}
                  </pre>
                  {magicUrl && (
                    <p className="text-caption text-ash-gray mt-3">
                      The link opens a generated SKILL.md with a temporary token scoped to the selected project.
                    </p>
                  )}
                  <button
                    onClick={copyPrompt}
                    className={`absolute top-3 right-3 text-caption border rounded px-2.5 py-1 transition-colors
                      ${copied
                        ? 'bg-factory-black text-faded-silver border-factory-black'
                        : 'bg-faded-silver text-factory-black border-cool-gray/40 hover:border-cool-gray'}`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-cool-gray/40">
          <button
            onClick={() => step === 0 ? onClose() : setStep((s) => s - 1)}
            className="btn-outline px-4 py-2 text-body-sm"
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 1 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className={`px-4 py-2 text-body-sm rounded transition-colors
                  ${canNext
                    ? 'bg-factory-black text-faded-silver hover:bg-factory-black/80'
                    : 'bg-cool-gray text-ash-gray cursor-not-allowed'}`}
              >
                Next
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={openInCursor}
                disabled={!cursorPrompt}
                className={`btn-outline px-4 py-2 text-body-sm transition-colors ${!cursorPrompt ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {cursorOpened ? 'Opening…' : 'Open Cursor'}
              </button>
              <button
                onClick={onClose}
                className="bg-factory-black text-faded-silver px-4 py-2 text-body-sm rounded hover:bg-factory-black/80 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
