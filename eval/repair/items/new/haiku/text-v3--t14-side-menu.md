# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
A phone screen with the side menu open from the left: user avatar and name at the top, 5 menu items, and Log out at the bottom.

## Assistant (your first reply)
```tsquare
board "Side navigation"
  screen phone "Menu open"
    navbar "App" leading=close
    drawer left
      stack gap=16 padding=16
        stack row gap=12
          avatar "JD" size=48
          stack
            text "John Doe" bold
            text sm "john@example.com" muted
        divider
        stack gap=8
          button "Home" variant=ghost align=left
          button "Profile" variant=ghost align=left
          button "Settings" variant=ghost align=left
          button "Help" variant=ghost align=left
          button "About" variant=ghost align=left
        spacer
        button "Log out" variant=ghost align=left
```

## User
The wireframe has these problems:
line 13: Button has no prop "align": align is a Stack, Heading, Text… prop, not a Button one (its props: label, variant, size, leadingIcon, trailingIcon, fullWidth)
line 14: Button has no prop "align": align is a Stack, Heading, Text… prop, not a Button one (its props: label, variant, size, leadingIcon, trailingIcon, fullWidth)
line 15: Button has no prop "align": align is a Stack, Heading, Text… prop, not a Button one (its props: label, variant, size, leadingIcon, trailingIcon, fullWidth)
line 16: Button has no prop "align": align is a Stack, Heading, Text… prop, not a Button one (its props: label, variant, size, leadingIcon, trailingIcon, fullWidth)
line 17: Button has no prop "align": align is a Stack, Heading, Text… prop, not a Button one (its props: label, variant, size, leadingIcon, trailingIcon, fullWidth)
line 19: Button has no prop "align": align is a Stack, Heading, Text… prop, not a Button one (its props: label, variant, size, leadingIcon, trailingIcon, fullWidth)

Reply with the corrected wireframe in a single code block.
