# Select

`select` · Controls · [All components](README.md)

Dropdown field (closed state).

![Select example](images/select.png)

```tsquare
board
  screen custom width=380 height=260
    select "Country" value="Mexico"
    select "Size" placeholder="Choose one" width=160
    stack row gap=12
      input "City" placeholder="Monterrey" grow
      select "State" value="Nuevo León" grow
```

## Writing it

- A quoted string sets **label**: `select "…"`.
- `grow` turns **grow** on; `no-grow` turns it off.
- Anything else is written `key=value`.
- Has no children.

## Props

| Prop | Values | Notes |
|---|---|---|
| `label` *(main text)* | string |  |
| `value` | string |  |
| `placeholder` | string |  |
| `grow` | boolean | Fill the remaining space in a row |
| `width` | number, string | Fixed width, e.g. 320. Default fills the space. |
