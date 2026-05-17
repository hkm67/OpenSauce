import { useState, useRef, useEffect } from 'react'
import { Download, Loader2, Share2, X } from 'lucide-react'
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
  const [showMenu, setShowMenu] = useState(false)
  const cardRef = useRef(null)
  const shareCardRef = useRef(null)
  const desktopShareRef = useRef(null)
  const isDragging = useRef(false)

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

  const handleTouchEnd = () => {
    isDragging.current = false
  }

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const onTouchMove = (e) => {
      e.preventDefault()
      isDragging.current = true
      const touch = e.touches[0]
      const rect = card.getBoundingClientRect()
      const rx = (touch.clientX - rect.left) / rect.width
      const ry = (touch.clientY - rect.top) / rect.height
      setTilt({ x: (ry - 0.5) * 18, y: (rx - 0.5) * -18, rx, ry })
      setHovered(true)
    }
    card.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => card.removeEventListener('touchmove', onTouchMove)
  }, [])

  useEffect(() => {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
    if (!isTouchDevice) return

    const applyOrientation = (e) => {
      if (isDragging.current) return
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

  const captureAndShare = async (isMobile) => {
    setCapturing(true)
    try {
      const target = isMobile ? shareCardRef.current : desktopShareRef.current
      const canvas = await captureElement(target)
      const file = await toFile(canvas, `${badge.name}-badge`)
      if (isMobile && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `I earned the "${badge.name}" badge on OpenSauce!`, text: badge.description })
        return
      }
      const a = document.createElement('a')
      a.download = `${badge.name}-badge.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } catch { /* user cancelled */ } finally { setCapturing(false) }
  }

  const handleShareClick = (e) => {
    e.stopPropagation()
    const isMobile = window.matchMedia('(pointer: coarse)').matches
    if (isMobile) {
      captureAndShare(true)
    } else {
      setShowMenu((v) => !v)
    }
  }

  const handleDownload = (e) => {
    e.stopPropagation()
    setShowMenu(false)
    captureAndShare(false)
  }

  const handleLinkedIn = (e) => {
    e.stopPropagation()
    setShowMenu(false)
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
      onClick={() => { setShowMenu(false); onClose() }}
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
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
        className="badge-tilt-card relative z-10 flex flex-col md:grid md:grid-cols-[55%_1fr] overflow-hidden rounded-2xl w-[80vw] min-w-[280px] md:w-[60vw] md:min-w-[760px] md:max-w-[1200px] p-[10px] gap-[10px]"
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
            className="w-full h-full object-cover object-center"
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
          className={`badge-cert-right flex flex-col p-3 md:p-6 rounded-xl ${badge.earned ? 'justify-between' : 'justify-center'}`}
          style={{ backgroundColor: '#fdf8f0' }}
        >
          {badge.earned ? (
            <>
              {/* Header */}
              <div>
                <div className="mb-3">
                  <p className="text-[9px] md:text-xs tracking-[0.2em] uppercase text-[#a49d9a] font-mono">
                    OpenSauce ·<br />Certificate of Achievement
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-px flex-1 bg-[#d4cfc9]" />
                    <span className="text-[#c8b89a] text-xs">✦</span>
                    <div className="h-px flex-1 bg-[#d4cfc9]" />
                  </div>
                </div>

                {/* Letter body */}
                <p className="text-sm md:text-base text-[#3d3a39] mb-2 md:mb-3">
                  Dear <span className="font-serif font-semibold text-base md:text-lg">{displayName}</span>,
                </p>
                <p className="text-xs md:text-body-sm text-[#6b6460] leading-relaxed mb-2 md:mb-3">
                  Thank you for volunteering with OpenSauce.
                </p>
                <p className="text-xs md:text-body-sm text-[#6b6460] leading-relaxed mb-1">
                  You've earned the{' '}
                  <span className="font-serif font-semibold text-[#3d3a39]">{badge.name}</span> badge —
                </p>
                <p className="text-xs md:text-body-sm text-[#6b6460] italic leading-relaxed mb-3 md:mb-4">
                  {badge.description}
                </p>

                {/* Progress bar — hidden for threshold-0 badges */}
                {badge.threshold > 0 && (
                  <>
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
                  </>
                )}
              </div>

              {/* Footer — signature */}
              <div className="border-t pt-3 md:pt-4" style={{ borderColor: '#e8e2da' }}>
                <div className="flex items-end justify-between mt-0 md:mt-3">
                  <div>
                    <p className="text-[9px] md:text-xs text-[#a49d9a] font-mono mb-0.5">Awarded on {AWARDED_DATE}</p>
                    <p className="text-sm md:text-base font-semibold text-[#3d3a39] tracking-wide">OpenSauce</p>
                    <div className="mt-1 w-16 h-px" style={{ backgroundColor: '#3d3a39' }} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Unearned — progress only */
            <div className="flex flex-col justify-center gap-3 flex-1">
              <div>
                <p className="font-serif font-semibold text-base md:text-xl text-[#3d3a39] mb-1">{badge.name}</p>
                <p className="text-xs md:text-body-sm text-[#6b6460] italic">{badge.description}</p>
              </div>
              {badge.threshold > 0 && <div>
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
              </div>}
            </div>
          )}
        </div>
      </div>

      {/* Share buttons below card — only shown when badge is earned */}
      {badge.earned && (
        <div className="relative z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Mobile: share + download buttons */}
          <button
            onClick={handleShareClick}
            disabled={capturing}
            className="md:hidden btn-outline flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50 !text-white !border-white/60 hover:!border-white"
          >
            {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            <span>Share</span>
          </button>

          {/* Desktop: two separate buttons */}
          <button
            onClick={handleLinkedIn}
            className="hidden md:flex items-center gap-2 btn-outline px-4 py-2 text-sm !text-white !border-white/60 hover:!border-white"
          >
            <LinkedinIcon className="w-4 h-4" />
            Share on LinkedIn
          </button>
          <button
            onClick={handleDownload}
            disabled={capturing}
            className="hidden md:flex items-center gap-2 btn-outline px-4 py-2 text-sm disabled:opacity-50 !text-white !border-white/60 hover:!border-white"
          >
            {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </button>
        </div>
      )}

      {/* Shared hidden card content renderer */}
      {[
        { ref: shareCardRef,   width: 390, col: true  },
        { ref: desktopShareRef, width: 820, col: false },
      ].map(({ ref, width, col }) => (
        <div key={width} ref={ref} style={{
          position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1,
          width: `${width}px`, padding: '40px',
          backgroundColor: '#f5f0e8',
          backgroundImage: 'linear-gradient(rgba(180,160,130,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(180,160,130,0.3) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}>
          {/* Card */}
          <div style={{
            display: 'flex', flexDirection: col ? 'column' : 'row',
            borderRadius: '16px', padding: '10px', gap: '10px',
            background: 'linear-gradient(45deg, #75e4ee, #f85fbe)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            {/* Image panel */}
            <div style={{ width: col ? '100%' : '55%', aspectRatio: col ? '1/1' : '1/1', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', flexShrink: 0 }}>
              <img src={awardImage} alt={badge.name} crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {/* Certificate panel */}
            <div style={{ flex: 1, backgroundColor: '#fdf8f0', borderRadius: '12px', padding: col ? '20px' : '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <p style={{ fontSize: col ? '9px' : '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a49d9a', fontFamily: 'monospace', marginBottom: '6px' }}>
                  OpenSauce · Certificate of Achievement
                </p>
                <div style={{ height: '1px', backgroundColor: '#d4cfc9', marginBottom: col ? '12px' : '16px' }} />
                <p style={{ fontSize: col ? '14px' : '16px', color: '#3d3a39', marginBottom: col ? '8px' : '12px' }}>
                  Dear <strong style={{ fontFamily: 'serif', fontSize: col ? '16px' : '18px' }}>{displayName}</strong>,
                </p>
                <p style={{ fontSize: col ? '12px' : '14px', color: '#6b6460', marginBottom: col ? '6px' : '10px' }}>Thank you for volunteering with OpenSauce.</p>
                <p style={{ fontSize: col ? '12px' : '14px', color: '#6b6460', marginBottom: '3px' }}>
                  You've earned the <strong style={{ fontFamily: 'serif', color: '#3d3a39' }}>{badge.name}</strong> badge —
                </p>
                <p style={{ fontSize: col ? '12px' : '14px', color: '#6b6460', fontStyle: 'italic', marginBottom: badge.threshold > 0 ? '12px' : '0' }}>{badge.description}</p>
                {badge.threshold > 0 && <>
                  <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#a49d9a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Progress</p>
                  <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: '#e8e2da', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '9999px', backgroundColor: '#FF6347', width: `${Math.min(100, Math.round((contributions / badge.threshold) * 100))}%` }} />
                  </div>
                </>}
              </div>
              <div style={{ borderTop: '1px solid #e8e2da', paddingTop: '12px' }}>
                <p style={{ fontSize: '10px', color: '#a49d9a', fontFamily: 'monospace', marginBottom: '3px' }}>Awarded on {AWARDED_DATE}</p>
                <p style={{ fontSize: col ? '14px' : '16px', fontWeight: '600', color: '#3d3a39', letterSpacing: '0.05em' }}>OpenSauce</p>
                <div style={{ marginTop: '4px', width: '48px', height: '1px', backgroundColor: '#3d3a39' }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
