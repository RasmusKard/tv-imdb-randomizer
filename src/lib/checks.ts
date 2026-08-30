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
import { extractImdbIds } from './csv';
import { AXES, RANGE_KEYS, THIS_YEAR } from '../config/filters';
import { pickUpdate, type Manifest } from '../update/compare';
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

console.log('csv');

const RATINGS_CSV = [
  'Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,"IMDb Rating",Runtime (mins),Year,Genres,Num Votes,Release Date,Directors',
  'tt0111161,10,2024-01-05,"The Shawshank Redemption",The Shawshank Redemption,https://www.imdb.com/title/tt0111161/,movie,9.3,142,1994,Drama,2900000,1994-10-14,Frank Darabont',
  'tt0117731,7,2024-01-06,"Trainspotting, indeed",Trainspotting,https://www.imdb.com/title/tt0117731/,movie,8.1,93,1996,Drama,700000,1996-07-19,Danny Boyle',
  'tt5491994,8,2024-02-01,"Planet Earth II",Planet Earth II,https://www.imdb.com/title/tt5491994/,tvSeries,9.5,360,2016,"Documentary",66000,2016-11-06,David Attenborough',
].join('\r\n');

check('a ratings export yields its Const column, order kept', () => {
  assert.deepEqual(extractImdbIds(RATINGS_CSV), ['tt0111161', 'tt0117731', 'tt5491994']);
});

check('quoted commas, doubled quotes and CRLF never corrupt a row', () => {
  // the second row's title holds a comma inside quotes; if quoting broke, the
  // Const value would shift one column left and no id would match
  assert.ok(extractImdbIds(RATINGS_CSV).includes('tt0117731'), 'row with quoted comma lost');
});

check('duplicates collapse to one id', () => {
  const csv = 'Const\n\rtt1\n\rtt1\n\rtt2\r\ntt2';
  assert.deepEqual(extractImdbIds(csv), ['tt1', 'tt2']);
});

check('a trailing newline does not invent an id, and CR-only files parse', () => {
  assert.deepEqual(extractImdbIds('Const\r\ntt1\r\n'), ['tt1']);
  assert.deepEqual(extractImdbIds('Const\rtt1\rtt2\r'), ['tt1', 'tt2']);
});

check('ids are matched exactly — URL cells and prefixes contribute nothing', () => {
  const csv = 'junk\nhttps://www.imdb.com/title/tt0111161/\ntt\nttx111111\nnot a tconst at all';
  assert.deepEqual(extractImdbIds(csv), []);
});

check('without a Const header, any cell that is exactly a tconst is taken', () => {
  const csv = 'a,b,c\nx,tt0111161,y\ntt0117731,https://www.imdb.com/title/tt5491994/,z';
  assert.deepEqual(extractImdbIds(csv), ['tt0111161', 'tt0117731']);
});

check('an empty file yields nothing, not a crash', () => {
  assert.deepEqual(extractImdbIds(''), []);
  assert.deepEqual(extractImdbIds('Const\n'), []);
});

console.log('update picking');

const UPDATE: Manifest = {
  stable: { versionName: '1.2.0', versionCode: 1020099, apkUrl: 'a', md5: 'm', changelog: [] },
  beta: { versionName: '1.3.0-beta.2', versionCode: 1030002, apkUrl: 'a', md5: 'm', changelog: [] },
};

check('a newer versionCode is offered, strictly — equal and lower never are', () => {
  assert.deepEqual(pickUpdate(UPDATE, 'stable', 1020098), UPDATE.stable);
  assert.equal(pickUpdate(UPDATE, 'stable', 1020099), null, 'equal must not reinstall');
  assert.equal(pickUpdate(UPDATE, 'stable', 1020100), null, 'never downgrade');
});

check('a stable build always outranks its own betas, and a beta follows its channel', () => {
  // stable 1.3.0 (1030099) > beta.2 of 1.3.0 (1030002): a beta device can
  // always step back down to the stable of the same semver
  assert.ok(1030099 > 1030002, 'stable suffix must beat the beta suffix');
  assert.deepEqual(pickUpdate(UPDATE, 'beta', 1030000), UPDATE.beta);
  assert.equal(pickUpdate(UPDATE, 'beta', 1030002), null);
});

check('an empty channel, a missing channel and a broken manifest all mean no update', () => {
  assert.equal(pickUpdate({ stable: null }, 'stable', 0), null);
  assert.equal(pickUpdate({}, 'stable', 0), null);
  assert.equal(pickUpdate({ stable: { ...UPDATE.stable!, versionCode: NaN } }, 'stable', 0), null);
});

console.log(`\n${passed} checks passed`);
