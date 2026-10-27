/** Visual regressions: each board in test/regressions/ renders like its reference PNG (see regressions.ts). */
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { boards, compare, dir, renders } from "./regressions.js";

for (const name of boards()) {
  test(`${name} looks like its reference`, async () => {
    for (const [file, actual] of Object.entries(await renders(name))) {
      const ref = path.join(dir, file);
      const failed = ref.replace(/\.png$/, ".actual.png");
      assert.ok(existsSync(ref), `${file} has no reference: run npm run regressions, look at it, and commit it`);
      const diff = compare(readFileSync(ref), actual);
      if (!diff.changed) {
        rmSync(failed, { force: true });
        continue;
      }
      writeFileSync(failed, actual);
      const where = diff.size ? `size ${diff.size}` : `${diff.changed} pixels in ${diff.box!.width}×${diff.box!.height} at ${diff.box!.x},${diff.box!.y}`;
      assert.fail(`${file} changed (${where}). The new render is ${path.relative(process.cwd(), failed)}; if the change is intended, run npm run regressions and commit the new reference.`);
    }
  });
}
