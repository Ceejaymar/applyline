---
name: Applyline
description: A local-first job application tracker — calm, focused, and always in your browser.
colors:
  primary: "#2D80D2"
  primary-dark: "#6BADF0"
  accent: "#8852E0"
  accent-dark: "#9E74F0"
  background-light: "#F7F9FB"
  background-dark: "#0E1119"
  surface-light: "#FFFFFF"
  surface-dark: "#131820"
  surface-secondary-light: "#ECEEF3"
  surface-secondary-dark: "#1C2330"
  foreground-light: "#161B24"
  foreground-dark: "#EEF0F4"
  muted-foreground-light: "#636C79"
  muted-foreground-dark: "#93A0B4"
  border-light: "#DADDE8"
  border-dark: "#272F3F"
  destructive: "#DC2828"
  success: "#27865A"
typography:
  body:
    fontFamily: '"Avenir Next", "Segoe UI Variable", ui-sans-serif, system-ui, -apple-system, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Avenir Next", "Segoe UI Variable", ui-sans-serif, system-ui, -apple-system, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  title:
    fontFamily: '"Avenir Next", "Segoe UI Variable", ui-sans-serif, system-ui, -apple-system, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  headline:
    fontFamily: '"Avenir Next", "Segoe UI Variable", ui-sans-serif, system-ui, -apple-system, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "#2472BD"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-outline:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-secondary-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-default:
    backgroundColor: "{colors.background-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge-default:
    backgroundColor: "{colors.surface-secondary-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: Applyline

## 1. Overview

**Creative North Star: "The Still Room"**

Applyline is a still room for a noisy process. Job searching generates dozens of decisions made under stress across fragmented platforms — the board is the one place where everything is visible, accountable, and quiet. The design answers this need with high information density and zero decoration: no gradients, no hero metrics, no celebration of the search itself.

The palette is disciplined — one Ocean Slate blue for action, a purple-violet structural accent used only in hardcoded column-badge contexts, and tinted blue-grey neutrals that recede entirely behind content. Typography is system-native (Avenir Next / Segoe UI Variable), inheriting from the OS without imposing itself. Motion is limited to state acknowledgment and drag reordering; the interface never moves unless the user initiated it.

Both light and dark themes are first-class. Many users work late. The dark theme is not a recolor — it's a separate palette tuned for low-light use, with the primary blue lightened to remain readable against dark surfaces and the shadows removed entirely (depth via tonal layering instead).

This system explicitly rejects everything that makes generic SaaS dashboards feel like dashboards: no purple gradient backgrounds, no large-number hero cards, no sparkline widgets. It also rejects the corporate-utilitarian palette of the job platforms it tracks (LinkedIn blues, Indeed yellows). Applyline should feel like a better tool than the places it's organizing.

**Key Characteristics:**
- Single blue action color; accent (violet) appears only in Kanban column badge contexts
- Flat-by-default surfaces; ambient shadow on cards at rest, soft shadow on hover
- System font stack — no web font load, consistent across OS rendering engines
- Light and dark themes equally considered from day one
- Column accent colors (amber, blue, green, teal, violet, red, slate, zinc) are the only expressive color in the interface

## 2. Colors: The Ocean Slate Palette

A single accent-based palette with blue as the one decision-making color and desaturated blue-grey neutrals for all structural surfaces.

### Primary
- **Ocean Slate** (`#2D80D2` / `hsl(210 65% 50%)`): The primary action color. Used on primary buttons, focus rings, links, and the app wordmark icon. In dark mode, lightened to `#6BADF0` (`hsl(210 82% 68%)`) for readability against dark surfaces. This is the only color with strong chroma in the interface.

### Secondary
- **Still Violet** (`#8852E0` / `hsl(263 70% 60%)`): Structural accent used for `accent-foreground` tokens. Appears in badge tints within job cards (indigo/violet family, hardcoded Tailwind utilities). In dark mode: `#9E74F0`. Used sparingly; its contrast with Ocean Slate provides visual separation on the Kanban board without adding a third strong color.

### Neutral
- **Deep Ink** (`#161B24` / `hsl(215 22% 12%)`): Primary text in light mode. Blue-shifted to avoid flat grey.
- **Cool Canvas** (`#F7F9FB` / `hsl(212 20% 98%)`): Page background in light mode. Barely perceptible blue tint — distinguishable from pure white only on direct comparison.
- **White Surface** (`#FFFFFF`): Card and popover background in light mode. The slight contrast against Cool Canvas creates depth without shadow.
- **Mist** (`#ECEEF3` / `hsl(215 18% 94%)`): Secondary surface, hover backgrounds, chips, badge backgrounds. The lightest shade where content can sit.
- **Steel** (`#636C79` / `hsl(215 10% 43%)`): Muted foreground — metadata, timestamps, secondary labels.
- **Ghost** (`#DADDE8` / `hsl(215 18% 88%)`): Borders, dividers, input stroke.
- **Void** (`#0E1119` / `hsl(215 20% 8%)`): Page background in dark mode.
- **Ink Surface** (`#131820` / `hsl(215 18% 11%)`): Card and popover background in dark mode.

