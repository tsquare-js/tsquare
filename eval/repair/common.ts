import { readFileSync } from "node:fs";

/** The runs whose failed first tries make up the repair set: the 0.3.0 prompts. */
export const RUNS = ["text-v3", "text-v3-rerun", "text-v4", "text-v4-rerun"];
export const MODELS = ["sonnet", "haiku"];

/** The wireframe in a reply: its fenced block, else the whole file. */
export const body = (file: string) => {
  const raw = readFileSync(file, "utf8");
  return (raw.match(/```[\w-]*\n([\s\S]*?)```/)?.[1] ?? raw).trim();
};
