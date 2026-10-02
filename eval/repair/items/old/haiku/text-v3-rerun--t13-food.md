# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
A food delivery app home screen on mobile: search bar, a row of category chips, a 2-column grid of restaurant cards, and a bottom tab bar.

## Assistant (your first reply)
```tsquare
board "Food Delivery"
  screen phone "Browse"
    navbar "Restaurants" leading=menu
    input search placeholder="Search restaurants"
    stack row gap=12 padding=12 wrap
      badge "Pizza"
      badge "Sushi"
      badge "Burger"
      badge "Dessert"
    heading "Popular" level=2 padding=12
    grid columns=2 gap=12 padding=12
      card padding=10
        image height=120
        text "Restaurant 1" bold
        text sm "4.5★ • 25 min"
      card padding=10
        image height=120
        text "Restaurant 2" bold
        text sm "4.8★ • 30 min"
    tabbar items=[{label=Browse icon=utensils}, {label=Saved icon=heart}, {label=Orders icon=shopping-bag}, {label=Account icon=user}] active=0
```

## User
The wireframe has these problems:
line 10: Heading has no prop "padding" (its props: text, level, align)

Reply with the corrected wireframe in a single code block.
