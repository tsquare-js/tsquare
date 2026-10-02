# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
Two phone screens showing states of a notes list: an empty state ('No notes yet' with an illustration and a Create note button) and an error state ('Something went wrong' with a Retry button).

## Assistant (your first reply)
```tsquare
board "Notes App"
  screen phone "Empty state"
    navbar "Notes" leading=menu actions=[compose]
    stack gap=24 padding=24 align=center justify=center grow
      image height=120
      heading "No notes yet" level=2
      text "Create your first note to get started" muted
      button "Create note" primary
  screen phone "Error state"
    navbar "Notes" leading=menu actions=[compose]
    stack gap=24 padding=24 align=center justify=center grow
      heading "Something went wrong" level=2
      text "We couldn't load your notes" muted
      button "Retry" primary
```

## User
The wireframe has these problems:
line 3: NavBar: unknown icon "compose" (did you mean compass?)
line 10: NavBar: unknown icon "compose" (did you mean compass?)

Reply with the corrected wireframe in a single code block.
