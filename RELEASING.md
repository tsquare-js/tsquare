# Releasing

[`.github/workflows/release.yml`](.github/workflows/release.yml) publishes `tsquare` to npm, tags the commit and creates the GitHub release. It runs on every push to `main` and looks only at the `version` in `package.json`:

- **Not on npm yet:** it checks, builds and publishes that version, tags the commit it published `v<version>`, and creates the GitHub release.
- **Already on npm:** it never publishes. If the tag or the release for that version is missing, it creates it. It only creates a missing tag when npm says the version was published from the commit the run is on. Otherwise it stops and names the commit to tag. A missing release is created on the existing tag, with a warning if that tag isn't on the commit npm says was published.
- **On npm, tagged and released** (most pushes): nothing happens, and the run reports "Nothing to do".

It never moves or deletes a tag, and never touches older versions.

## Cutting a release

1. In the release PR, bump the version with `npm version 0.9.0 --no-git-tag-version`. It updates `package.json` and `package-lock.json` and makes no tag (the workflow tags).
2. Add a `## 0.9.0` section to `CHANGELOG.md`. Its body becomes the release notes. If the section is missing or empty, the workflow stops before publishing.
3. Merge the PR with a regular merge.

The workflow then runs the typecheck, tests and build (as CI does) and packs the package. A separate job, which runs no dependency code, publishes that tarball through npm trusted publishing (with provenance). The last job tags the merged commit `v0.9.0` and creates the `v0.9.0` GitHub release from the changelog section. There's no `npm login`, `git tag` or `gh release` to run by hand.

## When a run fails

Fix the cause and rerun it (Actions → Release → the failed run → Re-run failed jobs, or Re-run all jobs). Either way, a rerun never publishes twice: the publish and tag jobs check npm, the tag and the release again, and do only what's still missing. A failed build or publish never tags.

If the version is on npm but has no tag, and the run isn't on the commit npm says it was published from (for example, a later push to `main`), it stops and names that commit instead of guessing. Rerun the run that published, or tag that commit by hand.

A publish that fails with `ENEEDAUTH` or a 404 usually means the trusted publisher settings below don't match: every field is case-sensitive.

## One-time setup

Before the first automated release, someone who maintains the package on npm sets up trusted publishing:

1. On npmjs.com, open the `tsquare` package → **Settings** → **Trusted Publisher**, and choose **GitHub Actions**.
2. **Organization or user:** `tsquare-js`. **Repository:** `tsquare`. **Workflow filename:** `release.yml`. **Environment name:** leave empty.
3. **Allowed actions:** tick `npm publish`. Configurations created after September 3, 2026 allow only `npm stage publish` by default, and this workflow publishes directly.

After the first release has gone out this way, you can set the package's publishing access to "Require two-factor authentication and disallow tokens". Trusted publishing keeps working, and nobody can publish with a token.
