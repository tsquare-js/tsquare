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

`npx tsquare playground` opens an editor at http://localhost:4321 that renders as you type, lists problems by line, and exports SVG and PNG. Its Components tab has every component with an example you can open in the editor.

## Next

- [The language](language.md): lines, bare words, lists, comments, errors.
- [Components](components/README.md): every component with an example and its props.
- [Icons](icons.md): the common icons and every name you can use.
- [Colors](colors.md): the accent color, badge tones and input errors.
- [Using it with AI](ai.md): the model prompt, the repair loop, and the Claude skill.
