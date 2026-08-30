/**
 * The one runnable check. No framework:
 *
 *   tsx src/lib/checks.ts
 *
 * Covers the logic a D-pad walk-through cannot reach — handle clamping and the
 * band presets.
 */
import type { Filters } from '../api/types';
import { buildQuery, withShown } from '../api/client';
import { AXES, RANGE_KEYS, THIS_YEAR } from '../config/filters';
import { nudge } from './range';

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
  ...over,
});

console.log('range');

check('a handle never crosses its partner', () => {
  const ax = AXES.rating;
  // drive the lower end hard right; it must stop one step below the upper end
  let v: [number, number] = [0, 5];
  for (let i = 0; i < 100; i++) v = nudge(ax, v, 0, 1);
  assert.equal(v[0], 5 - ax.step, `lower stopped at ${v[0]}`);
  assert.equal(v[1], 5);

  // and the upper end hard left
  let w: [number, number] = [5, 10];
  for (let i = 0; i < 100; i++) w = nudge(ax, w, 1, -1);
  assert.equal(w[1], 5 + ax.step, `upper stopped at ${w[1]}`);
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
  assert.deepEqual(nudge(AXES.rating, [5, 10], 0, 1), [5.1, 10]);
  assert.deepEqual(nudge(AXES.year, [1965, THIS_YEAR], 0, -1), [1964, THIS_YEAR]);
  assert.deepEqual(nudge(AXES.votes, [0, 1_000_000], 0, 1), [25_000, 1_000_000]);
});

check('the votes axis is linear, not log', () => {
  const ax = AXES.votes;
  // a linear axis puts 10% of the value at 10% of the track, not bunched near zero
  assert.ok(Math.abs(ax.pos(100_000) - 0.1) < 1e-9, `100K sits at ${ax.pos(100_000)}`);
  assert.ok(Math.abs(ax.pos(500_000) - 0.5) < 1e-9, `500K sits at ${ax.pos(500_000)}`);
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

console.log('query');

check('a bound on the edge of its axis is omitted', () => {
  const votes = buildQuery(baseFilters({ votes: [5000, 1_000_000] }));
  assert.ok(votes.includes('numVotes=gte.5000'), votes);
  assert.ok(!votes.includes('numVotes=lte'), votes);

  const year = buildQuery(baseFilters({ year: [2010, THIS_YEAR] }));
  assert.ok(year.includes('startYear=gte.2010'), year);
  assert.ok(!year.includes('startYear=lte'), year);

  const rating = buildQuery(baseFilters({ rating: [0, 10] }));
  assert.ok(!rating.includes('averageRating'), rating);
});

check('a bound inside the axis is sent', () => {
  const q = buildQuery(baseFilters({ year: [2010, 2019] }));
  assert.ok(q.includes('startYear=gte.2010'), q);
  assert.ok(q.includes('startYear=lte.2019'), q);
});

check('titleType is omitted for both kinds and set per single kind', () => {
  const both = buildQuery(baseFilters({ kinds: ['movie', 'series'] }));
  assert.ok(!both.includes('titleType'), both);

  const movies = buildQuery(baseFilters({ kinds: ['movie'] }));
  assert.ok(movies.includes('titleType=not.in.(tvSeries,tvMiniSeries)'), movies);

  const series = buildQuery(baseFilters({ kinds: ['series'] }));
  assert.ok(series.includes('titleType=in.(tvSeries,tvMiniSeries)'), series);
});

check('genre braces are percent-encoded and never bare', () => {
  const q = buildQuery(baseFilters({ genres: { Crime: 'include' } }));
  assert.ok(q.includes('%7B') && q.includes('%7D'), q);
  assert.ok(!/[{}]/.test(q), q);
});

check('genre include uses ov., exclude uses not.ov., one of each produces both', () => {
  const inc = buildQuery(baseFilters({ genres: { Crime: 'include' } }));
  assert.ok(inc.includes('genres=ov.%7BCrime%7D'), inc);

  const exc = buildQuery(baseFilters({ genres: { Horror: 'exclude' } }));
  assert.ok(exc.includes('genres=not.ov.%7BHorror%7D'), exc);

  const both = buildQuery(baseFilters({ genres: { Crime: 'include', Horror: 'exclude' } }));
  assert.ok(both.includes('genres=ov.%7BCrime%7D'), both);
  assert.ok(both.includes('genres=not.ov.%7BHorror%7D'), both);
});

check('buildQuery never emits a tconst param', () => {
  const q = buildQuery(
    baseFilters({ kinds: ['movie'], year: [2010, 2019], genres: { Crime: 'include' } }),
  );
  assert.ok(!q.includes('tconst'), q);
});

check('the whole-open filter set produces the empty string', () => {
  assert.equal(buildQuery(baseFilters({ kinds: ['movie', 'series'] })), '');
});

check('withShown is a no-op on an empty list and appends not.in. otherwise', () => {
  const q = buildQuery(baseFilters({ year: [2010, 2019] }));
  assert.equal(withShown(q, []), q);
  assert.equal(withShown(q, ['tt1', 'tt2']), `${q}&tconst=not.in.(tt1,tt2)`);
});

console.log(`\n${passed} checks passed`);
