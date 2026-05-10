import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getSkills, fetchSkillPrompt } from '../../api/achievements'

const STEPS = ['Select Projects', 'Set Rules', 'Your Prompt']

function extractRepo(url) {
  const m = url.match(/github\.com\/(.+)/)
  return m ? m[1].replace(/\/$/, '') : url
}

export default function ContributionFlow({ projects, onClose }) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [skills, setSkills] = useState([])
  const [selected, setSelected] = useState([])
  const [mode, setMode] = useState('manual')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [maxTokens, setMaxTokens] = useState('')
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

  // Call /skill when entering step 2
  useEffect(() => {
    if (step !== 2) return
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
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const pickRandom = () => {
    const idx = Math.floor(Math.random() * projects.length)
    setSelected([projects[idx].id])
  }

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
  }

  const canNext =
    step === 0 ? selected.length > 0 :
    step === 1 ? (mode === 'manual' ? !!endTime || !!maxTokens : !!startTime && !!endTime) :
    true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-factory-black/40 backdrop-blur-sm p-4">
      <div className="bg-faded-silver border border-cool-gray/40 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cool-gray/40">
          <div>
            <h2 className="text-body text-factory-black">New Contribution Plan</h2>
            <div className="flex items-center gap-2 mt-1.5">
              {STEPS.map((label, i) => (
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
                  {i < STEPS.length - 1 && <span className="text-ash-gray text-caption">›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-ash-gray hover:text-factory-black transition-colors text-body">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 0: Select Projects */}
          {step === 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-body-sm text-graphite">Choose one or more projects to contribute to.</p>
                <button onClick={pickRandom} className="text-caption text-ash-gray hover:text-factory-black transition-colors border border-cool-gray/40 rounded px-3 py-1">
                  Random
                </button>
              </div>
              <div className="space-y-2">
                {projects.map((project) => {
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
                        <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-caption
                          ${active ? 'bg-faded-silver border-faded-silver text-factory-black' : 'border-cool-gray/60'}`}>
                          {active && '✓'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
              {selected.length > 0 && (
                <p className="text-caption text-ash-gray mt-3 font-mono">{selected.length} project{selected.length > 1 ? 's' : ''} selected</p>
              )}
            </div>
          )}

          {/* Step 1: Set Rules */}
          {step === 1 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-body-sm text-factory-black">{mode === 'manual' ? 'Manual' : 'Automatic'}</p>
                  <p className="text-caption text-ash-gray mt-0.5">
                    {mode === 'manual'
                      ? 'Contribution starts when you click Contribute Now.'
                      : 'Contribution runs on the schedule you define.'}
                  </p>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => setMode((m) => m === 'manual' ? 'auto' : 'manual')}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0
                    ${mode === 'auto' ? 'bg-factory-black' : 'bg-cool-gray'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-faded-silver shadow transition-all
                    ${mode === 'auto' ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-4">
                {mode === 'auto' && (
                  <div>
                    <label className="block text-caption text-graphite mb-1.5">Start time</label>
                    <input
                      type="datetime-local"
                      className="input w-full"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-caption text-graphite mb-1.5">End time</label>
                  <input
                    type="datetime-local"
                    className="input w-full"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-caption text-graphite mb-1.5">Max tokens</label>
                  <input
                    type="number"
                    className="input w-full"
                    placeholder="e.g. 10000"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-5 p-3 border border-cool-gray/40 rounded bg-factory-light-gray">
                <p className="text-caption text-graphite">
                  <span className="font-mono text-factory-black">{selectedProjects.length}</span> project{selectedProjects.length > 1 ? 's' : ''} selected:{' '}
                  {selectedProjects.map((p) => extractRepo(p.url)).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Copy Prompt */}
          {step === 2 && (
            <div>
              <p className="text-body-sm text-graphite mb-4">
                Copy this prompt and paste it into your AI agent to start volunteering work.
              </p>
              {assignedIssue && (
                <div className="mb-4 p-3 border border-cool-gray/40 rounded bg-factory-light-gray">
                  <div className="flex items-baseline gap-2">
                    <span className="text-caption text-ash-gray font-mono">Assigned issue</span>
                    <a
                      href={assignedIssue.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-body-sm text-factory-black underline truncate"
                    >
                      #{assignedIssue.number} {assignedIssue.title}
                    </a>
                  </div>
                  {assignedIssue.match_reason && (
                    <p className="text-caption text-graphite mt-1.5">
                      <span className="font-mono text-ash-gray">Why this one →</span>{' '}
                      {assignedIssue.match_reason}
                    </p>
                  )}
                </div>
              )}
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
          {step < 2 ? (
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
