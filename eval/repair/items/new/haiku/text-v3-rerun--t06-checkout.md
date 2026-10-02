# Repair conversation

## System prompt
Read it from: eval/prompts/text-v3.md

## User
A 3-step mobile checkout: Cart, Shipping details form, and a confirmation screen showing an 'Order placed' dialog.

## Assistant (your first reply)
```tsquare
board "Checkout"
  screen phone "Cart"
    navbar "Cart" leading=back
    stack column padding=16 gap=12 grow
      list
        listitem "Product 1" subtitle="$29.99" trailing=text trailingText=x2
        listitem "Product 2" subtitle="$49.99" trailing=text trailingText=x1
      divider
      text bold "Subtotal $109.97"
      button primary "Proceed" fullWidth
  screen phone "Shipping"
    navbar "Shipping" leading=back
    stack column padding=16 gap=16
      input "Name" placeholder="Full name" fullWidth
      input "Address" placeholder="Street address" fullWidth
      input "City" placeholder="City" fullWidth
      input "Postal code" placeholder="12345" fullWidth
      button primary "Continue" fullWidth
  screen phone "Confirmation"
    navbar "Order placed" leading=back
    stack column padding=20 gap=16 align=center
      modal "Order confirmed" width=280
        stack column gap=12 align=center
          text "Order #12345" bold
          text "Thank you for your order"
          text "Estimated delivery: 3-5 days" sm muted
          button primary "Done" fullWidth
```

## User
The wireframe has these problems:
line 14: Input: fullWidth is a Button prop, not an Input one; an Input already fills its width (width=… sets a fixed one), so remove it (bare words it accepts: text, password, search, email, error, grow)
line 15: Input: fullWidth is a Button prop, not an Input one; an Input already fills its width (width=… sets a fixed one), so remove it (bare words it accepts: text, password, search, email, error, grow)
line 16: Input: fullWidth is a Button prop, not an Input one; an Input already fills its width (width=… sets a fixed one), so remove it (bare words it accepts: text, password, search, email, error, grow)
line 17: Input: fullWidth is a Button prop, not an Input one; an Input already fills its width (width=… sets a fixed one), so remove it (bare words it accepts: text, password, search, email, error, grow)
line 22: Modal must be a direct child of a Screen (found in the Stack on line 21)

Reply with the corrected wireframe in a single code block.
