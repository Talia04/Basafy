export const summaryStats = [
  { label: 'Applications Active', value: 12, colors: ['#1E3A8A', '#0F172A'], dot: ['#3B82F6', '#0D1B3D'] },
  { label: 'Interviews This Week', value: 3, colors: ['#0F766E', '#0B3B3F'], dot: ['#10B981', '#0B3B3F'] },
  { label: 'Pending Actions', value: 2, colors: ['#9B1C3C', '#2C1724'], dot: ['#F59E0B', '#2C1724'] },
];

export const metrics = [
  { label: 'Success Rate', value: '68%', icon: 'trending-up-outline' },
  { label: 'Avg. Response', value: '4.2 days', icon: 'calendar-outline' },
];

export const upcomingEvents = [
  {
    company: 'Stripe',
    role: 'Software Engineer Intern',
    day: 'Tomorrow',
    time: '2:00 PM',
    link: 'Zoom',
    accent: ['#4A8CFF', '#5AEFD5'],
  },
  {
    company: 'Google',
    role: 'Recruiter Call',
    day: 'Friday',
    time: '10:00 AM',
    link: 'Google Meet',
    accent: ['#6A7DFF', '#9B8CFF'],
  },
];

export const tasks = [
  { title: 'Complete Meta assessment', detail: 'Due in 2 days', status: 'pending' as const, done: false },
  { title: 'Follow up with Amazon recruiter', detail: 'Overdue', status: 'overdue' as const, done: false },
  { title: 'Send thank-you note', detail: 'Just now', status: 'pending' as const, done: true },
];

export const navItems = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'pipeline', label: 'Pipeline', icon: 'stats-chart-outline' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
  { key: 'applications', label: 'Applications', icon: 'briefcase-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
];
