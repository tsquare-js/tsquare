# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A desktop project settings page with a 'Danger zone' card, and a confirmation dialog open that asks the user to type the project name before a Delete button.

## Assistant (your first reply)
```tsquare
board "Project Settings"
  screen desktop "Settings"
    navbar "Project Settings"
    stack padding=32 gap=24
      stack gap=12
        heading "General" level=2
        input "Project name" value="My Project"
        input "Description" multiline=3
      divider
      card padding=20 border=all
        text "Danger zone" bold
        text sm "This action cannot be undone" muted
        button "Delete project" secondary fullWidth
    modal "Delete project?" width=400
      text "Type the project name to confirm:"
      input placeholder="My Project"
      stack row gap=8 justify=end
        button "Cancel" secondary
        button "Delete" secondary
```

## User
The wireframe has these problems:
line 10: Card has no prop "border" (its props: title, padding, gap, variant, grow, width)

Reply with the corrected wireframe in a single code block.
