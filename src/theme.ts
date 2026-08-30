import { Dimensions, StyleSheet } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * The design is drawn at 1920x1080. A TV reports dp, not pixels — a 1080p set is
 * ~960dp wide — so every size from the design has to be scaled by the real window
 * width before it reaches a style. `s()` does that.
 *
 * The scale is read once at module load rather than through a hook: a TV never
 * rotates and never resizes, so styles can live in module-scope StyleSheet.create.
 */
const DESIGN_WIDTH = 1920;

const windowWidth = Dimensions.get('window').width;

/** Scale a number from the 1920-wide design space to this screen. */
export const s = (n: number) => Math.round((n * windowWidth) / DESIGN_WIDTH);

export const colors = {
  /** film black — the unlit ground of every screen */
  board: '#0A0A0C',
  /** deeper black — unlit: the track groove, excluded chips, the leader tape */
  boardLo: '#050507',
  /** raised film surface — chips at rest */
  slat: '#141417',
  /** slat edge, handles at rest, hairline rules */
  slatHi: '#232329',
  /** handles once their slider has focus */
  slatLit: '#33333B',
  /** leader tape strip — one step above the ground */
  tape: '#121114',
  /** tungsten amber — the gate light: primary, focus, editing, include */
  sodium: '#FFB02E',
  /** the same amber at rest, so taking focus is a visible step up in brightness */
  sodiumDim: '#C98622',
  /** ink on top of sodium */
  onSodium: '#171200',
  /** dimmed ink on top of sodium, for a chip's second line */
  onSodiumDim: '#4A3A08',
  /** cue cyan — exclude, warnings */
  cold: '#55CFE6',
  /** emulsion white — titles, primary text */
  chalk: '#E8E6DC',
  /** dim silver — muted labels */
  dim: '#8A8878',
  /** the quietest readable step: leading zeros, placeholders — lifted to
   * hold ~3:1 on slat for large digits; small text uses dim */
  dimmer: '#6E6B5E',
} as const;

/**
 * The booth's two faces, both Omnibus-Type — the Argentine poster and signage
 * foundry — loaded in App.tsx via useFonts; the family names below are the
 * useFonts keys. Display: Archivo ExtraBold (titles, wordmark, actions).
 * Ledger: Chivo Mono 400/700 for every number and label, tracked wide to
 * read at three metres.
 */
export const fonts = {
  displayHeavy: 'Archivo800',
  mono: 'ChivoMono400',
  monoBold: 'ChivoMono700',
} as const;

/** Every row on both screens is this many columns wide. */
export const COLS = 7;

const OVERSCAN_FRACTION = 0.05;
const gap = s(12);
const contentWidth = windowWidth * (1 - OVERSCAN_FRACTION * 2);
const cell = (contentWidth - (COLS - 1) * gap) / COLS;

export const layout = {
  /** 5% on each edge, so nothing lands on a bezel. */
  overscan: `${OVERSCAN_FRACTION * 100}%`,
  gap,
  radius: s(3),
  border: s(2),
  contentWidth,
  /**
   * One column. Cells are sized, not flexed: a row with two cells has to leave
   * them in columns 1 and 2 rather than stretching them across the screen,
   * otherwise "down is straight down" stops being true.
   */
  cell,
  /** Width of a cell spanning n columns, gaps included. */
  span: (n: number) => cell * n + gap * (n - 1),
} as const;

/**
 * Letter-spacing in the design is in em; RN wants dp. Mono labels are tracked
 * wide enough to read at three metres.
 */
export const tracking = (fontSize: number, em: number) => fontSize * em;

type TextRecipe = Omit<TextStyle, 'fontFamily' | 'fontSize' | 'letterSpacing'> & {
  /** Tracking in em, converted to dp against this size. */
  em?: number;
  /** Every mono label and most display text is uppercase; a few numbers are not. */
  caps?: boolean;
};

/**
 * Every text style in the app is the same three or four keys: a face, a size from
 * the design space, that size's tracking, usually uppercase. `mono` and `display`
 * state them once, so a size and the tracking derived from it cannot drift apart.
 *
 * The faces carry an explicit line-height (mono 1.25, display 1.1): without one,
 * each family's built-in leading decides the row heights, and the board's
 * fixed-height rows overflow the overscan inset whenever a face swaps in taller
 * than the last. An explicit leading is the one number that keeps the stack
 * inside the screen from being an accident of the font files.
 */
const face =
  (fontFamily: TextStyle['fontFamily'], lh: number) =>
  (size: number, { em, caps, lineHeight, ...rest }: TextRecipe = {}): TextStyle => ({
    fontFamily,
    fontSize: s(size),
    ...(lineHeight !== undefined
      ? { lineHeight: s(lineHeight) }
      : { lineHeight: Math.round(s(size) * lh) }),
    ...(em !== undefined && { letterSpacing: tracking(s(size), em) }),
    ...(caps && { textTransform: 'uppercase' }),
    ...rest,
  });

export const mono = face(fonts.mono, 1.25);
export const monoBold = face(fonts.monoBold, 1.25);
export const displayHeavy = face(fonts.displayHeavy, 1.1);

/**
 * Every screen sits on the board ground and inside the overscan inset, so
 * "nothing lands on a bezel" is stated once rather than copied per screen.
 */
export const screen = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.board },
  safe: {
    flex: 1,
    paddingHorizontal: layout.overscan,
    paddingVertical: layout.overscan,
  },
});
