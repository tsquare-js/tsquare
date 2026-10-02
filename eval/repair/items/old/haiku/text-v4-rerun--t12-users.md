# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
Two desktop screens for user management. First: tabs for Active, Invited, and Suspended, and a table with 4 real-looking user rows (name, email, role, status). Second: the same page with a Filters drawer open on the right.

## Assistant (your first reply)
```tsquare
board "User Management"
  screen desktop "Users List"
    navbar "Users" leading=none actions=[plus]
    stack padding=16 gap=16
      tabs items=[Active, Invited, Suspended] active=0
      table columns=["Name", "Email", "Role", "Status"] rows=4
        data=[["Alice Johnson", "alice@example.com", "Admin", "Active"], ["Bob Smith", "bob@example.com", "Editor", "Active"], ["Carol White", "carol@example.com", "Viewer", "Active"], ["David Lee", "david@example.com", "Editor", "Active"]]
  screen desktop "Users with Filters"
    navbar "Users" leading=none actions=[plus]
    stack padding=16 gap=16
      tabs items=[Active, Invited, Suspended] active=0
      table columns=["Name", "Email", "Role", "Status"] rows=4
        data=[["Alice Johnson", "alice@example.com", "Admin", "Active"], ["Bob Smith", "bob@example.com", "Editor", "Active"], ["Carol White", "carol@example.com", "Viewer", "Active"], ["David Lee", "david@example.com", "Editor", "Active"]]
    drawer right "Filters" size=300
      stack padding=16 gap=12
        heading "Filters" level=3
        select "Role" value="All"
        select "Status" value="All"
        button primary "Apply" fullWidth
```

## User
The wireframe has these problems:
line 7: unknown component "data" (components: board, screen, note, stack, grid, card, divider, spacer, heading, text, image, icon, avatar, badge, button, input, checkbox, radio, toggle, select, navbar, tabbar, tabs, list, listitem, table, modal, drawer)
line 13: unknown component "data" (components: board, screen, note, stack, grid, card, divider, spacer, heading, text, image, icon, avatar, badge, button, input, checkbox, radio, toggle, select, navbar, tabbar, tabs, list, listitem, table, modal, drawer)

Reply with the corrected wireframe in a single code block.
