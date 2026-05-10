/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'factory-black':      '#020202',
        'factory-light-gray': '#eeeeee',
        'faded-silver':       '#fafafa',
        'cool-gray':          '#b8b3b0',
        'graphite':           '#3d3a39',
        'ash-gray':           '#a49d9a',
        'code-orange':        '#ef6f2e',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        caption:      ['12px', { lineHeight: '1.5',  letterSpacing: '-0.24px' }],
        'body-sm':    ['14px', { lineHeight: '1.5'  }],
        body:         ['16px', { lineHeight: '1.5'  }],
        subheading:   ['18px', { lineHeight: '1.2'  }],
        heading:      ['24px', { lineHeight: '1.2'  }],
        'heading-lg': ['48px', { lineHeight: '1.2',  letterSpacing: '-2.3px'  }],
        display:      ['60px', { lineHeight: '1.0',  letterSpacing: '-2.88px' }],
      },
      borderRadius: {
        DEFAULT: '4px',
        card:    '6px',
        lg:      '8px',
      },
      maxWidth: {
        content: '1120px',
      },
      letterSpacing: {
        tight:   '-0.03em',
        tighter: '-0.048em',
      },
    },
  },
  plugins: [],
}
