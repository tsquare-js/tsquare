import { writeFileSync } from "node:fs";
import { tasks } from "./tasks";
const half = (a: number, b: number) =>
  tasks.slice(a, b).map((t) => `## ${t.id}\n${t.prompt}\n`).join("\n");
writeFileSync("eval/tasks-a.md", half(0, 10));
writeFileSync("eval/tasks-b.md", half(10, 20));
