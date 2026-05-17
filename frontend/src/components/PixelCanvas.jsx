import { useEffect, useRef } from 'react'

class Pixel {
  constructor(canvas, context, x, y, color, speed, delay) {
    this.width = canvas.width
    this.height = canvas.height
    this.ctx = context
    this.x = x
    this.y = y
    this.color = color
    this.speed = (Math.random() * 0.8 + 0.1) * speed
    this.size = 0
    this.sizeStep = Math.random() * 0.4
    this.minSize = 0.5
    this.maxSizeInteger = 2
    this.maxSize = Math.random() * (2 - 0.5) + 0.5
    this.delay = delay
    this.counter = 0
    this.counterStep = Math.random() * 4 + (canvas.width + canvas.height) * 0.01
    this.isIdle = false
    this.isReverse = false
    this.isShimmer = false
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5
    this.ctx.fillStyle = this.color
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size)
  }

  appear() {
    this.isIdle = false
    if (this.counter <= this.delay) { this.counter += this.counterStep; return }
    if (this.size >= this.maxSize) this.isShimmer = true
    if (this.isShimmer) this.shimmer()
    else this.size += this.sizeStep
    this.draw()
  }

  disappear() {
    this.isShimmer = false
    this.counter = 0
    if (this.size <= 0) { this.isIdle = true; return }
    else this.size -= 0.1
    this.draw()
  }

  shimmer() {
    if (this.size >= this.maxSize) this.isReverse = true
    else if (this.size <= this.minSize) this.isReverse = false
    if (this.isReverse) this.size -= this.speed
    else this.size += this.speed
  }
}

export default function PixelCanvas({ colors = ['#75e4ee', '#f85fbe', '#ffffff'], gap = 6, speed = 35, autoPlay = false, className = '' }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ pixels: [], animation: null, timePrevious: performance.now() })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const state = stateRef.current
    const timeInterval = 1000 / 60
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const speedVal = reducedMotion ? 0 : Math.max(0, Math.min(100, speed)) * 0.001

    function getDistanceToBottomLeft(x, y) {
      const dx = x
      const dy = canvas.height - y
      return Math.sqrt(dx * dx + dy * dy)
    }

    function createPixels() {
      state.pixels = []
      for (let x = 0; x < canvas.width; x += gap) {
        for (let y = 0; y < canvas.height; y += gap) {
          const color = colors[Math.floor(Math.random() * colors.length)]
          const delay = reducedMotion ? 0 : getDistanceToBottomLeft(x, y)
          state.pixels.push(new Pixel(canvas, ctx, x, y, color, speedVal, delay))
        }
      }
    }

    function handleAnimation(name) {
      if (state.animation) cancelAnimationFrame(state.animation)
      const animate = () => {
        state.animation = requestAnimationFrame(animate)
        const timeNow = performance.now()
        const timePassed = timeNow - state.timePrevious
        if (timePassed < timeInterval) return
        state.timePrevious = timeNow - (timePassed % timeInterval)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        let allIdle = true
        for (const pixel of state.pixels) {
          pixel[name]()
          if (!pixel.isIdle) allIdle = false
        }
        if (allIdle) { cancelAnimationFrame(state.animation); state.animation = null }
      }
      animate()
    }

    function resize() {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width) * dpr
      canvas.height = Math.floor(rect.height) * dpr
      canvas.style.width = `${Math.floor(rect.width)}px`
      canvas.style.height = `${Math.floor(rect.height)}px`
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      createPixels()
    }

    resize()

    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
    const shouldAutoPlay = autoPlay || isTouchDevice

    const parent = canvas.parentElement
    const onEnter = () => handleAnimation('appear')
    const onLeave = () => handleAnimation('disappear')

    if (!isTouchDevice) {
      parent?.addEventListener('mouseenter', onEnter)
      parent?.addEventListener('mouseleave', onLeave)
    }

    if (shouldAutoPlay) handleAnimation('appear')

    const ro = new ResizeObserver(() => { resize(); if (shouldAutoPlay) handleAnimation('appear') })
    ro.observe(canvas.parentElement)

    return () => {
      if (!isTouchDevice) {
        parent?.removeEventListener('mouseenter', onEnter)
        parent?.removeEventListener('mouseleave', onLeave)
      }
      if (state.animation) cancelAnimationFrame(state.animation)
      ro.disconnect()
    }
  }, [colors, gap, speed, autoPlay])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
    />
  )
}
