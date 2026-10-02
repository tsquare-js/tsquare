# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
Show the same notes list on a phone and on desktop side by side, with a sticky note on the board explaining what changes between them.

## Assistant (your first reply)
```tsquare
board "Notes List" layout=row
  screen phone "Phone"
    navbar "Notes" leading=menu actions=[compose]
    list
      listitem "Meeting notes" subtitle="Mar 15" trailingIcon=archive
      listitem "Project ideas" subtitle="Mar 10" trailingIcon=archive
      listitem "Grocery list" subtitle="Mar 5" trailingIcon=archive
  screen desktop "Desktop"
    navbar "Notes" leading=none actions=[compose, search, settings]
    stack row gap=24 padding=24
      stack width=300 border=right gap=12
        text "My notes" bold
        listitem "Meeting notes" subtitle="Mar 15"
        listitem "Project ideas" subtitle="Mar 10"
        listitem "Grocery list" subtitle="Mar 5"
      stack grow gap=12 padding=12
        text "Select a note to view" muted
  note "Desktop shows sidebar plus detail area; phone shows list only"
```

## User
The wireframe has these problems:
line 3: NavBar: unknown icon "compose" (did you mean compass?)
line 9: NavBar: unknown icon "compose" (did you mean compass?)

Reply with the corrected wireframe in a single code block.