### Status
- **Alarm** (`#DC2828`): Destructive actions, error states.
- **Cleared** (`#27865A`): Success confirmation, offer column badge.

### Named Rules
**The One Voice Rule.** Ocean Slate is the only color that speaks above the neutrals. It appears on ≤10% of any given screen. Its restraint is the point — when you see blue, there is something to do.

**The Column Exception.** Kanban column accent stripes (the 4px left border on job cards) use an expressive palette: amber, blue, green, teal, violet, red, slate, zinc. This is the only place in the interface where color is decorative rather than functional. It maps to user-customizable column configuration and is intentionally distinct from the primary Ocean Slate.

## 3. Typography

**Display / Body Font:** Avenir Next → Segoe UI Variable → ui-sans-serif → system-ui → -apple-system → sans-serif

**Character:** A humanist geometric sans — clean and precise without being cold. Avenir Next's optical consistency at small sizes makes it ideal for dense information display. The fallback chain ensures visual coherence across macOS (Avenir Next), Windows 11 (Segoe UI Variable), and system defaults without a web font request.

### Hierarchy
- **Headline** (600, 1rem / 16px, 1.3 line-height): Page headings, section titles, modal titles.
- **Title** (600, 0.875rem / 14px, 1.4 line-height): Card headings, column headers, form section labels.
- **Body** (400, 0.875rem / 14px, 1.5 line-height): Description text, notes, drawer content. Line length capped at 65ch in prose contexts.
- **Label** (500, 0.75rem / 12px, 1.4 line-height): Metadata, timestamps, badges, toolbar labels, nav items. The workhorse size.
- **Micro** (500, 0.6875rem / 11px): Status chips on job cards, source attribution, compact badge text. Never used for body content.

### Named Rules
**The Size Floor Rule.** Nothing renders below 11px / 0.6875rem. Any label too long for 11px gets truncated (`truncate`) rather than reduced further — legibility is non-negotiable, even at the cost of visible text.

**The Weight Ceiling Rule.** Font weight does not exceed 600 in the UI. There is no `font-bold` (700) or `font-extrabold` (800). Emphasis comes from weight contrast (400 vs 600), not extremes.

## 4. Elevation

Applyline is flat by default. Surfaces do not float unless in a state that requires separation from the document flow (hover, drag, modal overlay).

### Shadow Vocabulary
- **Ambient Rest** (`0 10px 28px -24px hsl(var(--foreground) / 0.6)`): Job cards at rest. The large negative spread makes this a tight halo — just enough to separate the card from the column background. Invisible unless scrutinized.
- **Soft Hover** (`0 16px 40px -24px hsl(var(--foreground) / 0.35)`): Job cards on hover. Wider spread, lower opacity — the card seems to breathe upward. Defined as `shadow-soft` in Tailwind config.
- **Overlay** (`box-shadow` from Radix Dialog): Modals and drawers use the platform default. No custom shadow.

Dark mode uses no shadows. Tonal separation (card `hsl(215 18% 11%)` against background `hsl(215 20% 8%)`) provides depth without casting shadows on very dark surfaces.

### Named Rules
**The Flat-by-Default Rule.** If an element is not interactive-in-motion (hovered, dragged, or elevated as a modal), it has no shadow. Resting UI is flat. Shadow is a response to state, not decoration.

**The Halo Rule.** The negative spread value (`-24px` on a `10px` or `16px` blur) keeps shadows tight and directional — they hug the card rather than pooling beneath it. No diffuse glow shadows anywhere in the interface.

## 5. Components

### Buttons

Clean, medium-weight, gently rounded (6px). No uppercase, no letter-spacing manipulation. Sizing is consistent across variants.

- **Shape:** Gently curved edges (6px / `rounded-md`), height 36px
- **Primary:** Ocean Slate fill (`#2D80D2`), white text, 8px / 12px padding. Hover: 10% darker (`#2472BD`). The only filled button.
- **Outline:** White / cool-canvas background, Ghost border stroke, foreground text. Hover: Mist background.
- **Ghost:** Transparent, no border, foreground text. Hover: Mist background. Used for icon buttons and toolbar actions.
- **Destructive:** Alarm red fill, white text — same shape as primary. Used only in delete confirmation contexts.
- **Disabled:** 50% opacity, pointer-events blocked. No color change.
- **Focus:** 2px `ring-ring` focus ring offset 0. Ocean Slate in light mode; lighter blue in dark mode.
- **Icon variant:** 36×36px square (`size-icon`), same radius and focus treatment.

### Badges / Chips

