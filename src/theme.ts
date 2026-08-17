import { Dimensions, Platform } from 'react-native';

/**
 * The design is drawn at 1920x1080. A TV reports dp, not pixels — a 1080p set is
 * ~960dp wide — so every size from the design has to be scaled by the real window
 * width before it reaches a style. `s()` does that.
 *
 * The scale is read once at module load rather than through a hook: a TV never
 * rotates and never resizes, so styles can live in module-scope StyleSheet.create.
 */
export const DESIGN_WIDTH = 1920;

const windowWidth = Dimensions.get('window').width;

/** Scale a number from the 1920-wide design space to this screen. */
export const s = (n: number) => Math.round((n * windowWidth) / DESIGN_WIDTH);

export const colors = {
  /** deep indigo ground — the board face */
  board: '#0F1329',
  /** recessed: the track groove, excluded chips, the receipt strip */
  boardLo: '#0A0D1E',
  /** raised slat surface — chips at rest */
  slat: '#1A1F3D',
  /** slat edge, handles at rest, hairline rules */
  slatHi: '#2A3159',
  /** handles once their slider has focus */
  slatLit: '#3B4270',
  /** amber — primary, focus, editing, include */
  sodium: '#FFB02E',
  /** ink on top of sodium */
  onSodium: '#171200',
  /** dimmed ink on top of sodium, for a chip's second line */
  onSodiumDim: '#4A3A08',
  /** cyan — exclude, warnings */
  cold: '#55CFE6',
  /** warm off-white */
  chalk: '#EDEAE0',
  /** muted label */
  dim: '#838BB4',
  /** the quietest readable step: leading zeros, a chip's second line */
  dimmer: '#4E5680',
} as const;

/**
 * v1 uses the platform faces so nothing is blocked on assets. Dropping in Archivo
 * (display) and IBM Plex Mono (every number and label) is a change to these two
 * values plus a useFonts call in App.tsx.
 */
export const fonts = {
  display: Platform.select({ android: 'sans-serif', default: 'System' }),
  mono: Platform.select({ android: 'monospace', default: 'Menlo' }),
} as const;

/** Every row on both screens is this many columns wide. */
export const COLS = 7;

export const layout = {
  /** 5% on each edge, so nothing lands on a bezel. Percentages need no scaling. */
  overscan: '5%',
  gap: s(12),
  radius: s(3),
  border: s(2),
} as const;

/**
 * Letter-spacing in the design is in em; RN wants dp. Mono labels are tracked
 * wide enough to read at three metres.
 */
export const tracking = (fontSize: number, em: number) => fontSize * em;
