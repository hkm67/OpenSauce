import { useState, useRef, useMemo } from 'react'
import { Loader2, X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { categorizeProject, CATEGORY_COLORS } from '../utils/category'
import html2canvas from 'html2canvas'

function LinkedinIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
}

function InstagramIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  )
}

async function captureElement(el) {
  const prev = { transform: el.style.transform, boxShadow: el.style.boxShadow }
  el.style.transform = 'none'
  el.style.boxShadow = 'none'
  try {
    return await html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true })
  } finally {
    el.style.transform = prev.transform
    el.style.boxShadow = prev.boxShadow
  }
}

async function toFile(canvas, name) {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob], `${name}.png`, { type: 'image/png' })))
  )
}

function extractRepo(url, github_repo) {
  if (github_repo) return github_repo
  if (!url) return null
  const m = url.match(/github\.com\/(.+)/)
  return m ? m[1].replace(/\/$/, '') : url
}

const HEAT_COLORS = ['rgba(255,255,255,0.18)', '#fcd5b8', '#f9a96c', '#f37c2a', '#ef6f2e']
const HEATMAP_WEEKS = 24

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function buildHeatmap(achievements) {
  const today = startOfDay(new Date())
  const start = new Date(today)
  start.setDate(today.getDate() - (HEATMAP_WEEKS * 7 - 1))
  start.setDate(start.getDate() - start.getDay())

  const counts = new Map()
  for (const a of achievements) {
    if (!a.created_at) continue
    const d = startOfDay(a.created_at)
    if (Number.isNaN(d.getTime())) continue
    const key = d.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  let max = 0
  counts.forEach((v) => { if (v > max) max = v })

  const grid = []
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const cell = new Date(start)
      cell.setDate(start.getDate() + w * 7 + d)
      const key = cell.toISOString().slice(0, 10)
      const count = counts.get(key) || 0
      week.push(max === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)))
    }
    grid.push(week)
  }
  return grid
}

const AWARDED_DATE = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

