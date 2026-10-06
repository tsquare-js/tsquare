# Releasing

[`.github/workflows/release.yml`](.github/workflows/release.yml) publishes `tsquare` to npm, tags the commit and creates the GitHub release. It runs on every push to `main` and does something only when the `version` in `package.json` isn't on npm yet; other pushes finish with "Nothing to do".

## Cutting a release

1. In the release PR, bump the version with `npm version 0.9.0 --no-git-tag-version`. It updates `package.json` and `package-lock.json` and makes no tag (the workflow tags).
2. Add a `## 0.9.0` section to `CHANGELOG.md`. Its body becomes the release notes. If the section is missing or empty, the workflow stops before publishing.
3. Merge the PR with a regular merge.

The workflow then runs the typecheck, tests and build (as CI does), publishes `tsquare@0.9.0` through npm trusted publishing (with provenance), tags the merged commit `v0.9.0`, and creates the `v0.9.0` GitHub release from the changelog section. No `npm login`, `git tag` or `gh release` by hand.

## When a run fails

Fix the cause and rerun it (Actions → Release → the failed run → Re-run jobs). A rerun never publishes twice: it checks npm, the tag and the release, and does only what's missing. Tags are never moved. If the version is on npm but has no tag, and the run isn't on the commit npm says it was published from, it stops and names that commit instead of guessing.

A publish that fails with `ENEEDAUTH` or a 404 usually means the trusted publisher settings below don't match: every field is case-sensitive.

## One-time setup

Before the first automated release, someone who maintains the package on npm sets up trusted publishing:

1. On npmjs.com, open the `tsquare` package → **Settings** → **Trusted Publisher**, and choose **GitHub Actions**.
2. **Organization or user:** `tsquare-js`. **Repository:** `tsquare`. **Workflow filename:** `release.yml`. **Environment name:** leave empty.
3. **Allowed actions:** tick `npm publish`. Configurations created after September 3, 2026 allow only `npm stage publish` by default, and this workflow publishes directly.

After the first release has gone out this way, you can set the package's publishing access to "Require two-factor authentication and disallow tokens". Trusted publishing keeps working, and nobody can publish with a token.
