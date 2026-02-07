import { Slide } from '../../types/onboarding';
import { Palette } from '../../theme/palette';

export const createSlides = (palette: Palette): readonly Slide[] => [
  {
    id: 'pipeline',
    title: 'Pipeline clarity',
    description: 'Organize every application with a friendly Kanban pipeline.',
    colors: ['#0C3C41', '#0A272C'] as [string, string],
    accent: palette.success,
    badge: 'Stay organized',
    iconName: 'grid-outline',
  },
  {
    id: 'journey',
    title: 'Work your next move',
    description: 'Track your job search journey and stay ahead with clear goals.',
    colors: ['#122C5D', '#0F2145'] as [string, string],
    accent: palette.primary,
    badge: 'Job-ready',
    iconName: 'rocket-outline',
  },
  {
    id: 'ready',
    title: 'Ready when you are',
    description: 'Get started and keep your next move just one tap away.',
    colors: ['#132A5A', '#0D1E3A'] as [string, string],
    accent: palette.primary,
    badge: 'Always on deck',
    iconName: 'sparkles-outline',
  },
  {
    id: 'insights',
    title: 'Insights that guide you',
    description: 'See your progress, response times, and wins at a glance.',
    colors: ['#4A2B35', '#27151D'] as [string, string],
    accent: palette.accentPink,
    badge: 'Data-driven',
    iconName: 'trending-up-outline',
  },
];
