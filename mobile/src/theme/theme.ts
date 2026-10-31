export const colors = {
  background: '#FAF9FC',
  surface: '#FFFFFF',
  surfaceMuted: '#EEE7FA',
  primary: '#6842A6',
  primaryPressed: '#503080',
  accent: '#28B8B1',
  text: '#20243A',
  textMuted: '#555B70',
  border: '#DDD8E7',
  error: '#A62A3D',
  errorBackground: '#FDECEF',
  success: '#17695A',
  successBackground: '#DDF3F0',
  warning: '#FA805F',
  peach: '#FFEFE3',
  cameraSurface: '#17232D',
  cameraOverlay: '#17232DCC',
  cameraLandmark: '#0B6B65',
} as const;
// All spacing values follow a four point grid; use these tokens in screens and
// shared components instead of one off layout numbers.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const typography = {
  brand: { fontSize: 20, lineHeight: 28 },
  icon: { fontSize: 32, lineHeight: 40 },
  display: { fontSize: 32, lineHeight: 40 },
  heading: { fontSize: 28, lineHeight: 36 },
  title: { fontSize: 22, lineHeight: 30 },
  body: { fontSize: 18, lineHeight: 26 },
  bodySmall: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, lineHeight: 16 },
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const layout = {
  contentMaxWidth: 560,
  pageGutter: 24,
  headerHeight: 104,
  controlHeight: 56,
  compactControlHeight: 48,
} as const;

export const fonts = {
  regular: 'AtkinsonHyperlegible-Regular',
  bold: 'AtkinsonHyperlegible-Bold',
} as const;
