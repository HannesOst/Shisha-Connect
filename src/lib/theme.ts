// Dark design with warm "glowing coal" accents.
export const colors = {
  bg: '#14100D',
  surface: '#1F1915',
  surfaceAlt: '#2A221C',
  border: '#3A2F27',
  text: '#F6EDE4',
  textMuted: '#B5A597',
  textFaint: '#7E6F63',
  accent: '#FF8A3D',
  accentPressed: '#E9742A',
  accentSoft: 'rgba(255, 138, 61, 0.15)',
  amber: '#FFC15E',
  yes: '#4CC38A',
  yesSoft: 'rgba(76, 195, 138, 0.15)',
  maybe: '#F5B946',
  maybeSoft: 'rgba(245, 185, 70, 0.15)',
  no: '#F0605D',
  noSoft: 'rgba(240, 96, 93, 0.15)',
  onAccent: '#1A0E05',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

export const font = {
  title: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  muted: { fontSize: 15, color: colors.textMuted },
  small: { fontSize: 13, color: colors.textMuted },
};
