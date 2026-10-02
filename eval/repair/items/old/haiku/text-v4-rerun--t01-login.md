# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A mobile login screen: email and password fields, a 'Remember me' checkbox, a 'Forgot password?' link, and a primary Sign in button.

## Assistant (your first reply)
```tsquare
board "Login"
  screen phone
    spacer size=40
    heading "Sign in" level=1 align=center
    spacer size=20
    input label="Email" placeholder="you@example.com" type=email fullWidth
    input label="Password" placeholder="••••••••" type=password fullWidth
    checkbox "Remember me"
    button primary "Sign in" fullWidth
    spacer size=12
    text "Forgot password?" size=sm align=center
```

## User
The wireframe has these problems:
line 6: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)
line 7: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)

Reply with the corrected wireframe in a single code block.
