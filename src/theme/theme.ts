import { Platform, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBOX PREMIUM DESIGN SYSTEM
// Dark sporty-cinematic · Glassmorphism · Production-ready
// ─────────────────────────────────────────────────────────────────────────────

// ── Color Palette ─────────────────────────────────────────────────────────────

export const palette = {
  // Base layers — rich layered dark, not flat black
  black:       '#020408',
  void:        '#050810',
  abyss:       '#080C14',
  deep:        '#0C1220',
  midnight:    '#0F172A',
  navy:        '#131C30',
  slate:       '#1A2540',
  surface:     '#1F2D48',
  violetText:  '#7C3AED',

  // Glass surfaces
  glass0:      'rgba(255,255,255,0.02)',
  glass1:      'rgba(255,255,255,0.04)',
  glass2:      'rgba(255,255,255,0.06)',
  glass3:      'rgba(255,255,255,0.08)',
  glass4:      'rgba(255,255,255,0.12)',
  glass5:      'rgba(255,255,255,0.16)',

  // Brand accent — electric blue (primary)
  accent:      '#3B82F6',
  accentBright:'#60A5FA',
  accentGlow:  'rgba(59,130,246,0.25)',
  accentSoft:  'rgba(59,130,246,0.12)',
  accentDeep:  '#1D4ED8',

  // Secondary accent — violet-purple
  violet:      '#7C3AED',
  violetBright:'#A78BFA',
  violetGlow:  'rgba(124,58,237,0.25)',
  violetSoft:  'rgba(124,58,237,0.12)',

  // Success / confirmed — emerald
  emerald:     '#10B981',
  emeraldBright:'#34D399',
  emeraldGlow: 'rgba(16,185,129,0.2)',
  emeraldSoft: 'rgba(16,185,129,0.1)',

  // Warning / pending — amber
  amber:       '#F59E0B',
  amberBright: '#FCD34D',
  amberGlow:   'rgba(245,158,11,0.2)',
  amberSoft:   'rgba(245,158,11,0.1)',

  // Danger / error — red
  red:         '#EF4444',
  redBright:   '#F87171',
  redGlow:     'rgba(239,68,68,0.2)',
  redSoft:     'rgba(239,68,68,0.1)',

  // Text hierarchy
  white:       '#FFFFFF',
  textPrimary: '#F1F5F9',
  textSecondary:'rgba(241,245,249,0.6)',
  textTertiary: 'rgba(241,245,249,0.35)',
  textQuaternary:'rgba(241,245,249,0.18)',

  // Borders
  borderFaint: 'rgba(255,255,255,0.05)',
  borderSubtle:'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
  borderMedium:'rgba(255,255,255,0.18)',
  borderAccent:'rgba(59,130,246,0.3)',
  borderViolet:'rgba(124,58,237,0.3)',
};

// ── Semantic colors ────────────────────────────────────────────────────────────

export const colors = {
  // App background — richly layered dark
  bg:          palette.abyss,
  bgDeep:      palette.void,
  bgSurface:   palette.deep,

  // Card surfaces
  card:        palette.midnight,
  cardHover:   palette.navy,
  cardGlass:   palette.glass1,
  cardGlass2:  palette.glass2,

  // Surfaces
  surface:     palette.midnight,
  surface2:    palette.navy,
  surface3:    palette.slate,

  // Dark header
  header:      'rgba(8,12,20,0.97)',
  headerBorder:palette.borderFaint,

  // Borders
  border:      palette.borderSubtle,
  borderLight: palette.borderLight,
  borderMedium:palette.borderMedium,

  // Text
  text:        palette.textPrimary,
  text2:       palette.textSecondary,
  text3:       palette.textTertiary,
  text4:       palette.textQuaternary,

  // Accents
  accent:      palette.accent,
  accentText:  palette.accentBright,
  accent2:     palette.accentSoft,
  accentGlow:  palette.accentGlow,

  violet:      palette.violet,
  violetText:  palette.violetBright,
  violet2:     palette.violetSoft,

  // Status colors
  success:     palette.emerald,
  successText: palette.emeraldBright,
  success2:    palette.emeraldSoft,

  warning:     palette.amber,
  warningText: palette.amberBright,
  warning2:    palette.amberSoft,

  danger:      palette.red,
  dangerText:  palette.redBright,
  dangerBg:    palette.redSoft,

  info:        palette.accent,
  infoBg:      palette.accentSoft,

  // Dark (for invoice header etc.)
  dark:        palette.void,

  // Glass
  glass:       palette.glass2,
  glass2:      palette.glass3,

  // Named legacy aliases (keep existing code working)
  accentMid:   palette.violet,
  accentBorder:palette.borderAccent,
  accentLight: palette.accentBright,
  warn:        palette.amber,
  warnBg:      palette.amberSoft,
  teal:        palette.emerald,
  tealSoft:    palette.emeraldSoft,
};

// ── Radius system ──────────────────────────────────────────────────────────────

export const radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   20,
  xl:   28,
  xxl:  36,
  pill: 100,
};