- **Default (secondary):** Mist background (`#ECEEF3`), foreground text, 4px radius, 2px/8px padding, 12px/500 weight
- **Primary:** Ocean Slate fill, white text — used rarely, for primary-status emphasis
- **Success:** Cleared green fill, white text — offer column, success confirmations
- **Outline:** Ghost border, foreground text — tag chips on job cards, uses custom indigo tint (`bg-indigo-500/[0.08]`, `text-indigo-700`) outside the token system
- **Size:** 12px text is the standard. 10px micro badges on job cards (compact density).

### Job Cards (Signature Component)

The primary unit of the interface. Information-dense, horizontally compact, vertically scannable.

- **Shape:** 8px radius (`rounded-md`), white background in light mode / Ink Surface in dark
- **Accent stripe:** 4px left border in column accent color (amber/blue/green/etc.) — the only expressive color on the card
- **Shadow:** Ambient Rest at rest; Soft Hover on pointer hover; `rotate-1 shadow-2xl` during drag overlay
- **Padding:** 12px all sides, 14px left (offset for accent stripe)
- **Hierarchy:** Job title (Title, 14px/600), Company name (Label, 12px/400, muted), Source chip (Label, 11px/500, muted), Tag badges (Micro, 10px), Timestamp (Micro, 11px/500, secondary surface background)
- **Drag handle:** Ghost icon button (GripVertical), visible on group hover only

### Inputs / Fields

- **Style:** White / cool-canvas background, Ghost border stroke (`#DADDE8`), 6px radius
- **Height:** 36px, 12px horizontal padding
- **Focus:** Ocean Slate 2px focus ring, no border color change
- **Placeholder:** Steel muted foreground
- **Disabled:** 50% opacity, not-allowed cursor
- **Error:** Destructive ring color (set via React Hook Form field state)

### Navigation

- **Style:** Sticky header (z-40, `bg-background/94 backdrop-blur`), 56px tall, 20px side padding
- **Logo mark:** 32×32px square, Ocean Slate fill, white briefcase icon
- **Nav items:** Ghost pill buttons, icon + label. On mobile (<640px): icon only (label is `sr-only`). On desktop: icon + label visible.
- **Active state:** Primary foreground text, slightly elevated background via `bg-secondary/70`
- **Theme toggle:** Ghost icon button, rightmost

### Kanban Column

The structural container for job cards. Not a card itself — the column is an untouched background element.

- **Header:** Column name (Headline, 1rem/600), card count badge (Label, secondary), icon (column accent color, 16px)
- **Body:** Vertical stack of job cards, 8px gap, internal 8px padding
- **Empty state:** Dashed border placeholder with aria-label, low-opacity prompt text
- **Accent colors available:** amber, blue, green, teal, violet, red, slate, zinc (mapped to Tailwind `bg-*-400/500` utilities)

## 6. Do's and Don'ts

### Do:
- **Do** use Ocean Slate (`#2D80D2`) exclusively for primary interactive elements — buttons, links, focus rings, the logo mark. Its rarity is intentional.
- **Do** rely on weight contrast (400 vs 600) for typographic hierarchy. Both weights are available in Avenir Next and Segoe UI Variable without visual degradation.
- **Do** cap body prose at 65ch. The job drawer's notes field and detail sections should constrain line length.
- **Do** keep card shadows tight and directional (`-24px` negative spread). A shadow should hug, not pool.
- **Do** treat dark mode as a first-class surface — check contrast, check component states, check shadows (which disappear in dark mode by design).
- **Do** use the column accent exception deliberately. The eight accent colors are for user-configured Kanban columns only.

### Don't:
- **Don't** use gradient backgrounds, gradient fills on buttons, or `background-clip: text` gradient text. Prohibited.
- **Don't** ship a purple-gradient hero or large-number metric card. This system explicitly rejects the generic SaaS dashboard template — purple gradients, hero metrics, sparklines. If it looks like every other analytics dashboard, it has failed.
- **Don't** copy the aesthetic of LinkedIn or Indeed: no corporate blue (the primary is Ocean Slate, not `#0077B5`), no dense utilitarian tables, no brand-blue navigation bars.
- **Don't** make Applyline feel like Trello — no bright multicolor card backgrounds, no playful rounded blobs, no confetti-level celebration of pipeline milestones.
- **Don't** use `font-bold` (700) or heavier. The weight ceiling is 600 (`font-semibold`). Text emphasis comes from weight contrast with the body, not from extremes.
- **Don't** render anything below 11px. Truncate instead.
- **Don't** add a `border-left` stripe greater than 1px as a decorative accent on non-card elements. The 4px column accent stripe is a documented exception specific to job cards, and it uses a background-color div, not a CSS border. Do not generalize this pattern.
- **Don't** use nested cards (a card inside a card). The job card inside the column is the one valid nesting; within the drawer, content is flat.
- **Don't** add shadows to dark-mode surfaces. Depth in dark mode comes from tonal surface contrast only.
