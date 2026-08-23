// ─── MedPet premium design system ─────────────────────────────────────────
// Fresh "modern pet clinic" palette: emerald + mint + sky, warm accents,
// very soft off-white backgrounds. Keys are kept stable so every screen that
// already references COLORS / GRADIENTS picks up the new look automatically.

export const COLORS = {
  // Primary — Emerald / Mint
  primary: '#10B981',
  primaryDark: '#059669',
  primaryLight: '#D1FAE5',
  mint: '#6EE7B7',

  // Secondary — Sky / Baby blue
  secondary: '#38BDF8',
  secondaryDark: '#0EA5E9',
  secondaryLight: '#E0F2FE',

  // Accents — warm orange / coral / yellow / purple
  accent: '#FB923C',
  coral: '#FB7185',
  yellow: '#FCD34D',
  purple: '#8B5CF6',
  purpleDark: '#6D28D9',
  purpleLight: '#EDE9FE',

  // Neutrals
  white: '#FFFFFF',
  black: '#0F2A22',          // deep emerald-tinted ink for headings
  ink: '#0F2A22',
  gray: '#6B8079',           // muted green-gray
  grayLight: '#EEF4F1',
  grayBorder: '#E2EBE7',

  // Status
  error: '#F87171',
  errorDark: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',

  // Surfaces
  background: '#FAFCFB',     // very soft off-white
  cardBg: '#FFFFFF',
  glass: 'rgba(255,255,255,0.7)',
} as const;

export const GRADIENTS = {
  primary: ['#10B981', '#059669'] as [string, string],
  mint:    ['#6EE7B7', '#10B981'] as [string, string],
  sky:     ['#38BDF8', '#0EA5E9'] as [string, string],
  sunset:  ['#FB923C', '#FB7185'] as [string, string],
  purple:  ['#8B5CF6', '#6D28D9'] as [string, string],
  ocean:   ['#0EA5E9', '#6366F1'] as [string, string],
  gold:    ['#FCD34D', '#F59E0B'] as [string, string],
  // Dark "night map" surface for the live-tracking screen
  night:   ['#1E293B', '#0F172A'] as [string, string],
  // Hero banner variety
  banner1: ['#10B981', '#047857'] as [string, string],
  banner2: ['#38BDF8', '#0EA5E9'] as [string, string],
  banner3: ['#FB923C', '#F97316'] as [string, string],
  banner4: ['#FB7185', '#E11D48'] as [string, string],
} as const;

// Soft rounded corners (20–30px per the design language)
export const RADII = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Soft, layered shadows
export const SHADOWS = {
  soft: {
    shadowColor: '#0F2A22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  card: {
    shadowColor: '#0F2A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  floating: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export type ColorKey = keyof typeof COLORS;
