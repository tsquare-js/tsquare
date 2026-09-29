# NavBar

`navbar` · Navigation & data · [All components](README.md)

Top app bar. Place first in a Screen.

![NavBar example](images/navbar.png)

```tsquare
board
  screen custom width=380 height=240 padding=0 gap=0
    navbar "leading=menu" leading=menu actions=[search, bell]
    navbar "leading=back, centered" leading=back align=center actions=[share]
    navbar "leading=close" leading=close
    navbar "leading=logo" leading=logo actions=[user]
```

## Writing it

- A quoted string sets **title**: `navbar "…"`.
- Bare words set **leading**: `none`, `menu`, `back`, `close`, `logo`.
- Bare words set **align**: `left`, `center`.
- Anything else is written `key=value`.
- Has no children.

## Props

| Prop | Values | Notes |
|---|---|---|
| `title` *(main text)* | string |  |
| `leading` | none, menu, back, close, logo |  |
| `actions` | array of string | Icon names shown on the right |
| `align` | left, center |  |
