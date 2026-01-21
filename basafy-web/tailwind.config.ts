import type { Config } from 'tailwindcss';

const withAlpha = (cssVar: string) => {
  return `color-mix(in oklab, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`;
};

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: withAlpha('--background'),
        foreground: withAlpha('--foreground'),
        card: withAlpha('--card'),
        'card-foreground': withAlpha('--card-foreground'),
        popover: withAlpha('--popover'),
        'popover-foreground': withAlpha('--popover-foreground'),
        primary: withAlpha('--primary'),
        'primary-foreground': withAlpha('--primary-foreground'),
        secondary: withAlpha('--secondary'),
        'secondary-foreground': withAlpha('--secondary-foreground'),
        muted: withAlpha('--muted'),
        'muted-foreground': withAlpha('--muted-foreground'),
        accent: withAlpha('--accent'),
        'accent-foreground': withAlpha('--accent-foreground'),
        destructive: withAlpha('--destructive'),
        'destructive-foreground': withAlpha('--destructive-foreground'),
        border: withAlpha('--border'),
        input: withAlpha('--input'),
        ring: withAlpha('--ring'),
        'chart-1': withAlpha('--chart-1'),
        'chart-2': withAlpha('--chart-2'),
        'chart-3': withAlpha('--chart-3'),
        'chart-4': withAlpha('--chart-4'),
        'chart-5': withAlpha('--chart-5'),
        sidebar: withAlpha('--sidebar'),
        'sidebar-foreground': withAlpha('--sidebar-foreground'),
        'sidebar-primary': withAlpha('--sidebar-primary'),
        'sidebar-primary-foreground': withAlpha('--sidebar-primary-foreground'),
        'sidebar-accent': withAlpha('--sidebar-accent'),
        'sidebar-accent-foreground': withAlpha('--sidebar-accent-foreground'),
        'sidebar-border': withAlpha('--sidebar-border'),
        'sidebar-ring': withAlpha('--sidebar-ring')
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)']
      }
    }
  },
  plugins: []
};

export default config;
