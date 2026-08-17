/**
 * The one runnable check. No framework:
 *
 *   tsx src/lib/checks.ts
 *
 * Covers the logic a D-pad walk-through cannot reach — handle clamping, the log
 * axis, the band presets, and the acceleration ramp (agent-device cannot hold a
 * key for an exact duration on Android TV, so the timing is only checkable here).
 */
import type { Filters } from '../api/types';
import { AXES, RANGE_KEYS, THIS_YEAR } from '../config/filters';
import { estimate } from './estimate';
import { nudge } from './range';
import { RAMP, stepMultiplier } from './ramp';

// tiny local assert, so this file needs no dependency and no @types/node
const assert = {
  ok(v: unknown, msg = 'expected truthy') {
    if (!v) throw new Error(msg);
  },
  equal(a: unknown, b: unknown, msg?: string) {
    if (a !== b) throw new Error(msg ?? `expected ${String(b)}, got ${String(a)}`);
  },
  deepEqual(a: unknown, b: unknown, msg?: string) {
    const [x, y] = [JSON.stringify(a), JSON.stringify(b)];
    if (x !== y) throw new Error(msg ?? `expected ${y}, got ${x}`);
  },
};

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
  }
}

const baseFilters = (over: Partial<Filters> = {}): Filters => ({
  kinds: ['movie'],
  rating: [0, 10],
  year: [1894, THIS_YEAR],
  votes: [0, 1_000_000],
  genres: {},
  excludeIds: [],
  ...over,
});

console.log('range');

check('a handle never crosses its partner', () => {
  const ax = AXES.rating;
  // drive the lower end hard right; it must stop one step below the upper end
  let v: [number, number] = [0, 5];
  for (let i = 0; i < 100; i++) v = nudge(ax, v, 0, 1);
  assert.equal(v[0], 5 - ax.step!, `lower stopped at ${v[0]}`);
  assert.equal(v[1], 5);

  // and the upper end hard left
  let w: [number, number] = [5, 10];
  for (let i = 0; i < 100; i++) w = nudge(ax, w, 1, -1);
  assert.equal(w[1], 5 + ax.step!, `upper stopped at ${w[1]}`);
  assert.equal(w[0], 5);
});

check('neither handle leaves the axis', () => {
  for (const key of RANGE_KEYS) {
    const ax = AXES[key];
    let v: [number, number] = [ax.min, ax.max];
    for (let i = 0; i < 200; i++) v = nudge(ax, v, 0, -1, 4);
    assert.ok(v[0] >= ax.min, `${key} lower ${v[0]} < ${ax.min}`);
    let w: [number, number] = [ax.min, ax.max];
    for (let i = 0; i < 200; i++) w = nudge(ax, w, 1, 1, 4);
    assert.ok(w[1] <= ax.max, `${key} upper ${w[1]} > ${ax.max}`);
  }
});

check('one tap is exactly one notch', () => {
  assert.deepEqual(nudge(AXES.rating, [5, 10], 0, 1), [5.5, 10]);
  assert.deepEqual(nudge(AXES.year, [1965, THIS_YEAR], 0, -1), [1964, THIS_YEAR]);
});

check('the log votes axis round-trips', () => {
  const ax = AXES.votes;
  for (const v of [0, 1000, 25_000, 250_000, 1_000_000]) {
    const back = ax.unpos!(ax.pos(v));
    assert.ok(Math.abs(back - v) < Math.max(1, v * 0.001), `${v} -> ${back}`);
  }
  // and its midpoints land where a log axis should put them, not bunched at zero
  assert.ok(ax.pos(1000) > 0.4 && ax.pos(1000) < 0.6, `1K sits at ${ax.pos(1000)}`);
});

console.log('bands');

check('every axis has exactly 7 bands, matching the 7-column grid', () => {
  for (const key of RANGE_KEYS) {
    assert.equal(AXES[key].bands.length, 7, `${key} has ${AXES[key].bands.length}`);
  }
});

