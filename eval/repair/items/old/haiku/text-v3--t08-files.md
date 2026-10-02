# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
A desktop file manager showing files in a table, with a details panel open as a drawer on the right.

## Assistant (your first reply)
```tsquare
board "File manager"
  screen desktop
    navbar "Files" leading=menu actions=[search, more-horizontal]
    stack row gap=0 grow
      stack grow padding=16 gap=12
        heading "Documents" level=2
        table columns=["Name", "Type", "Size", "Modified"] data=[["project-proposal.pdf", "PDF", "2.4 MB", "2026-10-01"], ["budget-2024.xlsx", "Excel", "156 KB", "2026-09-29"], ["notes.txt", "Text", "12 KB", "2026-09-28"]]
      drawer right "Details" size=300
        heading "project-proposal.pdf" level=3
        text "Type: PDF" size=sm
        text "Size: 2.4 MB" size=sm
        text "Modified: 2026-10-01" size=sm
        divider
        button primary "Download" fullWidth
        button secondary "Delete" fullWidth
```

## User
The wireframe has these problems:
line 8: Drawer must be a direct child of a Screen (found in the Stack on line 4)

Reply with the corrected wireframe in a single code block.
