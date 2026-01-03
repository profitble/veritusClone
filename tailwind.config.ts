import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Magda Clean', 'system-ui', 'sans-serif'],
        serif: ['PP Editorial New', 'Georgia', 'serif'],
        label: ['Geist', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#133333',
          5: '#1333330d',    // 5% opacity
          10: '#1333331a',   // 10% opacity
          20: '#13333333',   // 20% opacity
          30: '#1333334d',   // 30% opacity
          40: '#13333366',   // 40% opacity
          50: '#13333380',   // 50% opacity
          60: '#13333399',   // 60% opacity
          70: '#133333b3',   // 70% opacity
          80: '#133333cc',   // 80% opacity
          90: '#133333e6',   // 90% opacity
        },
        background: {
          DEFAULT: '#f5f1e3',
        },
      },
    },
  },
  plugins: [],
}

export default config