check('a band produces exactly the range its label claims', () => {
  const great = AXES.rating.bands.find((b) => b.name === 'Great')!;
  assert.deepEqual([great.lo, great.hi], [8, 10]);
  const awful = AXES.rating.bands.find((b) => b.name === 'Awful')!;
  assert.deepEqual([awful.lo, awful.hi], [0, 3]);
  const cult = AXES.votes.bands.find((b) => b.name === 'Cult')!;
  assert.deepEqual([cult.lo, cult.hi], [5000, 25_000]);
  // every band stays inside its axis
  for (const key of RANGE_KEYS) {
    const ax = AXES[key];
    for (const b of ax.bands) {
      assert.ok(b.lo >= ax.min && b.hi <= ax.max && b.lo < b.hi, `${key}/${b.name}`);
    }
  }
});

check('each axis has exactly one whole-axis band', () => {
  for (const key of RANGE_KEYS) {
    const ax = AXES[key];
    const whole = ax.bands.filter((b) => b.lo <= ax.min && b.hi >= ax.max);
    assert.equal(whole.length, 1, `${key} has ${whole.length}`);
    assert.equal(whole[0].name, 'Any');
  }
});

console.log('ramp');

check('a tap is one notch and the ramp doubles at each tier', () => {
  assert.equal(stepMultiplier(0), 1);
  assert.equal(stepMultiplier(RAMP.tiers[0] - 1), 1);
  assert.equal(stepMultiplier(RAMP.tiers[0] + 1), 2);
  assert.equal(stepMultiplier(RAMP.tiers[1] + 1), 4);
  assert.equal(stepMultiplier(RAMP.tiers[3] + 1), 16);
});

/** How long a sustained hold takes to drag one handle across a whole axis. */
function sweepMs(key: (typeof RANGE_KEYS)[number]): number {
  const ax = AXES[key];
  let v: [number, number] = [ax.min, ax.max];
  let held = 0;
  for (let tick = 0; tick < 400; tick++) {
    if (v[1] <= ax.min + (ax.step ?? 1)) return held;
    held = RAMP.firstDelayMs + tick * RAMP.tickMs;
    v = nudge(ax, v, 1, -1, stepMultiplier(held));
  }
  return Infinity;
}

check('holding crosses any axis in under two seconds', () => {
  for (const key of RANGE_KEYS) {
    const ms = sweepMs(key);
    console.log(`          ${key} sweeps in ${ms}ms`);
    assert.ok(ms < 2000, `${key} took ${ms}ms of holding`);
  }
});

console.log('estimate');

check('narrowing a range never increases the count', () => {
  for (const key of RANGE_KEYS) {
    const ax = AXES[key];
    const wide = estimate(baseFilters({ [key]: [ax.min, ax.max] } as Partial<Filters>));
    const mid = (ax.min + ax.max) / 2;
    const narrow = estimate(baseFilters({ [key]: [mid, ax.max] } as Partial<Filters>));
    assert.ok(narrow <= wide, `${key}: ${narrow} > ${wide}`);
  }
});

check('an empty intersection estimates zero', () => {
  // a band of the rating axis with no corpus in it at all
  const none = estimate(baseFilters({ rating: [10, 10], votes: [1_000_000, 1_000_000] }));
  assert.equal(none, 0, `got ${none}`);
});

check('excluding a genre shrinks, including widens the pool it draws from', () => {
  const plain = estimate(baseFilters());
  const excluded = estimate(baseFilters({ genres: { Horror: 'exclude' } }));
  assert.ok(excluded < plain, `${excluded} !< ${plain}`);
  const one = estimate(baseFilters({ genres: { Drama: 'include' } }));
  const two = estimate(baseFilters({ genres: { Drama: 'include', Crime: 'include' } }));
  assert.ok(two > one, `two genres ${two} !> one ${one}`);
  assert.ok(one < plain, `one genre ${one} !< unfiltered ${plain}`);
});

check('the unfiltered estimate is the whole corpus, minus the kind split', () => {
  const both = estimate(baseFilters({ kinds: ['movie', 'series'] }));
  assert.equal(both, 476_818);
});

console.log(`\n${passed} checks passed`);
