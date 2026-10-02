# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A desktop project settings page with a 'Danger zone' card, and a confirmation dialog open that asks the user to type the project name before a Delete button.

## Assistant (your first reply)
```tsquare
board "Project Settings"
  screen desktop "Settings with Confirmation"
    navbar "Settings" leading=back
    stack padding=32 gap=24
      heading "Project Settings" level=1
      card title="General" padding=16
        text "Update project details"
      card title="Danger zone" padding=16 variant=outline
        stack gap=8
          text "Delete this project" bold
          text "This action cannot be undone" muted size=sm
          button "Delete project"
    modal "Delete project" width=400
      stack padding=24 gap=16
        heading "Are you sure?" level=2
        text "Type the project name to confirm deletion"
        input placeholder="Project name"
        stack row gap=8 justify=end
          button secondary "Cancel"
          button "Delete" tone=danger
```

## User
The wireframe has these problems:
line 20: Button has no prop "tone": tone is a Badge prop, not a Button one (its props: label, variant, size, leadingIcon, trailingIcon, fullWidth)

Reply with the corrected wireframe in a single code block.
