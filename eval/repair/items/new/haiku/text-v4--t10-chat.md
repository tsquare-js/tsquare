# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A mobile chat conversation screen: top bar with the contact's name, the message thread, and a message input at the bottom with a send button.

## Assistant (your first reply)
```tsquare
board "Chat"
  screen phone "Chat"
    navbar "Alice Smith" leading=back actions=[call, info]
    stack padding=16 gap=12 grow
      stack gap=8
        stack row justify=start
          badge "Hey! How are you?" outline
        stack row justify=end
          badge "I'm doing great!" outline
        stack row justify=start
          badge "Want to grab coffee?" outline
        stack row justify=end
          badge "Sure! When?" outline
      spacer
    stack row padding=16 gap=8
      input placeholder="Type message..." grow
      button "Send" leadingIcon=send
```

## User
The wireframe has these problems:
line 3: NavBar: unknown icon "call" (did you mean phone-call?)

Reply with the corrected wireframe in a single code block.
