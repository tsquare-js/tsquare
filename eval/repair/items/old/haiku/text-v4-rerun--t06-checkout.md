# Repair conversation

## System prompt
Read it from: eval/prompts/text-v4.md

## User
A 3-step mobile checkout: Cart, Shipping details form, and a confirmation screen showing an 'Order placed' dialog.

## Assistant (your first reply)
```tsquare
board "Checkout" layout=row
  screen phone "Cart"
    navbar "Cart" leading=back
    stack padding=16 gap=16 grow
      list grow
        listitem "Product 1" subtitle="$50 × 2"
        listitem "Product 2" subtitle="$30 × 1"
      text "Subtotal: $130" bold align=right
      text "Shipping: $10" align=right
      heading "Total: $140" level=2 align=right
      button primary "Continue to shipping" fullWidth
  screen phone "Shipping"
    navbar "Shipping" leading=back
    stack padding=16 gap=16 grow
      input label="Full name" fullWidth
      input label="Email" type=email fullWidth
      input label="Address" fullWidth
      input label="City" fullWidth
      input label="Postal code" fullWidth
      button primary "Continue to payment" fullWidth
  screen phone "Confirmation"
    navbar "Order confirmed" leading=close
    stack padding=16 gap=16 grow justify=center align=center
      modal title="Order placed" scrim=false
        text "Your order has been confirmed." align=center
        text "Order #12345" bold align=center
        button primary "Done" fullWidth
```

## User
The wireframe has these problems:
line 15: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)
line 16: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)
line 17: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)
line 18: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)
line 19: Input: don't know what "fullWidth" is (bare words it accepts: text, password, search, email, error, grow)
line 24: Modal must be a direct child of a Screen (found in the Stack on line 23)

Reply with the corrected wireframe in a single code block.
