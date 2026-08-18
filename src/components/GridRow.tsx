import { Children, cloneElement, isValidElement, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { layout } from '../theme';

/**
 * One row of the board's seven-column grid, and the only place the focus
 * contract is written.
 *
 * Vertical movement is left to Android's FocusFinder. The columns genuinely line
 * up, so it already picks the straight-down neighbour — down from column 5 lands
 * on column 5, which is what lets someone count presses to a target.
 *
 * Horizontal movement is wired to the in-row neighbour, and to *self* at the
 * ends. A full-width row is inert at its edges by geometry anyway, but a short
 * row is not: Type has two cells, and without this, right from "TV shows" finds
 * a genre chip down and to the right — exactly the unpredictable jump the grid
 * exists to prevent.
 *
 * Vertical wiring (`rowFocusUp`/`rowFocusDown`) exists because geometry alone
 * cannot reach a full-width neighbour. Android's FocusFinder scores candidates
 * as 13*major^2 + minor^2, where `minor` is the distance between the two rects'
 * CENTRE points. A full-width row's centre sits at screen centre, so from a
 * left-hand chip it scores ~318k against ~64k for a narrow chip one row further
 * away — and the focus engine skips straight over the wide one. Measured: a
 * slider was reachable at 450dp wide and unreachable at 600dp+.
 *
 * Deliberately NOT a TVFocusGuideView with `autoFocus`. That prop remembers a
 * row's last focused child and redirects to it on the next visit, which reads
 * well on paper — down then up returns you where you were — but it outranks
 * geometry: with it on, down from Movies in column 1 landed on Documentary in
 * column 7 because that row had been visited before. Straight-down is the
 * property worth having, so the memory goes.
 */
export function GridRow({
  children,
  style,
  registerFirst,
  rowFocusUp,
  rowFocusDown,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** Applied to every cell, for a neighbour geometry cannot find. */
  rowFocusUp?: View | null;
  rowFocusDown?: View | null;
  /**
   * Hands out the first cell's node. A full-width row above (a slider, Roll)
   * has every column "in beam", so geometry would drop focus in the middle of
   * this row; the caller wires its nextFocusDown here instead so the hop is
   * always to column 1.
   */
  registerFirst?: (node: View | null) => void;
}) {
  const cells = Children.toArray(children).filter(isValidElement) as ReactElement<any>[];
  const refs = useRef<(View | null)[]>([]);
  // refs are null on first render, so one extra pass is needed before the
  // neighbour wiring can point at real nodes
  const [, wire] = useState(false);
  useLayoutEffect(() => wire(true), []);

  return (
    <View style={[styles.row, style]}>
      {cells.map((cell, i) =>
        cloneElement(cell, {
          key: cell.key ?? i,
          ref: (node: View | null) => {
            refs.current[i] = node;
            if (i === 0) registerFirst?.(node);
          },
          nextFocusLeft: refs.current[i > 0 ? i - 1 : i],
          nextFocusRight: refs.current[i < cells.length - 1 ? i + 1 : i],
          nextFocusUp: rowFocusUp ?? undefined,
          nextFocusDown: rowFocusDown ?? undefined,
        }),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: layout.gap,
  },
});
