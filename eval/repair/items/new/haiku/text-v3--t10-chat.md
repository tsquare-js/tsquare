# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
A mobile chat conversation screen: top bar with the contact's name, the message thread, and a message input at the bottom with a send button.

## Assistant (your first reply)
```tsquare
board "Chat"
  screen phone "Conversation"
    navbar "Sarah Johnson" leading=back actions=[call, info]
    stack gap=12 padding=16 grow
      stack
        text "Hey, how are you?" size=sm muted align=left
      stack row justify=end
        text "I'm doing great! How about you?" size=sm
      stack
        text "Just finished a project, feeling good" size=sm muted align=left
      spacer
    stack row gap=8 padding=16
      input placeholder="Type a message..." grow
      button primary trailingIcon=send
```

## User
The wireframe has these problems:
line 3: NavBar: unknown icon "call" (did you mean phone-call?)

Reply with the corrected wireframe in a single code block.
