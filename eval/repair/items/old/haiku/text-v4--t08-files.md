# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A desktop file manager showing files in a table, with a details panel open as a drawer on the right.

## Assistant (your first reply)
```tsquare
board "File manager"
  screen desktop "Files"
    stack row
      stack grow padding=16 gap=12
        stack row gap=12 align=center
          button "New folder" secondary
          input search placeholder="Search files..." grow
        table columns=[Name, Type, Modified, Size] rows=6
      drawer right "Details" size=300 scrim=false
        stack padding=16 gap=12
          heading "Document.pdf" level=2
          text sm muted "Type: PDF"
          text sm muted "Size: 2.4 MB"
          text sm muted "Modified: Today at 2:30 PM"
          divider
          button "Download" primary fullWidth
          button "Delete" secondary fullWidth
```

## User
The wireframe has these problems:
line 9: Drawer must be a direct child of a Screen (found in the Stack on line 3)

Reply with the corrected wireframe in a single code block.
