// Graphite "smart home" look: neutral dark greys, frosted-glass surfaces with subtle light edges,
// large radii and a single vivid orange-red accent reserved for primary actions.
export const colors = {
  bg: '#141517',
  surface: '#202124',
  surfaceAlt: '#2B2C30',
  glass: 'rgba(255, 255, 255, 0.06)',
  glassStrong: 'rgba(255, 255, 255, 0.14)',
  border: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(255, 255, 255, 0.22)',
  text: '#F5F5F7',
  textMuted: '#A1A1A8',
  textFaint: '#6C6D73',
  accent: '#F2541B',
  accentPressed: '#D8440E',
  accentSoft: 'rgba(242, 84, 27, 0.16)',
  amber: '#FFB547',
  yes: '#3DD68C',
  yesSoft: 'rgba(61, 214, 140, 0.14)',
  maybe: '#F5BE4B',
  maybeSoft: 'rgba(245, 190, 75, 0.14)',
  no: '#FF6159',
  noSoft: 'rgba(255, 97, 89, 0.14)',
  onAccent: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 14, md: 20, lg: 28, pill: 999 };

export const font = {
  title: { fontSize: 30, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.6 },
  h2: { fontSize: 19, fontWeight: '600' as const, color: colors.text, letterSpacing: -0.2 },
  body: { fontSize: 16, color: colors.text },
  muted: { fontSize: 15, color: colors.textMuted },
  small: { fontSize: 13, color: colors.textMuted },
};
