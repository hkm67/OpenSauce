import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const STAR_PATH =
  'M9.82531 0.843845C10.0553 0.215178 10.9446 0.215178 11.1746 0.843845L11.8618 2.72026C12.4006 4.19229 13.5916 5.38331 15.0636 5.92209L16.9400 6.60936C17.5687 6.83938 17.5687 7.72862 16.9400 7.95864L15.0636 8.64591C13.5916 9.18469 12.4006 10.3757 11.8618 11.8477L11.1746 13.7241C10.9446 14.3528 10.0553 14.3528 9.82531 13.7241L9.13804 11.8477C8.59926 10.3757 7.40824 9.18469 5.93621 8.64591L4.05979 7.95864C3.43113 7.72862 3.43113 6.83938 4.05979 6.60936L5.93621 5.92209C7.40824 5.38331 8.59926 4.19229 9.13804 2.72026L9.82531 0.843845Z'

function Sparkle({ id, x, y, color, scale, lifespan }) {
  return (
    <motion.svg
      className="pointer-events-none absolute z-10"
      initial={{ opacity: 0, scale: 0, rotate: 45 }}
      animate={{ opacity: [0, 1, 0], scale: [0, scale, 0], rotate: [0, 60, 90] }}
      exit={{ opacity: 0 }}
      transition={{ duration: lifespan, ease: 'easeInOut' }}
      style={{ left: x, top: y, translateX: '-50%', translateY: '-50%' }}
      width="21"
      height="21"
      viewBox="0 0 21 21"
    >
      <path d={STAR_PATH} fill={color} />
    </motion.svg>
  )
}

const DEFAULT_COLORS = ['#FF6347', '#ff8c69', '#ffffff', '#fcd5b8']

export default function SparklesButton({ children, className = '', colors = DEFAULT_COLORS, density = 2 }) {
  const [sparkles, setSparkles] = useState([])
  const idCounter = useRef(0)
  const containerRef = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const id = idCounter.current++
      const x = Math.random() * (rect.width + 32) - 16
      const y = Math.random() * (rect.height + 32) - 16
      const color = colors[Math.floor(Math.random() * colors.length)]
      const scale = Math.random() * 0.7 + 0.5
      const lifespan = Math.random() * 1.0 + 1.8
      const sparkle = { id, x, y, color, scale, lifespan }
      setSparkles((prev) => [...prev, sparkle])
      setTimeout(() => setSparkles((prev) => prev.filter((s) => s.id !== id)), (lifespan + 0.2) * 1000)
    }, 1000 / density)
    return () => clearInterval(interval)
  }, [colors, density])

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <AnimatePresence>
        {sparkles.map((s) => (
          <Sparkle key={s.id} {...s} />
        ))}
      </AnimatePresence>
      {children}
    </div>
  )
}
