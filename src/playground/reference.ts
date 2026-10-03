/**
 * Examples for the playground's Components tab and the generated component
 * docs. Each one is a complete wireframe so it can be opened in the editor
 * as-is. Every catalog component needs one, in a group, and each must compile:
 * `npm run build` fails otherwise, and the playground refuses to start.
 */

export const GROUPS: { name: string; components: string[] }[] = [
  { name: "Canvas", components: ["Board", "Screen", "Note"] },
  { name: "Layout", components: ["Stack", "Grid", "Card", "Accordion", "Divider", "Spacer"] },
  { name: "Content", components: ["Heading", "Text", "Bullets", "Image", "Chart", "Icon", "Avatar", "Badge"] },
  { name: "Controls", components: ["Button", "Input", "Checkbox", "Radio", "Toggle", "Select", "Slider", "Progress", "Calendar"] },
  { name: "Navigation & data", components: ["NavBar", "TabBar", "Tabs", "Pagination", "List", "ListItem", "Table"] },
  { name: "Overlays", components: ["Modal", "Drawer", "Toast"] },
];

export const EXAMPLES: Record<string, string> = {
  Board: `board row "Checkout flow" gap=48 accent=blue
  screen custom "Cart" width=240 height=200
    heading "Cart" level=3
    text lines=3
    spacer
    button primary "Checkout" fullWidth
  screen custom "Payment" width=240 height=200
    heading "Payment" level=3
    toggle "Save card" on
    spacer
    button primary "Pay" fullWidth
  note "accent colors primary buttons, toggles, checked controls and active tabs. Omit it for grayscale." width=180`,

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
      card "outline (default)" grow
        text lines=3
      card "filled" variant=filled grow
        text lines=3`,

  Accordion: `board
  screen custom width=380 height=330 gap=0
    heading "FAQ" level=3
    accordion "How long does shipping take?" open
      text "Orders arrive in 3–5 business days." muted
    accordion "Can I return an item?"
    accordion "Do you ship internationally?"
    accordion "How do I track my order?"`,

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
  screen custom width=360 height=370
    text "Body text, default size"
    text lg "Large"
    text sm "Small and muted" muted
    text "Bold" bold
    text "Placeholder lines when lines is set and there's no text:" sm muted
    text lines=3
    text "Breadcrumbs are small muted text:" sm muted
    text "Home / Settings / Profile" sm muted`,

  Bullets: `board
  screen custom width=420 height=600
    text "Bullets" bold
    bullets items=[Fast setup, No credit card, Cancel anytime]
    text "numbered" bold
    bullets numbered items=[Create an account, Verify your email, Invite your team]
    text "icon= any Lucide icon" bold
    bullets icon=check items=[Unlimited boards, Share links, Version history]
    text "One item can change its icon, or be muted" bold
    bullets icon=check items=[Unlimited boards, Share links, {label="SSO" icon=x muted}]`,

  Image: `board
  screen custom width=480 height=400
    stack row gap=12
      image "label" height=120 width=160
      image height=120 width=120 rounded
      image height=120
    text "In a row, an image without a width is square." sm muted
    image map height=150 "Map"`,

  Chart: `board
  screen custom width=640 height=430
    stack row gap=16
      chart line "line (default)"
      chart bar "bar"
    stack row gap=16
      chart area "area" height=150
      chart pie "pie" height=150
      chart donut "donut" height=150
    text "Charts are placeholders: they show the kind of chart, not data." sm muted`,

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
  screen custom width=340 height=110
    stack row gap=8
      badge "solid" variant=solid
      badge outline "outline"
      badge "3"
    stack row gap=8
      badge "Active" tone=success
      badge "Pending" tone=warning
      badge "Failed" tone=danger
      badge outline "Failed" tone=danger`,

  Button: `board
  screen custom width=420 height=310
    stack row gap=8 align=center
      button primary "Primary"
      button secondary "Secondary"
      button ghost "Ghost"
    stack row gap=8 align=center
      button primary sm "Small"
      button primary "Medium"
      button primary lg "Large"
    stack row gap=8 align=center
      button secondary "Back" leadingIcon=chevron-left
      button primary "Next" trailingIcon=chevron-right
    button primary "Full width" fullWidth
    text "With a board accent, primary buttons fill with it and ghost buttons use it for text." sm muted
  screen custom "tooltip" width=380 height=170
    spacer size=34
    stack row gap=8
      button secondary "Draft" tooltip="Saves without publishing"
      button primary "Publish"
    text "Any element inside a screen can take tooltip=." sm muted
  screen custom "menu and open" width=380 height=300
    stack row justify=between align=center
      heading "Notes" level=3
      button ghost leadingIcon=more-horizontal open menu=[{label=Rename icon=pencil}, {label=Duplicate icon=copy}, Share, {label=Delete icon=trash-2}]
    text lines=3
    text "menu lists the items; open shows them over the screen." sm muted`,

  Input: `board
  screen custom width=420 height=760
    input "Email" placeholder="you@example.com" helper="We never share it"
    input "Username" value="dana moore" error helper="No spaces allowed"
    input password "Password" value=secret
    input search placeholder="Search"
    input "Message" multiline=3
    stack row gap=8
      input placeholder="grow fills the row" grow
      button primary "Send"
    input "Check-in" type=date value="Oct 14, 2026"
    input "Verification code" type=code value="4821" helper="Sent to (555) 010-2400"
  screen custom "type=date open" width=420 height=440
    input "Check-in" type=date value="Oct 14, 2026" open
    input "Check-out" type=date value="Oct 18, 2026"`,

  Checkbox: `board
  screen custom width=300 height=100
    checkbox "Checked" checked
    checkbox "Unchecked"`,

  Radio: `board
  screen custom width=380 height=230
    radio "Selected" checked
    radio "Not selected"
    radio "Not selected"
    text "Side by side: put them in a row" sm muted
    stack row gap=20
      radio "Standard" checked
      radio "Express"
      radio "Pickup"`,

  Toggle: `board
  screen custom width=300 height=100
    toggle "On" on
    toggle "Off" off`,

  Select: `board
  screen custom width=380 height=260
    select "Country" value="Mexico"
    select "Size" placeholder="Choose one" width=160
    stack row gap=12
      input "City" placeholder="Monterrey" grow
      select "State" value="Nuevo León" grow
  screen custom "options and open" width=380 height=260
    select "Country" value="Mexico" open options=[Canada, Mexico, United States, Spain]
    input "City" placeholder="Monterrey"`,

  Slider: `board
  screen custom width=380 height=200
    slider "Volume" value=30
    slider "Price range" range=[20, 80]`,

  Progress: `board
  screen custom width=420 height=330
    progress "Uploading" value=40
    progress value=75
    stack row gap=24
      progress circle "Storage" value=72
      progress circle value=15
    progress "Setup" steps=4 step=2`,

  Calendar: `board
  screen custom width=660 height=400
    stack row gap=24 align=start
      calendar "October 2026" selected=14
      calendar "October 2026" range=[12, 18] marked=[3, 9, 22]
    text "range selects several days; marked adds a dot, e.g. for events." sm muted`,

  NavBar: `board
  screen custom width=380 height=240 padding=0 gap=0
    navbar "leading=menu" leading=menu actions=[search, bell]
    navbar "leading=back, centered" leading=back align=center actions=[share]
    navbar "leading=close" leading=close
    navbar "leading=logo" leading=logo actions=[user]
  screen custom "menu and open" width=380 height=240 padding=0 gap=0
    navbar "Inbox" leading=menu actions=[search] open menu=[Mark all as read, {label=Settings icon=settings}, {label=Sign out icon=log-out}]
    text lines=4`,

  TabBar: `board
  screen phone "Tab bar sits at the bottom"
    heading "Home"
    text lines=4
    tabbar items=[{label=Home icon=house}, {label=Search icon=search}, {label=Inbox icon=inbox}, {label=Profile icon=user}] active=0`,

  Tabs: `board
  screen custom width=400 height=150
    tabs items=[Overview, Activity, Settings] active=0
    text lines=2`,

  Pagination: `board
  screen custom width=420 height=160
    pagination pages=5 current=2
    pagination pages=12 current=6`,

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
      listitem "leadingIcon=settings" subtitle="trailing=chevron" leadingIcon=settings trailing=chevron
      listitem "leading=avatar" subtitle="trailing=text" leading=avatar trailing=text trailingText="9:41"
      listitem "leading=image" subtitle="trailing=badge" leading=image trailing=badge trailingText="3"
      listitem "leading=checkbox" leading=checkbox trailing=toggle
      listitem "trailingIcon=trash-2" trailingIcon=trash-2
      listitem leading=image trailing=chevron
  screen custom "menu and open" width=400 height=330
    list
      listitem "Report.pdf" subtitle="2.4 MB" leadingIcon=file-text
      listitem "Budget.xlsx" subtitle="380 KB" leadingIcon=sheet open menu=[{label=Rename icon=pencil}, {label=Move icon=folder}, {label=Delete icon=trash-2}]
      listitem "Notes.txt" subtitle="12 KB" leadingIcon=file
      listitem "Photo.jpg" subtitle="1.1 MB" leadingIcon=image`,

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
        listitem "Inbox" leadingIcon=inbox
        listitem "Sent" leadingIcon=send
  screen phone "side=bottom"
    navbar "Photo" leading=back
    image height=300
    drawer bottom "Share" size=280
      list dividers=false
        listitem "Copy link" leadingIcon=link
        listitem "Message" leadingIcon=message-circle`,

  Toast: `board
  screen phone "Bottom, above a tab bar"
    heading "Inbox" level=2
    list
      listitem "Ana Torres" subtitle="Lunch on Friday?" leading=avatar
      listitem "Ben Cho" subtitle="Draft attached" leading=avatar
    tabbar items=[{label=Inbox icon=inbox}, {label=Settings icon=settings}]
    toast "Message sent" action="Undo" icon=check
  screen phone "Top"
    heading "Profile" level=2
    image height=160
    toast "Changes saved" position=top
  screen desktop "Corners: topLeft, topRight, bottomLeft, bottomRight" width=900 height=420
    heading "Dashboard" level=2
    image height=220
    toast "topRight" position=topRight
    toast "bottomLeft" action="Undo" position=bottomLeft`,
};
