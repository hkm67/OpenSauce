export const CATEGORIES = [
  'Infrastructure',
  'Dev Tools',
  'AI / ML',
  'Security',
  'Frontend',
  'Backend',
]

export const CATEGORY_KEYWORDS = {
  'Infrastructure': ['infrastructure', 'devops', 'cloud', 'kubernetes', 'docker', 'container', 'server', 'deploy', 'platform'],
  'Dev Tools':      ['tool', 'cli', 'sdk', 'ide', 'editor', 'build', 'lint', 'test', 'debug', 'workflow', 'automation'],
  'AI / ML':        ['ai', 'ml', 'machine learning', 'neural', 'model', 'llm', 'gpt', 'vector', 'embedding', 'data'],
  'Security':       ['security', 'auth', 'crypto', 'encryption', 'ssl', 'tls', 'vulnerability', 'permission', 'oauth'],
  'Frontend':       ['frontend', 'ui', 'react', 'vue', 'angular', 'css', 'html', 'web', 'design', 'component', 'interface'],
  'Backend':        ['backend', 'api', 'database', 'db', 'sql', 'rest', 'graphql', 'microservice', 'service', 'notification'],
}

export const CATEGORY_COLORS = {
  'Infrastructure': '#020202',
  'Dev Tools':      '#3d3a39',
  'AI / ML':        '#ef6f2e',
  'Security':       '#b8b3b0',
  'Frontend':       '#a49d9a',
  'Backend':        '#7a7472',
  'Other':          '#cccccc',
}

export function categorizeProject({ url = '', description = '' } = {}) {
  const haystack = `${url} ${description}`.toLowerCase()
  for (const cat of CATEGORIES) {
    if (CATEGORY_KEYWORDS[cat].some((kw) => haystack.includes(kw))) {
      return cat
    }
  }
  return 'Other'
}
