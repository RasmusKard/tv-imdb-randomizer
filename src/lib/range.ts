import type { Axis } from '../config/filters';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// binary float noise (0.1 steps land on 5.1000000000000005) would otherwise
// leak into the displayed value and into every equality check downstream
const round = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * Move one end of a range by `mult` steps in `dir`, then keep the pair legal.
 *
 * Pure, so the clamping rules that matter (a handle never crosses its partner,
 * neither leaves the axis) are checkable without a device.
 */
export function nudge(
  axis: Axis,
  value: readonly [number, number],
  side: 0 | 1,
  dir: -1 | 1,
  mult = 1,
): [number, number] {
  const next: [number, number] = [value[0], value[1]];

  const stepped = next[side] + dir * axis.step * mult;
  next[side] = round(Math.round(stepped / axis.step) * axis.step);
  next[side] = clamp(next[side], axis.min, axis.max);

  // the ends may touch no closer than one step
  if (side === 0) next[0] = Math.min(next[0], round(next[1] - axis.step));
  else next[1] = Math.max(next[1], round(next[0] + axis.step));

  return next;
}

/** True when `side` cannot take `dir`: blocked by the axis wall, or by its
 *  partner sitting one step away (the closest a legal range may close). */
export function blocked(
  axis: Axis,
  value: readonly [number, number],
  side: 0 | 1,
  dir: -1 | 1,
): boolean {
  return nudge(axis, value, side, dir)[side] === value[side];
}

/**
 * The end a direction should drive: the live end — unless it is blocked and its
 * partner can take the step, in which case the partner takes it (and the amber
 * mark follows). When both ends are blocked the live end stands, and the step
 * lands nowhere.
 *
 * Pure, so the handoff rules that matter (a wall hands off; a hold never
 * re-evaluates; a dead range never silently re-marks) are checkable without a
 * device.
 */
export function driver(
  axis: Axis,
  value: readonly [number, number],
  live: 0 | 1,
  dir: -1 | 1,
): 0 | 1 {
  if (!blocked(axis, value, live, dir)) return live;
  const other: 0 | 1 = live === 0 ? 1 : 0;
  return blocked(axis, value, other, dir) ? live : other;
}

/** True when the range covers the whole axis, i.e. the filter is off. */
export const isWholeAxis = (axis: Axis, value: readonly [number, number]) =>
  value[0] <= axis.min && value[1] >= axis.max;
