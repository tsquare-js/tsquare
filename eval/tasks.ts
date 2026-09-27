/**
 * 20 wireframe requests, each with objective checks run against the parsed spec.
 * Checks test whether the output contains what was asked for, not how it looks.
 */
import type { Spec } from "@json-render/core";

type El = { type: string; props: Record<string, any>; children?: string[] };
type Check = [label: string, test: (q: Q) => boolean];

class Q {
  els: El[];
  constructor(public spec: Spec) {
    this.els = Object.values(spec.elements) as El[];
  }
  of(type: string, pred: (p: Record<string, any>) => boolean = () => true) {
    return this.els.filter((e) => e.type === type && pred(e.props ?? {}));
  }
  count(type: string, pred?: (p: Record<string, any>) => boolean) {
    return this.of(type, pred).length;
  }
  has(type: string, pred?: (p: Record<string, any>) => boolean) {
    return this.count(type, pred) > 0;
  }
  screens(device?: string) {
    return this.of("Screen", (p) => !device || (p.device ?? "phone") === device).length;
  }
  /** descendants of every element of `type` */
  within(type: string, childType: string) {
    const out: El[] = [];
    const walk = (id: string) => {
      const e = this.spec.elements[id] as El | undefined;
      if (!e) return;
      if (e.type === childType) out.push(e);
      (e.children ?? []).forEach(walk);
    };
    for (const [id, e] of Object.entries(this.spec.elements) as [string, El][]) {
      if (e.type === type) (e.children ?? []).forEach(walk);
    }
    return out;
  }
}

const label = (re: RegExp) => (p: Record<string, any>) => re.test(String(p.label ?? p.title ?? p.text ?? ""));
const icon = (re: RegExp) => (p: Record<string, any>) => re.test(String(p.icon ?? p.name ?? ""));

export interface Task { id: string; prompt: string; checks: Check[] }

