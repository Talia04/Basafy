import { Ionicons } from '@expo/vector-icons';

export type Slide = {
  id: string;
  title: string;
  description: string;
  colors: [string, string];
  accent: string;
  badge: string;
  iconName: keyof typeof Ionicons.glyphMap;
};

export type OnboardingProps = {
  onComplete?: () => void;
};
