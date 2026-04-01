import { Slide } from '../../types/onboarding';
import { Palette } from '../../theme/palette';

export const createSlides = (palette: Palette): readonly Slide[] => [
  {
    id: 'sync',
    title: 'Connect Gmail. We do the heavy lifting.',
    description: 'Basafy scans job emails, imports applications, and keeps syncing while you keep moving.',
    colors: ['#11335E', '#0A172E'] as [string, string],
    accent: palette.accentBlue,
    badge: 'Background import',
    iconName: 'mail-open',
  },
  {
    id: 'applications',
    title: 'Applications appear as they land.',
    description: 'New roles stream into your app with review flags when details need a quick cleanup.',
    colors: ['#123C49', '#081D25'] as [string, string],
    accent: palette.success,
    badge: 'Live updates',
    iconName: 'bag-handle',
  },
  {
    id: 'pipeline',
    title: 'Your pipeline organizes itself.',
    description: 'Applied, interview, offer, rejected. Basafy turns noisy email threads into a clear board.',
    colors: ['#4A2441', '#180B19'] as [string, string],
    accent: palette.accentPink,
    badge: 'Auto-organized',
    iconName: 'layers',
  },
  {
    id: 'insights',
    title: 'Insights show what to do next.',
    description: 'Track momentum, spot stalled applications, and see where your search is actually working.',
    colors: ['#5E3A12', '#221306'] as [string, string],
    accent: palette.accentYellow,
    badge: 'Actionable signals',
    iconName: 'stats-chart',
  },
];
