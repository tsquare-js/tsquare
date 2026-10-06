/**
 * Generates the component reference in docs/components/ from the catalog and
 * the playground's examples, so the docs can't drift from what the renderer
 * accepts. The other pages in docs/ are hand-written.
 *
 *   npm run docs
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { componentDefinitions } from "../src/catalog";
import { compileWireframe, formatIssues } from "../src/compile";
import { brandIconNames, iconNames } from "../src/icons";
import { componentDocs } from "../src/prompt";
import { renderWireframePng } from "../src/render";
import { bareWords } from "../src/text";
import { createRequire } from "node:module";

const LUCIDE_VERSION: string = createRequire(import.meta.url)("lucide/package.json").version;
// simple-icons doesn't export its package.json; read it next to the entry point
const SIMPLE_ICONS_VERSION: string = JSON.parse(readFileSync(path.join(path.dirname(createRequire(import.meta.url).resolve("simple-icons")), "package.json"), "utf8")).version;
import { EXAMPLES, GROUPS } from "../src/playground/reference";

const docsDir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(docsDir, "components");

/** Common UI icons for the picture on the icons page. Every name must be a valid icon (Lucide or brand-…). */
const ICON_GROUPS: Record<string, string[]> = {
  Navigation: ["menu", "x", "arrow-left", "arrow-right", "chevron-left", "chevron-right", "chevron-down", "chevron-up", "house", "search", "ellipsis", "ellipsis-vertical", "external-link"],
  Actions: ["plus", "pencil", "trash-2", "copy", "share", "download", "upload", "send", "save", "refresh-cw", "funnel", "settings", "log-in", "log-out"],
  Status: ["check", "circle-check", "circle-alert", "triangle-alert", "info", "circle-help", "loader", "lock", "eye", "eye-off"],
  "People & messages": ["user", "users", "bell", "mail", "message-circle", "phone", "calendar", "clock", "map-pin", "heart", "star", "bookmark"],
  "Media & files": ["image", "camera", "file", "folder", "paperclip", "play", "pause", "music", "video", "mic"],
  Commerce: ["shopping-cart", "credit-card", "tag", "gift", "wallet", "receipt", "package", "truck"],
  Data: ["chart-bar", "chart-line", "trending-up", "table", "list", "layout-grid", "database"],
  "Brand logos": brandIconNames,
};

/** The icon sheet is itself a tsquare board: one screen per group, a grid of icons with their names. */
function iconSheet() {
  const cols = 5;
  const screens = Object.entries(ICON_GROUPS).map(([group, names]) => {
    const rows = Math.ceil(names.length / cols);
    const cells = names.map((n) => `      stack gap=8 align=center
        icon ${n} size=24
        text "${n}" sm muted`).join("\n");
    return `  screen custom "${group}" width=620 height=${rows * 62 + 30}\n    grid columns=${cols} gap=8\n${cells}`;
  });
  return `board grid columns=2 "Common icons"\n${screens.join("\n")}\n`;
}

/** The picture in language.md's "Tooltips and open states", rendered so it matches the code. */
const OVERLAYS_EXAMPLE = `board "Tooltips and open states"
  screen custom "tooltip" width=330 height=250
    spacer size=34
    stack row gap=8
      button secondary "Draft" tooltip="Saves without publishing"
      button primary "Publish"
  screen custom "select open" width=330 height=250
    select "Country" value="Mexico" open options=[Canada, Mexico, United States]
  screen custom "date input open" width=330 height=440
    input "Check-in" type=date value="Oct 14, 2026" open
  screen custom "row menu" width=330 height=320 padding=0 gap=0
    navbar "Files" actions=[search]
    stack padding=16 gap=0
      list
        listitem "Report.pdf" leadingIcon=file-text
        listitem "Budget.xlsx" leadingIcon=sheet open menu=[Rename, Move, Delete]
        listitem "Notes.txt" leadingIcon=file
`;

