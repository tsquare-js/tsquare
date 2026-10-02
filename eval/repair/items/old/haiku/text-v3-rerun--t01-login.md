# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
A mobile login screen: email and password fields, a 'Remember me' checkbox, a 'Forgot password?' link, and a primary Sign in button.

## Assistant (your first reply)
```tsquare
board "Login"
  screen phone "Sign in"
    stack column padding=20 gap=16
      heading "Sign in" level=1
      input "Email" placeholder="you@example.com" type=email fullWidth
      input "Password" placeholder="••••••••" type=password fullWidth
      checkbox "Remember me"
      button primary "Sign in" fullWidth
      text center "Forgot password?" size=sm
```

## User
The wireframe has these problems:
line 5: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)
line 6: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)

Reply with the corrected wireframe in a single code block.
