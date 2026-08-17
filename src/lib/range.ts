import type { Axis } from '../config/filters';

/** One press on the log-scaled votes axis moves this share of the track. */
const LOG_STEP = 0.03;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

  if (axis.step !== null) {
    const stepped = next[side] + dir * axis.step * mult;
    next[side] = Math.round(stepped / axis.step) * axis.step;
  } else {
    // log axis: step by a share of the track, not by a count of votes
    const p = clamp(axis.pos(next[side]) + dir * LOG_STEP * mult, 0, 1);
    const raw = axis.unpos!(p);
    // round to something a person would say out loud
    next[side] = raw > 2000 ? Math.round(raw / 500) * 500 : Math.round(raw);
  }

  next[side] = clamp(next[side], axis.min, axis.max);

  // the ends may touch no closer than one step
  const gap = axis.step ?? 1;
  if (side === 0) next[0] = Math.min(next[0], next[1] - gap);
  else next[1] = Math.max(next[1], next[0] + gap);

  return next;
}

/** True when the range covers the whole axis, i.e. the filter is off. */
export const isWholeAxis = (axis: Axis, value: readonly [number, number]) =>
  value[0] <= axis.min && value[1] >= axis.max;
