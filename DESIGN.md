# Design System

The visual design of the Inventory Angular 22 client. Styling is Tailwind CSS v4 utilities in the
templates, the shared directives from `@crgolden/modules/primitives`, and `@ng-icons/lucide` glyphs.
`inventory.client/src/styles.css` holds only the `@theme` tokens and type-selector element defaults in
`@layer base`; there are no component stylesheets, and any other authored declaration is a code-style
catalog row (rule 14).

## Technology

| Tool | Role |
|---|---|
| Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/postcss`, `.postcssrc.json`) | Utilities, Preflight, the `@theme` tokens |
| `@crgolden/modules/primitives` | Buttons, card, page container: one literal utility list per directive, named in this app's tokens |
| `@ng-icons/core` + `@ng-icons/lucide` | Icons, registered per component with `provideIcons`, sized `1em` by `provideNgIconsConfig` |
| `@fontsource-variable/inter` | The body face, bundled with the app and registered as `'Inter Variable'` |

## Tokens

The palette is Tailwind's slate family, held under the contract names the shared directives use:

| Token | Value | Usage |
|---|---|---|
| `accent` | `#334155` | Primary buttons, links, focus ring |
| `accent-hover` | `#2b3748` | The primary's hover and pressed shade |
| `chrome` | `#1e293b` | The navbar, kept separate from `accent` so buttons and the bar need not match |
| `canvas` / `surface` / `surface-2` | `#f8fafc` / `#ffffff` / `#f1f5f9` | Page, cards, code and table stripes |
| `text` / `text-muted` | `#0f172a` / `#64748b` | Body text, secondary text |
| `line` / `line-strong` | `#e2e8f0` / `#64748b` | Borders and dividers / control outlines |
| `danger`, `danger-hover` | `#dc3545`, `#bb2d3b` | Destructive actions and alerts |

The body size is `--text-body` (0.9375rem, 15px at the browser's 16px root). The breakpoints are
redefined to `sm` 36rem, `md` 48rem, `lg` 62rem and `xl` 75rem, the switch points the layouts were built
against. The page measures are containers: `max-w-page` (1320px, the shared page container),
`max-w-form` (640px, the product form and detail) and `max-w-narrow` (480px, the not-found pages).
Every token is read somewhere, or the design gate fails.

## Silent-login iframe

`AppComponent` renders a hidden `<iframe id="bff-silent-login">` while the user is not authenticated,
for an OIDC `prompt=none` check against `/bff/login`. Unstyled it renders at the browser's default
300×150px, so it carries `fixed -top-[9999px] -left-[9999px] size-0 border-0` and is removed from the DOM
once it posts `{ source: 'bff-silent-login', isLoggedIn }` back to the window.

## Navbar

The bar is `bg-chrome` with links in `text-on-fill/90` that turn fully white on hover. The active route
is marked by `aria-current="page"` (`ariaCurrentWhenActive`) and styled with an `aria-[current=page]:`
white underline, so the style keys on the attribute assistive technology reads. Below `sm` the links
collapse behind a menu button, shown and hidden through a `data-open` state variant rather than a toggled
class.

## Icons

Glyphs come from `@ng-icons/lucide`, registered only where used. The home page's benefits use
`lucideShieldCheck` (insurance claims), `lucideWrench` (maintenance), `lucideFileText` (estate and will),
`lucideBook` (manuals), `lucideCalendarCheck` (warranty) and `lucideDollarSign` (resale value), each in a
circular well tinted `bg-accent/8`. Empty lists use `lucidePackage` or `lucideLayoutGrid` for "nothing yet"
and `lucideSearch` for "no match"; the not-found pages use `lucideCircleAlert`.

## Accessibility

- `accent` (`#334155`) on white: contrast ratio **9.5:1** (WCAG AAA).
- White on `chrome` (`#1e293b`): contrast ratio **15.3:1** (WCAG AAA).

## Manual chat panel

The panel is a fixed-position flex layout. Collapsed, it is a vertical pill fixed to the right edge and
centred (`[writing-mode:vertical-rl]`); expanded, a right-hand drawer below the navbar on wide screens and
a full-screen overlay below `md`. **The switch is CSS, never script**: `max-md:` variants on the panel
need no signal, no `matchMedia` listener and no class to keep in sync. `manual-chat-layout.spec.ts` pins
both sides by geometry: on a phone the open panel starts at the top of the screen (the width alone cannot
show the overlay, since the 420px drawer already spans a 390px screen), and on a wide screen it is a
right-anchored drawer below the navbar that leaves the page visible to its left. While collapsed it
issues no `ChatService` calls. The stacking order is `--z-chat-toggle` and `--z-chat-panel`, above
everything else.

Three utilities are required for reasons the class list does not show:

- **`h-auto` on the panel.** The `<dialog>` user-agent stylesheet sets `height: fit-content`, which wins
  over `top` + `bottom` unless overridden. With `fit-content` the drawer grows past the viewport as
  messages arrive; with `auto`, the height resolves from `top` and `bottom` and the panel stays inside
  the viewport.
- **`min-h-0` on the chat host and its container** is what makes the message list scroll. A flex item's
  default `min-height: auto` refuses to shrink below its content, so without it the host takes its
  intrinsic height and the message list overflows the panel instead of scrolling inside it.
- **`top-(--navbar-height)`** offsets the drawer below the fixed navbar; the height is the
  `--navbar-height` token, named rather than repeated as a bare `72px`.

The assistant's replies are Markdown rendered through `[innerHTML]`, which cannot carry classes, so their
headings, lists, code and quotes are styled by arbitrary variants on the container (`[&_h1]:…`,
`[&_code]:…`), the one place a template styles elements it does not emit.
