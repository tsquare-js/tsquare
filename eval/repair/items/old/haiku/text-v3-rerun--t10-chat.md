# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
A mobile chat conversation screen: top bar with the contact's name, the message thread, and a message input at the bottom with a send button.

## Assistant (your first reply)
```tsquare
board "Chat"
  screen phone "Conversation"
    navbar "Sarah" leading=back actions=[call, info]
    stack column padding=12 gap=8 grow
      text "Today" size=sm muted align=center
      stack column padding=8 gap=4
        text "Hi there!" size=sm
      stack column align=end padding=8 gap=4
        text "Hey! How are you?" size=sm
      stack column padding=8 gap=4
        text "I'm doing great! How about you?" size=sm
      stack column align=end padding=8 gap=4
        text "All good, thanks for asking!" size=sm
      spacer size=0
    stack row padding=12 gap=8
      input placeholder="Type a message..." grow
      button primary trailingIcon=send size=sm
```

## User
The wireframe has these problems:
line 3: NavBar: unknown icon "call" (did you mean phone-call?)

Reply with the corrected wireframe in a single code block.