// ── Spacing system ─────────────────────────────────────────────────────────────

export const spacing = {
  xxs: 4,
  xs:  8,
  sm:  12,
  md:  16,
  lg:  20,
  xl:  24,
  xxl: 32,
  xxxl:48,
};

// ── Typography ─────────────────────────────────────────────────────────────────

export const font = {
  // Sizes
  xs:    11,
  sm:    13,
  md:    15,
  lg:    17,
  xl:    20,
  xxl:   24,
  xxxl:  30,
  display:38,

  // Weights
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
  extrabold:'800' as const,
  black:   '900' as const,

  // Letter spacing
  tight:  -0.5,
  normal: 0,
  wide:   0.5,
  wider:  1,
  widest: 2,
};

// ── Shadows ────────────────────────────────────────────────────────────────────

export const shadow = {
  none: {},

  xs: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 4 },
    android: { elevation: 2 },
    default: {},
  }),

  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 },
    android: { elevation: 4 },
    default: {},
  }),

  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 14 },
    android: { elevation: 8 },
    default: {},
  }),

  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24 },
    android: { elevation: 14 },
    default: {},
  }),

  xl: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.5, shadowRadius: 36 },
    android: { elevation: 20 },
    default: {},
  }),

  accent: Platform.select({
    ios: { shadowColor: palette.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18 },
    android: { elevation: 10 },
    default: {},
  }),

  violet: Platform.select({
    ios: { shadowColor: palette.violet, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18 },
    android: { elevation: 10 },
    default: {},
  }),

  emerald: Platform.select({
    ios: { shadowColor: palette.emerald, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
    android: { elevation: 8 },
    default: {},
  }),
};

// ── Screen dimensions ──────────────────────────────────────────────────────────

export const screen = { width: SW, height: SH };

// ── Status state config ────────────────────────────────────────────────────────

export const statusConfig = {
  Confirmed: {
    bg:     palette.accentSoft,
    border: palette.borderAccent,
    text:   palette.accentBright,
    glow:   palette.accentGlow,
  },
  Completed: {
    bg:     palette.emeraldSoft,
    border: 'rgba(16,185,129,0.3)',
    text:   palette.emeraldBright,
    glow:   palette.emeraldGlow,
  },
  Pending: {
    bg:     palette.amberSoft,
    border: 'rgba(245,158,11,0.3)',
    text:   palette.amberBright,
    glow:   palette.amberGlow,
  },
  Cancelled: {
    bg:     palette.redSoft,
    border: 'rgba(239,68,68,0.3)',
    text:   palette.redBright,
    glow:   palette.redGlow,
  },
  Live: {
    bg:     'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.4)',
    text:   '#F87171',
    glow:   'rgba(239,68,68,0.3)',
  },
};

// ── Common component style recipes ────────────────────────────────────────────

export const recipe = {
  // Premium glass card
  glassCard: {
    backgroundColor:  palette.glass2,
    borderWidth:      1,
    borderColor:      palette.borderSubtle,
    borderRadius:     radius.lg,
    ...shadow.md,
  },

  // Solid dark card
  solidCard: {
    backgroundColor: palette.midnight,
    borderWidth:     1,
    borderColor:     palette.borderFaint,
    borderRadius:    radius.lg,
    ...shadow.sm,
  },

  // Accent-bordered card
  accentCard: {
    backgroundColor: palette.accentSoft,
    borderWidth:     1,
    borderColor:     palette.borderAccent,
    borderRadius:    radius.lg,
    ...shadow.accent,
  },

  // Primary button
  btnPrimary: {
    backgroundColor: palette.accent,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems:      'center' as const,
    justifyContent:  'center' as const,
    ...shadow.accent,
  },

  // Ghost button
  btnGhost: {
    backgroundColor: palette.glass2,
    borderWidth:     1,
    borderColor:     palette.borderLight,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems:      'center' as const,
    justifyContent:  'center' as const,
  },

  // Danger button
  btnDanger: {
    backgroundColor: palette.redSoft,
    borderWidth:     1,
    borderColor:     'rgba(239,68,68,0.3)',
    borderRadius:    radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems:      'center' as const,
    justifyContent:  'center' as const,
  },

  // Input field
  input: {
    backgroundColor: palette.glass2,
    borderWidth:     1,
    borderColor:     palette.borderSubtle,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm + 1,
    color:           palette.textPrimary,
    fontSize:        font.md,
  },

  // Section label
  sectionLabel: {
    fontSize:       font.xs,
    fontWeight:     font.bold,
    color:          palette.textTertiary,
    textTransform:  'uppercase' as const,
    letterSpacing:  font.widest,
    marginBottom:   spacing.xs,
  },

  // Header bar
  header: {
    backgroundColor:  'rgba(8,12,20,0.97)',
    borderBottomWidth:1,
    borderBottomColor:palette.borderFaint,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    flexDirection:    'row' as const,
    alignItems:       'center' as const,
  },
};

export default { colors, radius, spacing, font, shadow, screen, palette, recipe, statusConfig };