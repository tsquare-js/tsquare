# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A desktop calendar with a 'New event' dialog open: title input, date and time dropdowns, a multi-line description, and Cancel / Save buttons.

## Assistant (your first reply)
```tsquare
board "Calendar"
  screen desktop "Calendar"
    navbar "Calendar" leading=menu actions=[search, settings]
    stack row gap=8 padding=12
      button secondary "Today"
      button ghost leadingIcon=chevron-left
      button ghost leadingIcon=chevron-right
      heading "October 2026" level=3
    grid columns=7 gap=4 padding=12
      card padding=8
        text sm "Mon" muted
      card padding=8
        text sm "Tue" muted
      card padding=8
        text sm "Wed" muted
      card padding=8
        text sm "Thu" muted
      card padding=8
        text sm "Fri" muted
      card padding=8
        text sm "Sat" muted
      card padding=8
        text sm "Sun" muted
    modal "New event" width=440
      input "Title" placeholder="Event title"
      stack row gap=12
        select "Date" value="Oct 12, 2026" grow
        select "Time" value="10:00 AM"
      input "Description" placeholder="Add details" multiline=4
      stack row gap=8 justify=end
        button secondary "Cancel"
        button primary "Save"
```

## User
The wireframe has these problems:
line 27: Select: grow is a Stack, Card, Input… prop, not a Select one

Reply with the corrected wireframe in a single code block.