async function writeOverlaysImage() {
  const { spec, issues } = compileWireframe(OVERLAYS_EXAMPLE);
  if (!spec || issues.length) throw new Error(`overlays example:\n${formatIssues(issues)}`);
  writeFileSync(path.join(docsDir, "overlays.png"), await renderWireframePng(spec, { skipValidation: true, scale: 1.5 }));
}

async function writeIconsPage() {
  const sheet = iconSheet();
  const { spec, issues } = compileWireframe(sheet);
  if (!spec || issues.length) throw new Error(`icon sheet:\n${formatIssues(issues)}`);
  writeFileSync(path.join(docsDir, "icons.png"), await renderWireframePng(spec, { skipValidation: true, scale: 1.5 }));

  const names = [...new Set(iconNames)].sort();
  const byLetter = new Map<string, string[]>();
  for (const n of names) byLetter.set(n[0], [...(byLetter.get(n[0]) ?? []), n]);
  const page = `# Icons

Icons come from [Lucide](https://lucide.dev/icons) (ISC license), an open-source set of line icons. Use any Lucide name in kebab-case:

\`\`\`tsquare
    icon search
    button "Download" leadingIcon=download
    navbar "Inbox" actions=[search, ellipsis-vertical]
    tabbar items=[{label=Home icon=house}, {label=Cart icon=shopping-cart}]
\`\`\`

Lucide's older names work too, such as \`home\` for \`house\`. An unknown name is an error with close matches, so it never renders as a blank:

\`\`\`
line 3: Icon: unknown icon "serach" (did you mean search?)
\`\`\`

Suggestions come from spelling and shared words (\`cart\` → \`shopping-cart\`), not meaning: \`notification\` won't suggest \`bell\`. To find an icon by meaning, search [lucide.dev/icons](https://lucide.dev/icons), which also lets you search by tags.

## Brand logos

A few brand logos, for sign-in buttons and integrations, named \`brand-…\`: ${brandIconNames.map((n) => `\`${n}\``).join(", ")}. They work anywhere an icon does, and are drawn in the wireframe's gray like the other icons:

\`\`\`tsquare
    button secondary "Continue with Google" leadingIcon=brand-google fullWidth
    listitem "GitHub" subtitle="Connected" leadingIcon=brand-github trailing=toggle
\`\`\`

The prefix matters: \`apple\` is Lucide's fruit and \`x\` its close icon, while \`brand-apple\` and \`brand-x\` are the logos. A brand name without the prefix suggests it (\`github\` → \`brand-github\`).

The logos come from [Simple Icons](https://simpleicons.org) ${SIMPLE_ICONS_VERSION} (CC0). The logos themselves are trademarks of their owners; using them in a wireframe to show a sign-in option or an integration is the usual case. Simple Icons has no Slack, LinkedIn or Microsoft logo, so tsquare doesn't either.

## Common icons

![Common icons](icons.png)

## Every name

All ${names.length} names tsquare accepts (Lucide ${LUCIDE_VERSION}, plus the ${brandIconNames.length} brand logos), generated by \`npm run docs\`. Use your browser's find to search.

${[...byLetter].map(([l, ns]) => `### ${l.toUpperCase()}\n\n${ns.map((n) => `\`${n}\``).join(" · ")}`).join("\n\n")}
`;
  writeFileSync(path.join(docsDir, "icons.md"), page);
}
const slug = (name: string) => name.toLowerCase();
const code = (s: string) => "`" + s + "`";
// "primary" | "secondary" → primary, secondary (pipes would break the Markdown table)
const values = (type: string) => type.replace(/"/g, "").replace(/ \| /g, ", ");
const list = (items: string[]) => items.map(code).join(", ");
const groupOf = (name: string) => GROUPS.find((g) => g.components.includes(name))!.name;

function writingIt(name: string, props: { name: string; main: boolean; type: string }[]) {
  const lines: string[] = [];
  const words = bareWords(name);
  const main = props.find((p) => p.main);
  if (main) {
    lines.push(
      words.wordPrimary
        ? `A word or quoted string sets **${main.name}**: ${code(`${slug(name)} search`)} or ${code(`${slug(name)} "arrow-left"`)}.`
        : name === "Flow" // its two ends come first: flow <from> -> <to> "label"
          ? `After the two ends, a quoted string sets **${main.name}**: ${code('flow submit -> home "…"')}.`
          : `A quoted string sets **${main.name}**: ${code(`${slug(name)} "…"`)}.`,
    );
  }
  const byProp = new Map<string, string[]>();
  for (const { value, prop } of words.options) byProp.set(prop, [...(byProp.get(prop) ?? []), value]);
  for (const [prop, vals] of byProp) lines.push(`Bare words set **${prop}**: ${list(vals)}.`);
  if (words.ambiguous.length) {
    const owners = props.filter((p) => words.ambiguous.some((v) => values(p.type).split(", ").includes(v))).map((p) => p.name);
    const [v] = words.ambiguous;
    lines.push(
      `${list(words.ambiguous)} are options of ${owners.map((o) => `**${o}**`).join(" and ")}, so write which one you mean: ` +
        owners.map((o) => code(`${o}=${v}`)).join(" or ") + ".",
    );
  }
  for (const b of words.booleans) {
    if (b === "on") lines.push(`${code("on")} and ${code("off")} switch it on and off.`);
    else if (b === "checked") lines.push(`${code("checked")} and ${code("unchecked")} set whether it's checked.`);
    else lines.push(`${code(b)} turns **${b}** on; ${code(`no-${b}`)} turns it off.`);
  }
  lines.push("Anything else is written " + code("key=value") + ".");
  const slots = (componentDefinitions as Record<string, { slots: string[] }>)[name].slots;
  lines.push(slots.length ? "Holds other elements: indent them two spaces below it." : "Has no children.");
  return lines.map((l) => `- ${l}`).join("\n");
}

