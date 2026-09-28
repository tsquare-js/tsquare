#!/usr/bin/env node
// The CLI is TypeScript (with JSX components); tsx loads it at runtime so
// `npm link` and `npx tsquare` work without a build step.
import { register } from "tsx/esm/api";

register();
await import("../src/cli.ts");