export default function ShareProfileCard({ level, totalContributions, rankIndex, history = [], onClose }) {
  const { user } = useAuth()
  const [tilt, setTilt] = useState({ x: 0, y: 0, rx: 0.5, ry: 0.5 })
  const [hovered, setHovered] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const cardRef = useRef(null)

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const rx = (e.clientX - rect.left) / rect.width
    const ry = (e.clientY - rect.top) / rect.height
    setTilt({ x: (ry - 0.5) * 18, y: (rx - 0.5) * -18, rx, ry })
  }

  const handleMouseEnter = () => setHovered(true)
  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, rx: 0.5, ry: 0.5 })
    setHovered(false)
  }

  const shadowX = tilt.y * 0.6
  const shadowY = tilt.x * 0.6
  const shadowBlur = 50 + Math.abs(tilt.x + tilt.y) * 0.5

  const handleLinkedIn = async (e) => {
    e.stopPropagation()
    setCapturing(true)
    try {
      const canvas = await captureElement(cardRef.current)
      const file = await toFile(canvas, 'opensauce-profile')
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My OpenSauce contribution profile', text: `I've made ${totalContributions} contributions on OpenSauce!` })
        return
      }
    } catch { /* fall through */ } finally { setCapturing(false) }
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank', 'noopener')
  }

  const handleInstagram = async (e) => {
    e.stopPropagation()
    setCapturing(true)
    try {
      const canvas = await captureElement(cardRef.current)
      const a = document.createElement('a')
      a.download = 'opensauce-profile.png'
      a.href = canvas.toDataURL('image/png')
      a.click()
    } finally { setCapturing(false) }
  }

  const displayName = user?.name || user?.username || 'Contributor'
  const recentHistory = history.slice(0, 3)

  const pieData = useMemo(() => {
    if (history.length === 0) return []
    const counts = new Map()
    for (const a of history) {
      const cat = categorizeProject({ url: a.github_repo_url || '', github_repo: a.github_repo || '', description: a.description || '' })
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    const total = history.length
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, value: Math.round((count / total) * 100), color: CATEGORY_COLORS[name] || CATEGORY_COLORS.Other }))
      .sort((a, b) => b.value - a.value)
  }, [history])

  const heatmap = useMemo(() => buildHeatmap(history), [history])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-16 p-6 overflow-hidden"
      style={{ backgroundColor: 'rgba(9,9,11,0.88)' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      <button className="absolute top-6 right-6 text-slate-500 hover:text-slate-200 transition-colors z-10" onClick={onClose}>
        <X className="w-5 h-5" />
      </button>

      {/* Card */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
        className="badge-tilt-card relative z-10 flex flex-col md:flex-row overflow-hidden rounded-2xl items-stretch w-[90vw] min-w-[320px] md:w-[60vw] md:min-w-[760px] md:max-w-[1200px] p-[10px] gap-[10px]"
        style={{
          '--ratio-x': tilt.rx,
          '--ratio-y': tilt.ry,
          transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${hovered ? 1.04 : 1},${hovered ? 1.04 : 1},1)`,
          transition: hovered ? 'box-shadow 0.15s ease' : 'transform 0.4s ease, box-shadow 0.4s ease',
          boxShadow: `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0,0,0,0.7), 0 0 40px rgba(117,228,238,0.2), 0 0 80px rgba(248,95,190,0.12)`,
        }}
      >
        {/* LEFT — Dashboard charts */}
        <div
          className="badge-cert-left relative overflow-hidden rounded-xl flex flex-col justify-between p-5"
          style={{ backgroundColor: '#0d0d0f' }}
        >
          <div className="dot-grid absolute inset-0 opacity-10" />

          <div className="relative flex flex-col gap-5 h-full">
            {/* Title */}
            <p className="font-serif text-2xl font-semibold text-white/90 leading-snug">
              {rankIndex === 0 ? "You're leading the community!" : `You're ranked #${rankIndex + 1}`}
            </p>

            {/* Pie chart */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-3">By Category</p>
              {pieData.length === 0 ? (
                <p className="text-xs text-white/50 italic">No data</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={55} dataKey="value" strokeWidth={0} isAnimationActive={false}>
                        {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-xs text-white/80 truncate">{d.name}</span>
                        <span className="text-xs font-mono text-white/60 ml-auto">{d.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Heatmap */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-white/60">Activity</p>
                <span className="text-[10px] font-mono text-white/50">{totalContributions} total</span>
              </div>
              <div className="flex justify-between w-full">
                {heatmap.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((intensity, di) => (
                      <div key={di} className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: HEAT_COLORS[intensity] }} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[9px] text-white/50">Less</span>
                {HEAT_COLORS.map((c, i) => <div key={i} className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: c }} />)}
                <span className="text-[9px] text-white/50">More</span>
              </div>
            </div>

            {/* Stats row */}
            <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-2">My Stats</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-white/20 rounded-lg p-2.5">
                <p className="text-lg font-mono text-white/90">{rankIndex >= 0 ? `#${rankIndex + 1}` : '—'}</p>
                <p className="text-[9px] font-mono uppercase tracking-wider text-white/60 mt-0.5">Community Rank</p>
              </div>
              <div className="border border-white/20 rounded-lg p-2.5">
                <p className="text-lg font-mono text-code-orange">{totalContributions}</p>
                <p className="text-[9px] font-mono uppercase tracking-wider text-white/60 mt-0.5">Contributions</p>
              </div>
            </div>
            </div>

            {/* OpenSauce watermark */}
            <div className="flex items-center gap-1.5">
              <img src="/icon_OpenSauce.jpeg" alt="OpenSauce" className="w-4 h-4 object-contain rounded-full" />
              <span className="text-[9px] font-mono text-white/60 tracking-wider uppercase">OpenSauce</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Certificate with recent contributions */}
        <div
          className="badge-cert-right flex flex-col justify-between p-6 rounded-xl"
          style={{ backgroundColor: '#fdf8f0' }}
        >
          <div>
            <div className="mb-3">
              <p className="text-xs tracking-[0.2em] uppercase text-[#a49d9a] font-mono">
                OpenSauce ·<br />Certificate of Achievement
              </p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-px flex-1 bg-[#d4cfc9]" />
                <span className="text-[#c8b89a] text-xs">✦</span>
                <div className="h-px flex-1 bg-[#d4cfc9]" />
              </div>
            </div>

            <p className="text-base text-[#3d3a39] mb-3">
              Dear <span className="font-serif font-semibold text-lg">{displayName}</span>,
            </p>
            <p className="text-body-sm text-[#6b6460] leading-relaxed mb-4">
              Thank you for volunteering with OpenSauce. Here are your latest contributions:
            </p>

            <div className="space-y-2">
              {recentHistory.length === 0 ? (
                <p className="text-caption text-[#a49d9a] italic">No contributions yet.</p>
              ) : recentHistory.map((item, i) => {
                const project = extractRepo(item.url || item.github_repo_url, item.github_repo)
                return (
                  <div key={item.id || i} className="rounded-lg border border-[#e8e2da] px-3 py-2.5" style={{ backgroundColor: '#fff' }}>
                    <p className="text-body-sm font-medium text-[#3d3a39] leading-snug">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-[#6b6460] leading-relaxed mt-0.5 line-clamp-1">{item.description}</p>
                    )}
                    {project && (
                      <p className="text-[10px] font-mono text-code-orange mt-1">{project}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-t pt-3 mt-4" style={{ borderColor: '#e8e2da' }}>
            <p className="text-xs text-[#a49d9a] font-mono mb-0.5">Generated on {AWARDED_DATE}</p>
            <p className="text-base font-semibold text-[#3d3a39] tracking-wide">OpenSauce</p>
            <div className="mt-1 w-16 h-px" style={{ backgroundColor: '#3d3a39' }} />
          </div>
        </div>
      </div>

      {/* Share buttons */}
      <div className="relative z-10 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleLinkedIn}
          disabled={capturing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: '#0A66C2' }}
        >
          {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkedinIcon className="w-4 h-4" />}
          Share on LinkedIn
        </button>
      </div>
    </div>
  )
}
