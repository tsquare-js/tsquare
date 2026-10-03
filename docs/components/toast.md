# Toast

`toast` · Overlays · [All components](README.md)

Short message over the screen, e.g. after saving. Must be a direct child of a Screen, listed last.

![Toast example](images/toast.png)

```tsquare
board
  screen phone "Bottom, above a tab bar"
    heading "Inbox" level=2
    list
      listitem "Ana Torres" subtitle="Lunch on Friday?" leading=avatar
      listitem "Ben Cho" subtitle="Draft attached" leading=avatar
    tabbar items=[{label=Inbox icon=inbox}, {label=Settings icon=settings}]
    toast "Message sent" action="Undo" icon=check
  screen phone "Top"
    heading "Profile" level=2
    image height=160
    toast "Changes saved" position=top
```

## Writing it

- A quoted string sets **text**: `toast "…"`.
- Bare words set **position**: `bottom`, `top`.
- Anything else is written `key=value`.
- Has no children.

Icon names: see [Icons](../icons.md) for the common ones and every name.

## Props

| Prop | Values | Notes |
|---|---|---|
| `text` *(main text)* | string |  |
| `action` | string | A text button, e.g. "Undo" |
| `icon` | string | Lucide icon name in kebab-case, e.g. menu, search, arrow-left, settings, bell, user |
| `position` | bottom, top | Default bottom, above a TabBar |
