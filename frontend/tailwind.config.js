/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // Mesmos pontos de quebra do CSS original (max-width: 1150 / 900 / 600px).
    // O layout é "desktop-first": use as variantes max-lg:, max-md: e max-sm:.
    screens: {
      sm: '601px',
      md: '901px',
      lg: '1151px',
    },
    extend: {
      colors: {
        page: '#f5efe3',
        surface: '#fffdf9',
        maroon: '#761918',
        ink: '#2e4262',
        muted: '#5e6979',
        accent: '#ff9f3e',
        line: '#e4dccf',
        // Fundo dos cards de evento, por categoria
        cat: {
          music: '#ffedce',
          theater: '#d8eee3',
          art: '#d8e1ed',
          sport: '#ecd9d9',
          festival: '#f7e7cc',
        },
        // Bolinha de cada categoria (legenda e filtros)
        dot: {
          music: '#a85316',
          festival: '#be7628',
          theater: '#438268',
          sport: '#9e4e57',
          art: '#587ba4',
        },
      },
      borderColor: {
        DEFAULT: '#e4dccf',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 28px rgb(70 43 22 / 5%)',
        card: '0 5px 16px rgb(81 48 22 / 4%)',
        popover: '0 15px 40px rgb(46 30 15 / 14%)',
        badge: '0 2px 8px rgb(0 0 0 / 8%)',
      },
    },
  },
  plugins: [],
}
