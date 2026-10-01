/**
 * Builds the Claude skill in skill/tsquare/ from the catalog, the same way the
 * model prompt is built, so the skill can't drift from what the renderer accepts.
 *
 *   npm run skill
 *
 * Install by copying skill/tsquare to ~/.claude/skills/tsquare (all projects)
 * or <project>/.claude/skills/tsquare (one project).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printWireframeText } from "../src/print";
import { exampleSpec } from "../src/prompt-example";
import { EXAMPLE_REQUEST, RULES, TEXT_FORMAT, componentReference } from "../src/prompt";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "tsquare");

const skill = `---
name: tsquare
description: Create low-fidelity UI wireframes and mockups (app screens, several devices side by side, boards for specs and docs) as tsquare text, then render them to PNG or SVG with the tsquare CLI. Use when asked to wireframe, mock up or sketch a UI screen, page or flow, or to add a UI mockup to a document.
---

# tsquare wireframes

tsquare is a small text language for UI wireframe boards. You write a \`.tsq\` file; the \`tsquare\` CLI checks it and renders it to a clean, grayscale PNG or SVG.

## Workflow

1. **Write** the wireframe to \`<name>.tsq\`, following the syntax below. Every component and prop is listed in [reference.md](reference.md); read it before using a component you haven't used yet.
2. **Check:** \`tsquare check <name>.tsq\`. It lists problems by line, with the valid options or a "did you mean". Fix every one and check again until it says the file is valid.
3. **Render:** \`tsquare render <name>.tsq -o <name>.png --scale 2\` (use \`-o <name>.svg\` for docs that take SVG).
4. **Look at the PNG** before showing it. The checker can't see layout, so check for:
   - content cut off at the bottom of a screen (screens have a fixed height; nothing warns about clipping). Remove content, split it into another screen, or give the screen a larger \`height\` (it works on any device).
   - cramped rows, or text squeezed into narrow columns.
   - anything the request asked for that's missing.
   Fix the \`.tsq\` and render again.
5. **Deliver** the image path and the \`.tsq\` source, so the user can edit it later.

If \`tsquare\` isn't installed, run it through npx (\`npx tsquare check <name>.tsq\`); it needs Node 20 or newer. If that fails, stop and ask the user how they want it installed.

## Keep in mind

- One wireframe is one **board**: several **screens** side by side (phone, tablet, desktop or custom sizes), plus **notes** beside them. Show states or steps of a flow as separate screens.
- Wireframes are low fidelity: placeholders (\`image\`, \`text lines=3\`) beat invented copy, unless the copy matters.
- Stay grayscale unless the user asks for color or a brand. Then set \`accent\` on the board; don't look for other color props, there aren't any.

${TEXT_FORMAT.replace('(marked "main text" below)', '(marked "main text" in reference.md)')}

${RULES}

## Example

Request: ${EXAMPLE_REQUEST}

\`\`\`tsquare
${printWireframeText(exampleSpec).trimEnd()}
\`\`\`
`;

const reference = `# tsquare components

Every component and its props, generated from the catalog. All props are optional unless marked required. "main text" is the prop a quoted string fills.

${componentReference()}`;

mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "SKILL.md"), skill);
writeFileSync(path.join(dir, "reference.md"), reference);
console.log(`wrote ${path.relative(process.cwd(), dir)}/SKILL.md and reference.md`);