async function main() {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(path.join(out, "images"), { recursive: true });
  const docs = componentDocs();

  for (const c of docs) {
    const example = EXAMPLES[c.name];
    const { spec, issues } = compileWireframe(example);
    if (!spec || issues.length) throw new Error(`${c.name} example:\n${formatIssues(issues)}`);
    writeFileSync(path.join(out, "images", `${slug(c.name)}.png`), await renderWireframePng(spec, { skipValidation: true, scale: 2 }));

    const rows = c.props.map((p) => {
      const tags = [p.main && "main text", p.required && "required"].filter(Boolean).join(", ");
      return `| ${code(p.name)}${tags ? ` *(${tags})*` : ""} | ${values(p.type)} | ${p.description ?? ""} |`;
    });
    const page = `# ${c.name}

${code(slug(c.name))} · ${groupOf(c.name)} · [All components](README.md)

${c.description}

![${c.name} example](images/${slug(c.name)}.png)

\`\`\`tsquare
${example.trimEnd()}
\`\`\`

## Writing it

${writingIt(c.name, c.props)}${c.props.some((p) => /Lucide/.test(p.description ?? "")) ? "\n\nIcon names: see [Icons](../icons.md) for the common ones and every name." : ""}

## Props

| Prop | Values | Notes |
|---|---|---|
${rows.join("\n")}
`;
    writeFileSync(path.join(out, `${slug(c.name)}.md`), page);
  }

  const index = `# Components

Every component, grouped as in the playground. Each page has a rendered example, its source, how to write it, and its props. These pages are generated from the catalog by \`npm run docs\`.

Any element inside a screen can also take \`tooltip="…"\`; see [Tooltips and open states](../language.md#tooltips-and-open-states).

${GROUPS.map((g) => `## ${g.name}

| Component | What it's for |
|---|---|
${g.components.map((n) => `| [${slug(n)}](${slug(n)}.md) | ${docs.find((d) => d.name === n)!.description} |`).join("\n")}`).join("\n\n")}
`;
  writeFileSync(path.join(out, "README.md"), index);
  await writeIconsPage();
  await writeOverlaysImage();
  console.log(`wrote ${docs.length} component pages to ${path.relative(process.cwd(), out)}`);
}

main();
