# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A mobile settings screen with a top bar that has a back button. Show toggles for Notifications and Dark mode, an Account section with rows that have chevrons, and a Sign out button at the bottom.

## Assistant (your first reply)
```tsquare
board "Settings"
  screen phone
    navbar "Settings" leading=back
    stack gap=24 padding=16
      stack gap=16
        heading "Notifications" level=2
        toggle "Push notifications" on
        toggle "Email notifications" off
      stack gap=16
        heading "Appearance" level=2
        toggle "Dark mode" off
      stack gap=16
        heading "Account" level=2
        list dividers
          listitem "Email"
            trailing=chevron
          listitem "Password"
            trailing=chevron
          listitem "Privacy"
            trailing=chevron
      spacer
      button "Sign out" fullWidth variant=secondary
```

## User
The wireframe has these problems:
line 16: unknown component "trailing" (components: board, screen, note, stack, grid, card, divider, spacer, heading, text, image, icon, avatar, badge, button, input, checkbox, radio, toggle, select, navbar, tabbar, tabs, list, listitem, table, modal, drawer)
line 18: unknown component "trailing" (components: board, screen, note, stack, grid, card, divider, spacer, heading, text, image, icon, avatar, badge, button, input, checkbox, radio, toggle, select, navbar, tabbar, tabs, list, listitem, table, modal, drawer)
line 20: unknown component "trailing" (components: board, screen, note, stack, grid, card, divider, spacer, heading, text, image, icon, avatar, badge, button, input, checkbox, radio, toggle, select, navbar, tabbar, tabs, list, listitem, table, modal, drawer)

Reply with the corrected wireframe in a single code block.
