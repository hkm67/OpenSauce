export const LEVELS = [
  { name: 'Seedling',    icon: '🌱', min: 0  },
  { name: 'Contributor', icon: '🔧', min: 1  },
  { name: 'Builder',     icon: '⚡', min: 5  },
  { name: 'Maintainer',  icon: '🏗️', min: 15 },
  { name: 'Core Member', icon: '🍅', min: 50 },
]

export function getLevel(contributions) {
  let current = LEVELS[0]
  for (const level of LEVELS) {
    if (contributions >= level.min) current = level
  }
  const idx = LEVELS.indexOf(current)
  const next = LEVELS[idx + 1] || null
  const progressPct = next
    ? Math.round(((contributions - current.min) / (next.min - current.min)) * 100)
    : 100
  return { current, next, progressPct }
}

export const BADGES = [
  { id: 'first-contribution', name: 'First Commit',   icon: '🌱', description: 'Made your first AI-powered open source contribution.', threshold: 1   },
  { id: 'streak-3',           name: 'On a Roll',      icon: '🔥', description: 'Reached 3 contributions — the momentum is building.',   threshold: 3   },
  { id: 'five-club',          name: 'Five-Club',      icon: '🔧', description: 'Five contributions and counting. You mean business.',   threshold: 5   },
  { id: 'double-digits',      name: 'Double Digits',  icon: '⚡', description: 'Hit 10 contributions. Your agents are on fire.',        threshold: 10  },
  { id: 'maintainer',         name: 'Maintainer',     icon: '🏗️', description: 'Trusted by the community with 15 contributions.',      threshold: 15  },
  { id: 'generous',           name: 'Generous',       icon: '🤝', description: '20 contributions. Giving back at scale.',              threshold: 20  },
  { id: 'twenty-five',        name: 'Veteran',        icon: '🧭', description: '25 contributions. A veteran of open source.',          threshold: 25  },
  { id: 'core-member',        name: 'Core Member',    icon: '🍅', description: '50 contributions. You are the core.',                  threshold: 50  },
  { id: 'architect',          name: 'Architect',      icon: '🏛️', description: '75 contributions. You are shaping the ecosystem.',     threshold: 75  },
  { id: 'century',            name: 'Century',        icon: '💯', description: '100 contributions. Legendary.',                        threshold: 100 },
]

export function getBadges(contributions) {
  return BADGES.map((b) => ({ ...b, earned: contributions >= b.threshold }))
}
