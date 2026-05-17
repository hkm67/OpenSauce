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
  { id: 'first-contribution', name: 'First Commit',  description: 'Made your first AI-powered open source contribution.', image: '/tomato_1.png', threshold: 1   },
  { id: 'streak-3',           name: 'On a Roll',     description: 'Reached 3 contributions — the momentum is building.',  image: '/tomato_2.png', threshold: 3   },
  { id: 'five-club',          name: 'Five-Club',     description: 'Five contributions and counting. You mean business.',  image: '/tomato_3.png', threshold: 5   },
  { id: 'double-digits',      name: 'Double Digits', description: 'Hit 10 contributions. Your agents are on fire.',       image: '/tomato_4.png', threshold: 10  },
  { id: 'maintainer',         name: 'Maintainer',    description: 'Trusted by the community with 15 contributions.',      image: '/tomato_5.png', threshold: 15  },
  { id: 'generous',           name: 'Generous',      description: '20 contributions. Giving back at scale.',             image: '/tomato_6.png', threshold: 20  },
  { id: 'core-member',        name: 'Core Member',   description: '50 contributions. You are the core.',                 image: '/tomato_7.png', threshold: 50  },
  { id: 'century',            name: 'Century',       description: '100 contributions. Legendary.',                       image: '/tomato_8.png', threshold: 100 },
]

export function getBadges(contributions) {
  return BADGES.map((b) => ({ ...b, earned: contributions >= b.threshold }))
}
