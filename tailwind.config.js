/** Build-time Tailwind (replaces the in-browser CDN compiler, which re-scanned the DOM on every change and caused jank). */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Netflix Sans"', '"Inter Variable"', '"Helvetica Neue"', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
      },
      colors: {
        'netflix-red': '#E50914',
        'netflix-red-dark': '#B20710',
        'netflix-dark': '#181818',
        'netflix-gray': '#808080',
        'netflix-bg': '#141414',
        'netflix-card': '#181818',
        'netflix-elevated': '#232323',
        'netflix-line': '#404040',
        'netflix-text': '#e5e5e5',
        'netflix-muted': '#b3b3b3',
        'netflix-green': '#46d369',
      },
      transitionTimingFunction: {
        netflix: 'cubic-bezier(0.5, 0, 0.1, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-in-up': { '0%': { opacity: '0', transform: 'translate3d(0,1rem,0)' }, '100%': { opacity: '1', transform: 'translate3d(0,0,0)' } },
        'zoom-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'fade-out-input': { from: { color: 'white' }, to: { color: 'transparent' } },
        pulse: { '50%': { opacity: '.5' } },
        'genie-in': {
          from: { transform: 'scale(0)', opacity: '0', 'clip-path': 'inset(45% 45% 45% 45% round 50%)' },
          to: { transform: 'scale(1)', opacity: '1', 'clip-path': 'inset(0% 0% 0% 0% round 0%)' },
        },
        'genie-out': {
          from: { transform: 'scale(1)', opacity: '1', 'clip-path': 'inset(0% 0% 0% 0% round 0%)' },
          to: { transform: 'scale(0)', opacity: '0', 'clip-path': 'inset(45% 45% 45% 45% round 50%)' },
        },
        'toast-in': { '0%': { opacity: '0', transform: 'translate3d(0,16px,0) scale(0.98)' }, '100%': { opacity: '1', transform: 'translate3d(0,0,0) scale(1)' } },
        'dropdown-in': { '0%': { opacity: '0', transform: 'translate3d(0,-6px,0)' }, '100%': { opacity: '1', transform: 'translate3d(0,0,0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-fast': 'fade-in 0.25s ease-out both',
        'fade-in-up': 'fade-in-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        'zoom-in': 'zoom-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'zoom-in-fast': 'zoom-in 0.15s ease-out both',
        'fade-out-input': 'fade-out-input 0.8s ease-in-out forwards',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'genie-in': 'genie-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'genie-out': 'genie-out 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'toast-in': 'toast-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'dropdown-in': 'dropdown-in 0.18s ease-out both',
      },
    },
  },
  plugins: [],
};
