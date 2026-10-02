# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
A mobile settings screen with a top bar that has a back button. Show toggles for Notifications and Dark mode, an Account section with rows that have chevrons, and a Sign out button at the bottom.

## Assistant (your first reply)
```tsquare
board "Settings"
  screen phone "Settings"
    navbar leading=back
    stack gap=20
      heading "Settings" level=2 padding=16
      card
        list dividers
          listitem "Notifications" trailing=toggle
          listitem "Dark mode" trailing=toggle
      heading "Account" level=2 padding=16
      card
        list dividers
          listitem "Profile"
          listitem "Security"
          listitem "Preferences"
      spacer
      button primary "Sign out" fullWidth padding=16
```

## User
The wireframe has these problems:
line 5: Heading has no prop "padding" (its props: text, level, align)
line 10: Heading has no prop "padding" (its props: text, level, align)
line 17: Button has no prop "padding" (its props: label, variant, size, leadingIcon, trailingIcon, fullWidth)

Reply with the corrected wireframe in a single code block.
