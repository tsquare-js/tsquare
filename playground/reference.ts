/**
 * Examples for the playground's component reference. Each one is a complete
 * wireframe so it can be opened in the editor as-is. `npm run playground`
 * refuses to start if any of them fails to compile, and every component in the
 * catalog must have one.
 */

export const GROUPS: { name: string; components: string[] }[] = [
  { name: "Canvas", components: ["Board", "Screen", "Note"] },
  { name: "Layout", components: ["Stack", "Grid", "Card", "Divider", "Spacer"] },
  { name: "Content", components: ["Heading", "Text", "Image", "Icon", "Avatar", "Badge"] },
  { name: "Controls", components: ["Button", "Input", "Checkbox", "Radio", "Toggle", "Select"] },
  { name: "Navigation & data", components: ["NavBar", "TabBar", "Tabs", "List", "ListItem", "Table"] },
  { name: "Overlays", components: ["Modal", "Drawer"] },
];

export const EXAMPLES: Record<string, string> = {
  Board: `board row "Checkout flow" gap=48
  screen custom "Cart" width=220 height=160
    heading "Cart" level=3
    text lines=3
  screen custom "Payment" width=220 height=160
    heading "Payment" level=3
    text lines=3
  note "Board holds screens side by side, plus notes." width=180`,

  Screen: `board
  screen phone "phone"
    heading "390 × 844"
    text "Phone and desktop screens show a status bar or browser bar (chrome). Turn it off with chrome=false." muted
  screen custom "custom" width=260 height=200
    heading "Any size" level=2
    text "device=custom with width and height" muted`,

  Note: `board gap=32
  screen custom width=320 height=220
    text lines=4
    note "Notes can also sit inside a screen" color=blue
  note "yellow (default)" width=130
  note "blue" color=blue width=130
  note "pink" color=pink width=130
  note "green" color=green width=130`,

  Stack: `board
  screen custom width=560 height=300 padding=0
    stack row grow
      stack width=160 border=right fill padding=16 gap=12
        text "Sidebar" bold
        text "width, border, fill" sm muted
      stack grow padding=16 gap=16
        stack row justify=between align=center
          heading "Toolbar" level=3
          stack row gap=8
            button secondary sm "Filter"
            button primary sm "New"
        stack row wrap gap=8
          badge outline "row"
          badge outline "wrap"
          badge outline "gap"
        text lines=3`,

  Grid: `board
  screen custom width=520 height=300
    grid columns=3 gap=12
      card
        image height=60
        text "Item" bold
      card
        image height=60
        text "Item" bold
      card
        image height=60
        text "Item" bold
      card
        image height=60
        text "Item" bold
      card
        image height=60
        text "Item" bold`,

  Card: `board
  screen custom width=520 height=170
    stack row gap=16
      card "outline (default)" width=230
        text lines=3
      card "filled" variant=filled width=230
        text lines=3`,

  Divider: `board
  screen custom width=360 height=150
    text "Above"
    divider
    text "Below"
    stack row gap=12 align=center
      text "Left"
      divider vertical
      text "Right"`,

  Spacer: `board
  screen custom width=360 height=260
    heading "Fixed spacer" level=3
    spacer size=24
    text "24px gap above"
    spacer
    button primary "Pushed to the bottom" fullWidth`,

  Heading: `board
  screen custom width=360 height=170
    heading "Level 1" level=1
    heading "Level 2" level=2
    heading "Level 3" level=3
    heading "Centered" level=3 align=center`,

  Text: `board
  screen custom width=360 height=300
    text "Body text, default size"
    text lg "Large"
    text sm "Small and muted" muted
    text "Bold" bold
    text "Placeholder lines when lines is set and there's no text:" sm muted
    text lines=3`,

  Image: `board
  screen custom width=480 height=210
    stack row gap=12
      image "label" height=120 width=160
      image height=120 width=120 rounded
      image height=120
    text "In a row, an image without a width is square." sm muted`,

  Icon: `board
  screen custom width=360 height=120
    stack row gap=16 align=center
      icon home
      icon search
      icon bell
      icon settings
      icon heart size=32
    text "Any Lucide name in kebab-case (lucide.dev/icons)" sm muted`,

  Avatar: `board
  screen custom width=300 height=100
    stack row gap=12 align=center
      avatar "JD"
      avatar "AB" size=48
      avatar
      avatar size=24`,

  Badge: `board
  screen custom width=300 height=80
    stack row gap=8
      badge "solid" variant=solid
      badge outline "outline"
      badge "3"`,

  Button: `board
  screen custom width=420 height=260
    stack row gap=8 align=center
      button primary "Primary"
      button secondary "Secondary"
      button ghost "Ghost"
    stack row gap=8 align=center
      button primary sm "Small"
      button primary "Medium"
      button primary lg "Large"
    button secondary "With icon" icon=download
    button primary "Full width" fullWidth`,

  Input: `board
  screen custom width=420 height=450
    input "Email" placeholder="you@example.com" helper="We never share it"
    input password "Password" value=secret
    input search placeholder="Search"
    input "Message" multiline=3
    stack row gap=8
      input placeholder="grow fills the row" grow
      button primary "Send"`,

  Checkbox: `board
  screen custom width=300 height=100
    checkbox "Checked" checked
    checkbox "Unchecked"`,

  Radio: `board
  screen custom width=300 height=130
    radio "Selected" checked
    radio "Not selected"
    radio "Not selected"`,

  Toggle: `board
  screen custom width=300 height=100
    toggle "On" on
    toggle "Off" off`,

  Select: `board
  screen custom width=320 height=170
    select "Country" value="Mexico"
    select "Size" placeholder="Choose one" width=160`,

  NavBar: `board
  screen custom width=380 height=240 padding=0 gap=0
    navbar "leading=menu" leading=menu actions=[search, bell]
    navbar "leading=back, centered" leading=back align=center actions=[share]
    navbar "leading=close" leading=close
    navbar "leading=logo" leading=logo actions=[user]`,

  TabBar: `board
  screen phone "Tab bar sits at the bottom"
    heading "Home"
    text lines=4
    tabbar items=[{label=Home icon=house}, {label=Search icon=search}, {label=Inbox icon=inbox}, {label=Profile icon=user}] active=0`,

  Tabs: `board
  screen custom width=400 height=150
    tabs items=[Overview, Activity, Settings] active=0
    text lines=2`,

  List: `board
  screen custom width=380 height=420
    list
      listitem "Dividers on (default)"
      listitem "Second row"
    list dividers=false
      listitem "dividers=false"
      listitem "Second row"
    list
      listitem
      listitem`,

  ListItem: `board
  screen custom width=400 height=440
    list
      listitem "leading=icon" subtitle="trailing=chevron" leading=icon icon=settings trailing=chevron
      listitem "leading=avatar" subtitle="trailing=text" leading=avatar trailing=text trailingText="9:41"
      listitem "leading=image" subtitle="trailing=badge" leading=image trailing=badge trailingText="3"
      listitem "leading=checkbox" leading=checkbox trailing=toggle
      listitem "trailing=icon" trailing=icon trailingIcon=trash-2
      listitem leading=image trailing=chevron`,

  Table: `board
  screen custom width=520 height=400
    table columns=[Name, Role, Status] data=[["Ana Ruiz", Admin, Active], ["Ben Cho", Editor, Invited]]
    text "Without data, rows are placeholder bars:" sm muted
    table columns=[Name, Role, Status] rows=3`,

  Modal: `board
  screen phone "Modal"
    heading "Settings"
    text lines=6
    modal "Delete account?"
      text "This can't be undone." muted
      stack row justify=end gap=8
        button ghost "Cancel"
        button primary "Delete"`,

  Drawer: `board
  screen phone "side=left"
    navbar "Inbox" leading=menu
    text lines=6
    drawer left size=260
      heading "Menu" level=3
      list dividers=false
        listitem "Inbox" leading=icon icon=inbox
        listitem "Sent" leading=icon icon=send
  screen phone "side=bottom"
    navbar "Photo" leading=back
    image height=300
    drawer bottom "Share" size=280
      list dividers=false
        listitem "Copy link" leading=icon icon=link
        listitem "Message" leading=icon icon=message-circle`,
};
