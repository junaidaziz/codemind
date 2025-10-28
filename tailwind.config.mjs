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
        },
        border: {
          light: '#E2E8F0', /* slate-200 */
          dark: '#334155'  /* slate-700 */
        },
        borderMuted: {
          light: '#F1F5F9', /* slate-100 */
          dark: '#1E293B'  /* slate-800 */
        },
        borderStrong: {
          light: '#CBD5E1', /* slate-300 */
          dark: '#475569'  /* slate-600 */
        }
      }
    },
  },
  plugins: [],
};

export default config;
