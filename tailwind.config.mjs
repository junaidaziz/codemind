/** Tailwind CSS configuration enabling class-based dark mode */
const config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/**/*.{js,ts,jsx,tsx,mdx}',
    './**/*.{ts,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          light: '#FFFFFF',
          dark: '#0F172A'
        },
        surface: {
          light: '#F1F5F9',
          dark: '#1E293B'
        },
        text: {
          primary: {
            light: '#0F172A',
            dark: '#FFFFFF'
          },
          secondary: {
            light: '#475569',
            dark: '#94A3B8'
          }
        },
        accent: {
          light: '#3B82F6',
          dark: '#8B5CF6'
        }
      }
    },
  },
  plugins: [],
};

export default config;
