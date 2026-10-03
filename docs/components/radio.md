# Radio

`radio` · Controls · [All components](README.md)

Radio button with label.

![Radio example](images/radio.png)

```tsquare
board
  screen custom width=380 height=230
    radio "Selected" checked
    radio "Not selected"
    radio "Not selected"
    text "Side by side: put them in a row" sm muted
    stack row gap=20
      radio "Standard" checked
      radio "Express"
      radio "Pickup"
```

## Writing it

- A quoted string sets **label**: `radio "…"`.
- `checked` and `unchecked` set whether it's checked.
- Anything else is written `key=value`.
- Has no children.

## Props

| Prop | Values | Notes |
|---|---|---|
| `label` *(main text)* | string |  |
| `checked` | boolean |  |
