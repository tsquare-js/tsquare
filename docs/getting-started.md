# Getting started

## Render your first wireframe

tsquare needs Node 20 or newer. Save this as `login.tsq`:

```tsquare
board "Login"
  screen phone "Sign in"
    heading "Welcome back"
    input "Email" placeholder="you@example.com"
    input password "Password"
    checkbox "Remember me" checked
    button primary "Sign in" fullWidth
```

Check it, then render it:

```bash
npx tsquare check login.tsq
npx tsquare render login.tsq -o login.png --scale 2
```

`-o login.svg` writes an SVG instead. `--scale 2` doubles the PNG's resolution for sharp images in docs.

## Add a second screen

A board holds several screens side by side. Add a second one under the board, at the same indentation as the first, and a note beside them:

```tsquare
board "Login"
  screen phone "Sign in"
    heading "Welcome back"
    input "Email" placeholder="you@example.com"
    input password "Password"
    button primary "Sign in" fullWidth
  screen phone "Forgot password"
    navbar "Reset password" leading=back
    text "We'll email you a reset link." muted
    input "Email"
    button primary "Send link" fullWidth
  note "Rate-limit reset emails"
```

## The playground

Try it online at [tsquare.dev/playground](https://tsquare.dev/playground), or run `npx tsquare playground` for a local copy at http://localhost:4321. The editor autocompletes components, options and icons and underlines problems as you type, the preview zooms in on any screen, and **Copy link** makes a share link or an image link you can paste into Notion, GitHub or your docs. Its Components tab has every component with an example you can open in the editor.

## Next

- [The language](language.md): lines, bare words, lists, comments, errors.
- [Components](components/README.md): every component with an example and its props.
- [Icons](icons.md): the common icons and every name you can use.
- [Colors](colors.md): the accent color, badge tones and input errors.
- [Using it with AI](ai.md): the model prompt, the repair loop, and the Claude skill.
