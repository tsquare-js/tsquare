# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A mobile chat conversation screen: top bar with the contact's name, the message thread, and a message input at the bottom with a send button.

## Assistant (your first reply)
```tsquare
board "Chat"
  screen phone
    navbar "Alex Rivera" leading=back actions=[call, info]
    stack grow padding=16 gap=12
      text "Hey, how are you?" align=left
      text "I'm doing great!" align=right
      text "Want to catch up later?" align=left
      text "Sure! How about 5pm?" align=right
      text "Perfect, talk then!" align=left
    stack row gap=8 padding=16
      input placeholder="Type a message..." grow
      button leadingIcon=send size=md
```

## User
The wireframe has these problems:
line 3: NavBar: unknown icon "call" (did you mean phone-call?)

Reply with the corrected wireframe in a single code block.
