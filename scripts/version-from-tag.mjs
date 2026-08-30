/**
 * The release tag, parsed. Shared by the two release scripts.
 *
 *   v1.2.3          -> { versionName: '1.2.3',        versionCode: 1020399 }
 *   v1.2.3-beta.2   -> { versionName: '1.2.3-beta.2', versionCode: 1020302 }
 */
export function versionFromTag(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(tag ?? '');
  if (!m) throw new Error(`tag must look like v1.2.3 or v1.2.3-beta.1, got "${tag}"`);
  const [ , major, minor, patch, beta ] = m;
  // A stable release always ends in 99 so it outranks every beta of the same
  // semver; a beta keeps its own N, capped at 8 (a 9th beta should be the release).
  const suffix = beta === undefined ? 99 : Math.min(Number(beta), 8);
  return {
    versionName: tag.slice(1),
    versionCode:
      Number(major) * 1_000_000 + Number(minor) * 10_000 + Number(patch) * 100 + suffix,
  };
}