export const tasks: Task[] = [
  {
    id: "t01-login",
    prompt: "A mobile login screen: email and password fields, a 'Remember me' checkbox, a 'Forgot password?' link, and a primary Sign in button.",
    checks: [
      ["phone screen", (q) => q.screens("phone") >= 1],
      ["2+ inputs", (q) => q.count("Input") >= 2],
      ["password input", (q) => q.has("Input", (p) => p.type === "password")],
      ["checkbox", (q) => q.has("Checkbox")],
      ["primary button", (q) => q.has("Button", (p) => (p.variant ?? "primary") === "primary")],
    ],
  },
  {
    id: "t02-settings",
    prompt: "A mobile settings screen with a top bar that has a back button. Show toggles for Notifications and Dark mode, an Account section with rows that have chevrons, and a Sign out button at the bottom.",
    checks: [
      ["navbar with back", (q) => q.has("NavBar", (p) => p.leading === "back")],
      ["2+ toggles", (q) => q.count("Toggle") + q.count("ListItem", (p) => p.trailing === "toggle") >= 2],
      ["chevron rows", (q) => q.has("ListItem", (p) => p.trailing === "chevron")],
      ["sign out button", (q) => q.has("Button", label(/sign out/i))],
    ],
  },
  {
    id: "t03-music",
    prompt: "Three phone screens for a music app: Home, Now Playing, and Library. Home and Library have a bottom tab bar with 4 tabs. Now Playing shows the queue in a bottom sheet.",
    checks: [
      ["3+ screens", (q) => q.screens() >= 3],
      ["tab bar with 4 tabs", (q) => q.has("TabBar", (p) => p.items?.length === 4)],
      ["bottom sheet", (q) => q.has("Drawer", (p) => p.side === "bottom")],
    ],
  },
  {
    id: "t04-dashboard",
    prompt: "A desktop analytics dashboard: a 240px left sidebar with navigation, a header with a search field and the user's avatar, 4 stat cards in a row, and a table of recent orders with 5 columns.",
    checks: [
      ["desktop screen", (q) => q.screens("desktop") >= 1],
      ["240px sidebar", (q) => q.has("Stack", (p) => p.width === 240)],
      ["search input", (q) => q.has("Input", (p) => p.type === "search")],
      ["avatar", (q) => q.has("Avatar")],
      ["4 stat cards", (q) => q.count("Card") >= 4],
      ["5-column table", (q) => q.has("Table", (p) => p.columns?.length === 5)],
    ],
  },
  {
    id: "t05-product",
    prompt: "A mobile product page: large product image, title, price, a size dropdown, a full-width Add to cart button, and a list of reviews.",
    checks: [
      ["image", (q) => q.has("Image")],
      ["size select", (q) => q.has("Select")],
      ["full-width add to cart", (q) => q.has("Button", (p) => p.fullWidth === true && /cart/i.test(p.label ?? ""))],
      ["2+ review rows", (q) => q.count("ListItem") >= 2],
    ],
  },
  {
    id: "t06-checkout",
    prompt: "A 3-step mobile checkout: Cart, Shipping details form, and a confirmation screen showing an 'Order placed' dialog.",
    checks: [
      ["3+ screens", (q) => q.screens() >= 3],
      ["3+ form inputs", (q) => q.count("Input") + q.count("Select") >= 3],
      ["order placed modal", (q) => q.has("Modal")],
    ],
  },
  {
    id: "t07-tablet-mail",
    prompt: "A tablet email client in split view: a list of emails on the left and the open message on the right.",
    checks: [
      ["tablet screen", (q) => q.screens("tablet") >= 1],
      ["side-by-side layout", (q) => q.has("Stack", (p) => p.direction === "row")],
      ["3+ email rows", (q) => q.count("ListItem") >= 3],
    ],
  },
  {
    id: "t08-files",
    prompt: "A desktop file manager showing files in a table, with a details panel open as a drawer on the right.",
    checks: [
      ["desktop screen", (q) => q.screens("desktop") >= 1],
      ["files table", (q) => q.has("Table")],
      ["right drawer", (q) => q.has("Drawer", (p) => p.side === "right")],
    ],
  },
  {
    id: "t09-onboarding",
    prompt: "Three phone onboarding screens. Each has an illustration, a heading, a short description, and a Continue button, except the last, whose button says 'Get started'.",
    checks: [
      ["exactly 3 screens", (q) => q.screens() === 3],
      ["3+ images", (q) => q.count("Image") >= 3],
      ["3+ headings", (q) => q.count("Heading") >= 3],
      ["get started button", (q) => q.has("Button", label(/get started/i))],
    ],
  },
  {
    id: "t10-chat",
    prompt: "A mobile chat conversation screen: top bar with the contact's name, the message thread, and a message input at the bottom with a send button.",
    checks: [
      ["navbar", (q) => q.has("NavBar")],
      ["message input", (q) => q.has("Input")],
      ["send button", (q) => q.has("Button", (p) => /send/i.test(`${p.icon ?? ""} ${p.label ?? ""}`))],
    ],
  },
  {
    id: "t11-event-modal",
    prompt: "A desktop calendar with a 'New event' dialog open: title input, date and time dropdowns, a multi-line description, and Cancel / Save buttons.",
    checks: [
      ["modal", (q) => q.has("Modal")],
      ["multiline description", (q) => q.has("Input", (p) => (p.multiline ?? 0) >= 2)],
      ["2+ selects", (q) => q.count("Select") >= 2],
      ["cancel + save", (q) => q.has("Button", label(/cancel/i)) && q.has("Button", label(/save/i))],
    ],
  },
  {
    id: "t12-users",
    prompt: "Two desktop screens for user management. First: tabs for Active, Invited, and Suspended, and a table with 4 real-looking user rows (name, email, role, status). Second: the same page with a Filters drawer open on the right.",
    checks: [
      ["2+ desktop screens", (q) => q.screens("desktop") >= 2],
      ["3 tabs", (q) => q.has("Tabs", (p) => p.items?.length === 3)],
      ["table with 4+ data rows", (q) => q.has("Table", (p) => (p.data?.length ?? 0) >= 4)],
      ["right drawer", (q) => q.has("Drawer", (p) => p.side === "right")],
    ],
  },
  {
    id: "t13-food",
    prompt: "A food delivery app home screen on mobile: search bar, a row of category chips, a 2-column grid of restaurant cards, and a bottom tab bar.",
    checks: [
      ["search", (q) => q.has("Input", (p) => p.type === "search")],
      ["3+ chips", (q) => q.count("Badge") + q.count("Button", (p) => p.size === "sm") >= 3],
      ["2-column grid", (q) => q.has("Grid", (p) => p.columns === 2)],
      ["tab bar", (q) => q.has("TabBar")],
    ],
  },
  {
    id: "t14-side-menu",
    prompt: "A phone screen with the side menu open from the left: user avatar and name at the top, 5 menu items, and Log out at the bottom.",
    checks: [
      ["left drawer", (q) => q.has("Drawer", (p) => (p.side ?? "left") === "left")],
      ["avatar in drawer", (q) => q.within("Drawer", "Avatar").length > 0],
      ["5+ menu items in drawer", (q) => q.within("Drawer", "ListItem").length + q.within("Drawer", "Button").length >= 5],
      ["log out", (q) => q.els.some((e) => /log ?out/i.test(`${e.props?.label ?? ""} ${e.props?.title ?? ""} ${e.props?.text ?? ""}`))],
    ],
  },
  {
    id: "t15-pricing",
    prompt: "A desktop pricing page: a Monthly / Yearly choice at the top, then three plan cards side by side, each with a plan name, price, feature list, and a button.",
    checks: [
      ["desktop screen", (q) => q.screens("desktop") >= 1],
      ["monthly/yearly choice", (q) => q.count("Radio") >= 2 || q.has("Tabs") || q.has("Toggle")],
      ["3+ cards", (q) => q.count("Card") >= 3],
      ["3+ buttons", (q) => q.count("Button") >= 3],
    ],
  },
  {
    id: "t16-states",
    prompt: "Two phone screens showing states of a notes list: an empty state ('No notes yet' with an illustration and a Create note button) and an error state ('Something went wrong' with a Retry button).",
    checks: [
      ["exactly 2 screens", (q) => q.screens() === 2],
      ["illustration", (q) => q.has("Image")],
      ["create button", (q) => q.has("Button", label(/create/i))],
      ["retry button", (q) => q.has("Button", label(/retry/i))],
    ],
  },
  {
    id: "t17-profile",
    prompt: "A mobile profile page: a large avatar (at least 72px), name, a row of 3 stats, tabs for Posts and Likes, and a 3-column photo grid.",
    checks: [
      ["large avatar", (q) => q.has("Avatar", (p) => (p.size ?? 40) >= 72)],
      ["2 tabs", (q) => q.has("Tabs", (p) => p.items?.length === 2)],
      ["3-column grid", (q) => q.has("Grid", (p) => p.columns === 3)],
      ["3+ photos", (q) => q.count("Image") >= 3],
    ],
  },
  {
    id: "t18-delete",
    prompt: "A desktop project settings page with a 'Danger zone' card, and a confirmation dialog open that asks the user to type the project name before a Delete button.",
    checks: [
      ["danger zone card", (q) => q.has("Card")],
      ["modal", (q) => q.has("Modal")],
      ["confirm input in modal", (q) => q.within("Modal", "Input").length > 0],
      ["delete button", (q) => q.has("Button", label(/delete/i))],
    ],
  },
  {
    id: "t19-responsive",
    prompt: "Show the same notes list on a phone and on desktop side by side, with a sticky note on the board explaining what changes between them.",
    checks: [
      ["phone screen", (q) => q.screens("phone") >= 1],
      ["desktop screen", (q) => q.screens("desktop") >= 1],
      ["sticky note", (q) => q.has("Note")],
    ],
  },
  {
    id: "t20-ride",
    prompt: "A ride-hailing phone screen: a map filling most of the screen (at least 300px tall), with a bottom sheet listing 3 ride options to pick from and a Confirm ride button.",
    checks: [
      ["tall map", (q) => q.has("Image", (p) => (p.height ?? 0) >= 300)],
      ["bottom sheet", (q) => q.has("Drawer", (p) => p.side === "bottom")],
      ["3 ride options", (q) => q.count("Radio") + q.within("Drawer", "ListItem").length >= 3],
      ["confirm button", (q) => q.has("Button", label(/confirm/i))],
    ],
  },
];

export function runChecks(task: Task, spec: Spec) {
  const q = new Q(spec);
  return task.checks.map(([name, test]) => {
    let pass = false;
    try { pass = test(q); } catch { pass = false; }
    return { name, pass };
  });
}
