# Embedding wireframes

A wireframe goes anywhere an image goes. There are two ways to get one there:

- **An image link** from tsquare.dev, such as `https://tsquare.dev/svg/z…`. The wireframe text is inside the link, so nothing is stored anywhere, and the link always draws the same wireframe.
- **A file** you render yourself with the CLI or the library, with no dependency on tsquare.dev.

The playground's **Copy link** menu makes every kind of link:

| Menu item | What you get | Use it for |
|---|---|---|
| Image link (SVG) | `https://tsquare.dev/svg/z…` | Notion, GitHub, docs sites, most tools |
| Image link (PNG) | `https://tsquare.dev/png/z…` | Slides, and tools that don't show SVG |
| Markdown | `![Title](https://tsquare.dev/svg/z…)` | READMEs, issues, Markdown docs |
| HTML | `<img src="https://tsquare.dev/svg/z…" alt="Title">` | Web pages |
| Share link | `https://tsquare.dev/playground#z…` | Sending someone the editable wireframe |

Image links are compressed, **not encrypted**: anyone with the link can read the wireframe text. Don't put anything secret in one you share. See [privacy](https://tsquare.dev/privacy).

## Notion

1. In the playground, choose **Copy link → Image link (SVG)**.
2. In Notion, type `/image`, choose **Embed link**, and paste it.

The PNG link works just as well and looks the same. SVG stays sharp at any zoom; PNG is drawn at 2×.

To change the wireframe, open the share link (or paste the text into the playground), edit, and replace the image with the new link. Each link always draws the same picture, so an old one never changes under you.

## GitHub

In a README, issue, pull request or wiki page, paste the **Markdown** item:

```markdown
![Sign in](https://tsquare.dev/svg/zNYwxDsIwEAT7vGJ…)
```

GitHub shows SVG images, and its image proxy caches them.

GitHub can't draw a ```` ```tsquare ```` code block itself. To keep the source next to the picture so others can edit it, put it in a collapsed section under the image:

````markdown
![Sign in](https://tsquare.dev/svg/z…)

<details><summary>Wireframe source</summary>

```tsquare
board "Sign in"
  screen phone
    heading "Welcome back"
    button primary "Sign in" fullWidth
```

</details>
````

Alternatively, commit the `.tsq` file and a rendered SVG next to it (see the next section).

## Your own site

For a static page, the **HTML** item works as is:

```html
<img src="https://tsquare.dev/svg/z…" alt="Sign in">
```

To avoid depending on tsquare.dev, or to keep wireframe text out of URLs, render at build time instead:

```bash
npx tsquare render signin.tsq -o public/signin.svg
```

Or from Node, with the library:

```js
import { renderWireframe } from "tsquare";

const svg = await renderWireframe(text, { format: "svg" });
```

`renderWireframe` throws with line-numbered problems if the text is invalid. [Using it with AI](ai.md) covers the repair loop for wireframes a model writes.
