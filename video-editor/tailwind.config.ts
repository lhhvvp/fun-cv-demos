import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'editor-bg': '#1a1a1a',
        'editor-panel': '#252525',
        'editor-border': '#3a3a3a',
        'timeline-bg': '#2a2a2a',
        'track-bg': '#333333',
        'clip-video': '#4a9eff',
        'clip-audio': '#ff6b6b',
        'playhead': '#ff4444',
      },
    },
  },
  plugins: [],
}
export default config
