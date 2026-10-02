# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A desktop pricing page: a Monthly / Yearly choice at the top, then three plan cards side by side, each with a plan name, price, feature list, and a button.

## Assistant (your first reply)
```tsquare
board "Pricing"
  screen desktop "Plans"
    stack padding=40 gap=24
      heading "Choose your plan" level=1 align=center
      stack row gap=8 justify=center
        button "Monthly"
        button "Yearly"
      stack row gap=24 justify=center padding=0
        card width=280 padding=24
          text "Starter" bold
          heading "$29/month" level=2
          text lines=1 muted
          list
            listitem "10 projects"
            listitem "Basic support"
            listitem "1 GB storage"
          button secondary "Get started" fullWidth
        card width=280 padding=24
          text "Pro" bold
          heading "$99/month" level=2
          text lines=1 muted
          list
            listitem "Unlimited projects"
            listitem "Priority support"
            listitem "100 GB storage"
          button primary "Get started" fullWidth
        card width=280 padding=24
          text "Enterprise" bold
          heading "Custom" bold
          text lines=1 muted
          list
            listitem "Custom features"
            listitem "Dedicated support"
            listitem "Unlimited storage"
          button secondary "Contact us" fullWidth
```

## User
The wireframe has these problems:
line 29: Heading: bold is a Text prop, not a Heading one (bare words it accepts: left, center, right)

Reply with the corrected wireframe in a single code block.
