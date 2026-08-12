# Design tokens

Extracted from the working v1.0 applications. Use these values, not a component
library's defaults. The designs are high fidelity and should be recreated
faithfully.

## Colours

| Token | Hex | Use |
|---|---|---|
| Primary | `#1D4ED8` | Primary actions, active navigation, links |
| Primary hover | `#1E40AF` | Hover on primary |
| Primary deep | `#1E3A8A` | Gradient end, link hover |
| Primary bright | `#2563EB` | Avatar tiles, gradient start |
| Primary tint | `#E0EAFF` | Icon tile backgrounds, secondary buttons |
| Primary wash | `#EEF3FB` | Table headers, callout panels |
| Surface wash | `#F1F5FD` | Input backgrounds |
| Page background | `#EEF3FB` | Staff workspace canvas |
| Mobile background | `#F2F6FD` | Patient app canvas |
| Sidebar | `#0D1B3E` | Sidebar, toast background |
| Text primary | `#0D1B3E` | Body text, headings |
| Text secondary | `#64748B` | Supporting text, labels |
| Text tertiary | `#94A3B8` | Timestamps, placeholders |
| Disabled text | `#B6C2D9` | Struck-through slots |
| Border | `rgba(30,64,175,.12)` | Hairline borders |
| Row hover | `#F6F9FE` | Table row hover |

### Semantic status

| State | Background | Text | Border |
|---|---|---|---|
| Success, paid, completed | `#ECFDF5` | `#047857` | `#A7F3D0` |
| Pending, part paid, warning | `#FFFBEB` | `#B45309` | `#FDE68A` |
| Unpaid, critical, blocked | `#FEF2F2` | `#DC2626` | `#FECACA` |
| Info, submitted | `#EFF6FF` | `#1D4ED8` | `#BFDBFE` |
| **AI, reserved** | `#F5F3FF` | `#7C3AED` | `#DDD6FE` |

Purple is reserved for AI. Do not use it for anything else. It is how a user tells
a suggestion from a recorded fact.

Every status chip carries **both** a colour and a word, so it survives printing and
colour blindness.

### MoMo provider colours

| Provider | Colour |
|---|---|
| MTN MoMo | `#F5B800` on `#3b2f00` text |
| Telecel Cash | `#E60000` |
| AT Money | `#0D1B3E` |

## Typography

| Family | Use |
|---|---|
| Plus Jakarta Sans | Headings, UI labels, buttons |
| Inter | Body copy, descriptions |
| JetBrains Mono | Clinical values, MRNs, amounts, times, references |

Monospaced for clinical values is deliberate: digits align in a column, which makes
a misreading less likely.

### Scale

| Level | Desktop | Mobile | Weight |
|---|---|---|---|
| Page title | 22px | 22px | 800 |
| Section heading | 18px | 17px | 800 |
| Card heading | 15px | 15px | 800 |
| Body | 13.5px | 12.5px | 400-600 |
| Supporting | 12.5px | 11.5px | 400 |
| Label, uppercase | 11px | 11px | 700, letter-spacing .07em |
| Chip | 11px | 10.5px | 700 |

Body text never below 12.5px on desktop or 11.5px on mobile.

## Spacing

4px base unit. Card padding 20px. Section gaps 24px. List gaps 10px. Form field
gaps 14px.

Lay out sibling groups with flex or grid and `gap`, never margins on each child.

## Radius

| Element | Radius |
|---|---|
| Inputs, small buttons | 10-12px |
| Cards, list rows | 16-18px |
| Panels, modals | 20-24px |
| Chips, pills, avatars | full |
| Mobile sheet | 28px top corners only |

## Shadows

| Level | Value |
|---|---|
| Card | `0 1px 2px rgba(13,27,62,.04)` |
| Raised | `0 14px 34px -12px rgba(13,27,62,.25)` |
| Modal | `0 32px 80px -20px rgba(13,27,62,.5)` |

## Iconography

Material Symbols Rounded, loaded as a font from Google Fonts. Sizes 14 to 22px.
Always paired with a text label in navigation.

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400..600,0..1,0" rel="stylesheet" />
```

Do not substitute an SVG icon library. Two defects in v1.0 were caused by
unreachable external icon and image sources in the deployed build, which is why
the design uses a font and generates avatars as initials tiles rather than loading
photographs.

## Animation

| Motion | Value |
|---|---|
| Panel and toast entry | `fadeUp .25-.3s ease` (translateY 10px, opacity 0 to 1) |
| Live indicator, waiting state | `breathe 1.4-1.6s ease-in-out infinite` (opacity 1 to .35) |
| Spinner | `spin .8s linear infinite` |
| Button press | `transform: scale(.97)` on active |

## Mobile specifics

Touch targets at least 44 by 44px. Five-tab bottom bar with a 62px top inset for
the status bar. Filled icon variant marks the active tab. Nesting never deeper
than two levels.
