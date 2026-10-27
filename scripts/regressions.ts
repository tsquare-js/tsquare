/**
 * Rewrites the reference renders of the visual regression boards (test/regressions/), and says which
 * changed. Run it only for an intended change, look at every changed image, and commit them.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { boards, compare, dir, renders } from "../test/regressions.js";

for (const name of boards()) {
  for (const [file, image] of Object.entries(await renders(name))) {
    const ref = path.join(dir, file);
    const before = existsSync(ref) ? compare(readFileSync(ref), image) : null;
    writeFileSync(ref, image);
    rmSync(ref.replace(/\.png$/, ".actual.png"), { force: true });
    console.log(`${!before ? "new      " : before.changed ? "changed  " : "unchanged"} test/regressions/${file}`);
  }
}
