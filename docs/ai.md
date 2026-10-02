# Using it with AI

tsquare is built for models to write. The pieces below are all generated from the component catalog, so they always match what the renderer accepts.

## The prompt

`tsquare prompt` prints a system prompt that teaches a model the language: the syntax, the rules, a worked example, and every component with its props. Give it to the model as its system prompt, then ask for a wireframe:

```bash
npx tsquare prompt > tsquare-prompt.md
```

Replies come back as a ```` ```tsquare ```` code block. You can render a reply as-is: code fences are ignored.

## The repair loop

If a reply has problems, send them back to the model. The errors name the line and the valid options, which is usually enough for a model to fix its output in one round:

```ts
import { wireframePrompt, repairPrompt, compileWireframe, formatIssues, renderWireframe } from "tsquare";

const system = wireframePrompt();
let reply = await callModel(system, [{ role: "user", content: "A settings screen with toggles" }]);

const { issues } = compileWireframe(reply);
if (issues.length) reply = await callModel(system, [...history, { role: "user", content: repairPrompt(formatIssues(issues)) }]);

const png = await renderWireframe(reply, { format: "png", scale: 2 });
```

Install it with `npm install tsquare`. It needs Node 20 or newer.

## The Claude skill

`skill/tsquare/` in the repo is a Claude skill. It teaches Claude the language and a workflow: write the `.tsq` file, run `tsquare check` and fix every line it reports, run `tsquare render`, then look at the PNG for problems the checker can't see, such as content cut off at the bottom of a screen.

To install it, copy the folder to `~/.claude/skills/tsquare` (all projects) or `<project>/.claude/skills/tsquare` (one project), and make sure `npx tsquare` runs in that environment.

## How well models write it

On 20 requests, Sonnet wrote a valid wireframe on the first try every time, and Haiku 80% of the time, using about a quarter of the tokens the same wireframes take in JSON. See [the evals](../eval/README.md) for the method, every model output, and the caveats.
