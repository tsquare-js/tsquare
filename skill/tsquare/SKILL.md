---
name: tsquare
description: Create low-fidelity UI wireframes and mockups (app screens, several devices side by side, boards for specs and docs) as tsquare text, then render them to PNG or SVG with the tsquare CLI. Use when asked to wireframe, mock up or sketch a UI screen, page or flow, or to add a UI mockup to a document.
---

# tsquare wireframes

tsquare is a small text language for UI wireframe boards. You write a `.tsq` file; the `tsquare` CLI checks it and renders it to a clean, grayscale PNG or SVG.

## Workflow

1. **Write** the wireframe to `<name>.tsq`, following the syntax below. Every component and prop is listed in [reference.md](reference.md); read it before using a component you haven't used yet.
2. **Check:** `tsquare check <name>.tsq`. It lists problems by line, with the valid options or a "did you mean". Fix every one and check again until it says the file is valid.
3. **Render:** `tsquare render <name>.tsq -o <name>.png --scale 2` (use `-o <name>.svg` for docs that take SVG).
4. **Look at the PNG** before showing it. The checker can't see layout, so check for:
   - content cut off at the bottom of a screen (screens have a fixed height; nothing warns about clipping). Remove content, split it into another screen, or give the screen a larger `height` (it works on any device).
   - cramped rows, or text squeezed into narrow columns.
   - anything the request asked for that's missing.
   Fix the `.tsq` and render again.
5. **Deliver** the image path and the `.tsq` source, so the user can edit it later.

If `tsquare` isn't installed, run it through npx (`npx tsquare check <name>.tsq`); it needs Node 20 or newer. If that fails, stop and ask the user how they want it installed.

## Keep in mind

- One wireframe is one **board**: several **screens** side by side (phone, tablet, desktop or custom sizes), plus **notes** beside them. Show states or steps of a flow as separate screens.
- Wireframes are low fidelity: placeholders (`image`, `text lines=3`) beat invented copy, unless the copy matters.
- Stay grayscale unless the user asks for color or a brand. Then set `accent` on the board; don't look for other color props, there aren't any.

## Output format: wireframe text
One element per line. Indent children two spaces under their parent. The first line is the board.

A line is the component name in lowercase, followed by arguments separated by spaces:
- "a quoted string" sets the component's main text prop (marked "main text" in reference.md)
- a bare word that is one of the component's option values sets that option: phone, desktop, primary, ghost, row, sm, left, bottom, password, …
- a bare prop name sets a boolean prop to true: checked, fullWidth, grow, muted. `off` and `unchecked` set on/checked to false
- key=value sets any prop. Values: "string", number, true/false, bare word, [list, of, values], {key=value key=value}
- "#" starts a comment

Lists: items are separated by commas, and an item can contain spaces without quotes: [All notes, Pinned, Shared]. To put a comma inside an item, quote the item: ["$1,200", "Smith, J"]. Inside quotes, write \" for a quote character. Numbers in a list of text are fine: [2023, 2024].

If a bare word could mean more than one prop, write it as key=value.

## Rules
1. The top element is a Board. The Board's children are Screens, plus optional Notes beside them.
2. Each Screen is one view of the product. Use several Screens to show several views or states.
3. A Screen lays out its children top to bottom. Use Stack (direction row or column) and Grid to arrange content.
4. NavBar is pinned to the top of its Screen and TabBar to the bottom.
5. Modal and Drawer are overlays. They must be direct children of a Screen.
6. This is a low-fidelity wireframe. Prefer placeholders (Image boxes, Text with lines) over invented copy unless the copy matters.
7. Only use the components and props listed below. All props are optional unless marked required.
8. Wireframes are grayscale. The only UI colors: Board accent (one color for primary buttons, checked controls, toggles, active tabs and ghost buttons), Badge tone (success, warning, danger) and Input error. Only add an accent if the request asks for color or a brand.

## Example

Request: Two phone screens for a recipe app: a browse screen with search, category tabs, a grid of recipe cards and a tab bar; and a recipe detail screen with its options sheet open.

```tsquare
board "Recipe app"
  screen phone "Browse"
    navbar "Recipes" leading=menu actions=[bell]
    input search placeholder="Search recipes"
    tabs items=[All, Quick, Vegetarian] active=0
    grid columns=2 gap=12
      card padding=10
        image height=110
        text "Tomato soup" bold
        text sm "25 min" muted
      card padding=10
        image height=110
        text lines=2
    tabbar items=[{label=Browse icon=book-open}, {label=Saved icon=heart}, {label=Profile icon=user}] active=0
  screen phone "Recipe"
    navbar leading=back actions=[share, more-horizontal]
    image "Photo" height=200
    heading "Tomato soup" level=1
    stack row gap=8
      badge outline "25 min"
      badge outline "Vegan"
    text lines=4
    button primary "Start cooking" fullWidth
    drawer bottom "Options" size=260
      toggle "Metric units" on
      select "Servings" value="4"
      checkbox "Add to shopping list"
  note "Detail screen shown with the options sheet open."
```
