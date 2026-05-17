import { useState, useRef, useEffect } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
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

const AWARDED_DATE = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

export default function BadgeTiltCard({ badge, contributions = 0, onClose }) {
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

  useEffect(() => {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
    if (!isTouchDevice) return

    const applyOrientation = (e) => {
      const gamma = Math.max(-45, Math.min(45, e.gamma || 0))
      const beta  = Math.max(-45, Math.min(45, (e.beta || 0) - 45))
      setTilt({ x: (beta / 45) * 12, y: (gamma / 45) * -12, rx: 0.5, ry: 0.5 })
      setHovered(true)
    }

    const start = async () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try { await DeviceOrientationEvent.requestPermission() } catch { return }
      }
      window.addEventListener('deviceorientation', applyOrientation)
    }

    start()
    return () => window.removeEventListener('deviceorientation', applyOrientation)
  }, [])

  const shadowX = tilt.y * 0.6
  const shadowY = tilt.x * 0.6
  const shadowBlur = 50 + Math.abs(tilt.x + tilt.y) * 0.5

  const handleLinkedIn = async (e) => {
    e.stopPropagation()
    setCapturing(true)
    try {
      const canvas = await captureElement(cardRef.current)
      const file = await toFile(canvas, `${badge.name}-badge`)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `I earned the "${badge.name}" badge!`, text: badge.description })
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
      a.download = `${badge.name}-badge.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } finally { setCapturing(false) }
  }

  async function toFile(canvas, name) {
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(new File([blob], `${name}.png`, { type: 'image/png' })))
    )
  }

  const displayName = user?.name || user?.username || 'Contributor'

  // Map /tomato_N.png → /awardN.jpg
  const awardImage = badge.image?.replace(/\/tomato_(\d+)\.png$/, '/award$1.jpg') || badge.image

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 md:gap-16 p-6 overflow-hidden"
      style={{ backgroundColor: 'rgba(9,9,11,0.88)' }}
      onClick={onClose}
    >
      {/* Grid backdrop */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      {/* Close button */}
      <button
        className="absolute top-6 right-6 text-slate-500 hover:text-slate-200 transition-colors z-10"
        onClick={onClose}
      >
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
        {/* ── LEFT — Key Visual ── */}
        <div
          className="badge-cert-left relative overflow-hidden rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#fff' }}
        >
          <img
            src={awardImage}
            alt={badge.name}
            crossOrigin="anonymous"
            className="w-full object-contain object-center"
            style={badge.earned ? {} : { filter: 'grayscale(1) brightness(0.85)' }}
          />

          {/* OpenSauce logo watermark bottom-left */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/70 backdrop-blur-sm rounded-full px-2 py-1">
            <img src="/icon_OpenSauce.jpeg" alt="OpenSauce" className="w-4 h-4 object-contain rounded-full" />
            <span className="text-[9px] font-mono text-[#3d3a39] tracking-wider">OpenSauce</span>
          </div>

          {!badge.earned && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
              <span className="text-3xl">🔒</span>
            </div>
          )}
        </div>

        {/* ── RIGHT — Certificate Letter ── */}
        <div
          className="badge-cert-right flex flex-col justify-between p-6 rounded-xl"
          style={{ backgroundColor: '#fdf8f0' }}
        >
          {badge.earned ? (
            <>
              {/* Header */}
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

                {/* Letter body */}
                <p className="text-base text-[#3d3a39] mb-3">
                  Dear <span className="font-serif font-semibold text-lg">{displayName}</span>,
                </p>
                <p className="text-body-sm text-[#6b6460] leading-relaxed mb-3">
                  Thank you for volunteering with OpenSauce.
                </p>
                <p className="text-body-sm text-[#6b6460] leading-relaxed mb-1">
                  You've earned the{' '}
                  <span className="font-serif font-semibold text-[#3d3a39]">{badge.name}</span> badge —
                </p>
                <p className="text-body-sm text-[#6b6460] italic leading-relaxed mb-4">
                  {badge.description}
                </p>

                {/* Progress bar */}
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-mono text-[#a49d9a] uppercase tracking-wider">Progress</span>
                  <span className="text-xs font-mono text-[#3d3a39]">
                    {Math.min(contributions, badge.threshold)} / {badge.threshold}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ backgroundColor: '#e8e2da' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((contributions / badge.threshold) * 100))}%`, backgroundColor: '#FF6347' }}
                  />
                </div>
              </div>

              {/* Footer — signature */}
              <div className="border-t pt-3" style={{ borderColor: '#e8e2da' }}>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-xs text-[#a49d9a] font-mono mb-0.5">Awarded on {AWARDED_DATE}</p>
                    <p className="text-base font-semibold text-[#3d3a39] tracking-wide">OpenSauce</p>
                    <div className="mt-1 w-16 h-px" style={{ backgroundColor: '#3d3a39' }} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Unearned — progress only */
            <div className="flex flex-col justify-center h-full gap-3">
              <div>
                <p className="font-serif font-semibold text-xl text-[#3d3a39] mb-1">{badge.name}</p>
                <p className="text-body-sm text-[#6b6460] italic">{badge.description}</p>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-mono text-[#a49d9a] uppercase tracking-wider">Progress</span>
                  <span className="text-xs font-mono text-[#3d3a39]">
                    {Math.min(contributions, badge.threshold)} / {badge.threshold}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e8e2da' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((contributions / badge.threshold) * 100))}%`, backgroundColor: '#a49d9a' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share buttons below card — only shown when badge is earned */}
      {badge.earned && <div className="relative z-10 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleLinkedIn}
          disabled={capturing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: '#0A66C2' }}
        >
          {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkedinIcon className="w-4 h-4" />}
          Share on LinkedIn
        </button>
      </div>}
    </div>
  )
}
