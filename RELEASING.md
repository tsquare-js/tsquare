# Releasing

Pushing a `v*` tag runs [`.github/workflows/release.yml`](.github/workflows/release.yml). It checks the tag, builds and tests the tagged commit, publishes it to npm through trusted publishing (with provenance, no npm token), and creates the GitHub release from `CHANGELOG.md`.

## Cutting a release

1. In the release PR, bump the version with `npm version 0.9.0 --no-git-tag-version` (updates `package.json` and `package-lock.json`, makes no tag), and add a `## 0.9.0` section to `CHANGELOG.md`. Its body becomes the release notes.
2. Merge the PR.
3. Tag `main` and push the tag:

   ```bash
   git fetch origin
   git tag v0.9.0 origin/main
   git push origin v0.9.0
   ```

Before publishing, the workflow stops if the tag doesn't match the version in `package.json`, if the tagged commit isn't on `main`, if `CHANGELOG.md` has no section for the version, or if the typecheck or tests fail.

## When a run fails

- **Before publishing** (one of the checks above): the tag is on a commit that can't be released, and the "release tags" ruleset blocks deleting it. Either fix it on `main` and release the next patch version, or turn the ruleset off for a moment (Settings → Rules → Rulesets → release tags), delete the tag with `git push origin :refs/tags/v0.9.0`, turn the ruleset back on, and tag the right commit.
- **Publishing** fails with `ENEEDAUTH` or a 404: the trusted publisher settings below don't match (every field is case-sensitive). Fix them on npmjs.com, then Re-run failed jobs.
- **The GitHub release** fails: Re-run failed jobs. The publish job skips a version that's already on npm, so Re-run all jobs works too.

## One-time setup

Before the first release this way, someone who maintains the package on npm sets up trusted publishing:

1. On npmjs.com, open the `tsquare` package → **Settings** → **Trusted Publisher**, and choose **GitHub Actions**.
2. **Organization or user:** `tsquare-js`. **Repository:** `tsquare`. **Workflow filename:** `release.yml`. **Environment name:** leave empty.
3. **Allowed actions:** tick `npm publish`. Configurations created after September 3, 2026 allow only `npm stage publish` by default, and this workflow publishes directly.

After the first release has gone out this way, you can set the package's publishing access to "Require two-factor authentication and disallow tokens". Trusted publishing keeps working, and nobody can publish with a token.
