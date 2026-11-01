# Smart Attendance — UI Guide

> Frontend-only design system. **No backend code is touched.**
> Brand palette and logo are extracted from the official brand sheet.

---

## 1. Brand palette

| Role | Hex | Token |
|---|---|---|
| Deep navy (primary) | `#162661` | `--navy-800` |
| Midnight | `#101B4A` | `--navy-900` |
| Ink navy | `#0A1130` | `--navy-950` |
| Blue (action) | `#134DAA` | `--blue-600` |
| Steel blue | `#6380AA` | `--steel` |
| Ice blue (soft bg) | `#C4D7F2` | `--ice` |
| Off-white | `#F7F7F7` | `--paper` |
| Teal accent | `#216384` | `--teal` |
| Slate accent | `#44708D` | `--slate` |
| Mist accent | `#87AFC6` | `--mist` |
| Olive accent | `#465A4B` | `--olive` |
| Sage accent | `#B6C3AD` | `--sage` |
| Moss accent | `#7A8E78` | `--moss` |

Status colours are derived from the palette: success `#2E7D5B`, warning `#A96C14`, danger `#B4232B`, info `#216384`.
A darker steel (`--steel-deep: #557399`) is used for small uppercase labels to keep WCAG AA contrast.

Typography: **Plus Jakarta Sans** (400–800), loaded in `src/styles/global.css`.

---

## 2. Where everything lives

```
Frontend/src/
├─ styles/
│  └─ global.css              ← tokens + reset + all shared component styles
├─ assets/brand/
│  ├─ logo-navy.png           ← official mark, navy (light backgrounds)
│  └─ logo-white.png          ← official mark, white (dark backgrounds)
├─ components/
│  ├─ ui/
│  │  ├─ Icon.jsx             ← single line-icon set (no icon dependency)
│  │  ├─ Logo.jsx             ← <Logo variant="navy|white" size="sm|md|lg" />
│  │  ├─ Button.jsx           ← <Button variant size icon iconRight loading block />
│  │  ├─ Field.jsx            ← <Input> <PasswordInput> <Select> <Textarea>
│  │  ├─ Feedback.jsx         ← <Alert> <Badge> <Spinner> <Loader> <EmptyState> <StatCard> <Skeleton>
│  │  └─ Motion.jsx           ← <Reveal> <AnimatedNumber> <ProgressBar>
│  └─ layout/
│     └─ AuthLayout.jsx       ← split-screen auth shell (brand panel + form)
└─ pages/
   ├─ Login.jsx               ← ✅ restyled
   ├─ Register.jsx            ← ✅ restyled
   └─ AcceptInvitation.jsx    ← ✅ restyled
```

`src/main.jsx` imports `./styles/global.css` once. `index.html` holds the title, favicon and font preconnects.

---

## 3. Component cheat-sheet

```jsx
<Button icon="plus" variant="accent">Add course</Button>
<Button variant="secondary" icon="download">Export CSV</Button>
<Button variant="danger" size="sm">Delete</Button>
<Button loading block>Signing in…</Button>

<Input label="Full name" icon="user" error="Required" hint="As in records" />
<PasswordInput label="Password" />
<Select label="Academic year" icon="calendar">…</Select>

<Alert variant="error|success|info|warning">Message</Alert>
<Badge variant="success" dot>Active</Badge>
<StatCard icon="users" label="Students" value={48} meta="+3 this week" tone="blue" />
<EmptyState icon="calendar" title="No sessions yet" description="Start a lecture to open one." action={<Button>Start</Button>} />

// Motion helpers
<Reveal delay={120}><div className="card">…</div></Reveal>
<AnimatedNumber value={92} suffix="%" />
<ProgressBar value={87} tone="success" showLabel />
<Skeleton width="60%" height={20} />
```

Layout classes available in `global.css`: `.card`, `.stat`, `.table`, `.tabs`, `.hero`, `.page-head`, `.grid-2/3/4`, `.stack`, `.row-between`, `.content`.

---

## 3.1 Motion system

**Tokens** (in `:root`):

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 180ms | hover, focus, colour changes |
| `--dur-2` | 320ms | buttons, cards, input lift |
| `--dur-3` | 550ms | entrance / stagger |
| `--dur-4` | 900ms | hero / headline reveals |
| `--ease-out` | `cubic-bezier(0.16,1,0.3,1)` | smooth deceleration |
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | playful pop / icons |

**Utilities**

```jsx
<div className="anim-up delay-2">…</div>     {/* single entrance */}
<div className="stagger">                     {/* children fade-up in sequence */}
  <StatCard … />
  <StatCard … />
</div>
<div className="hover-lift">…</div>          {/* hover rise + shadow */}
<Reveal delay={150}>…</Reveal>                {/* reveal on scroll */}
```

**Animations available:** `fadeUp`, `fadeIn`, `scaleIn`, `float`, `drift`, `rotateSlow`, `gradientPan`, `shine`, `pulseDot`, `headlineIn`, `barGrow`, `shimmer`.

**Auth-specific touches:** floating live-session card, drifting gradient orbs, rotating dashed ring, gradient headline, button shine, input lift + icon tint, card spotlight that follows the pointer, count-up on the live-session number.

**Rules**
- Animate only `transform` and `opacity` (GPU-friendly).
- Every animation is disabled by `@media (prefers-reduced-motion: reduce)`.
- Decorative elements are `aria-hidden="true"` so screen readers ignore them.

---

## 3.2 How to animate a new dashboard

1. Wrap the page content in `<div className="content stagger">` — every direct child enters in sequence.
2. Replace static KPI numbers with `<AnimatedNumber value={…} />`.
3. Add `hover-lift` to clickable cards, `hover-glow` to icon buttons.
4. Wrap below-the-fold sections in `<Reveal delay={100}>`.
5. Use `.progress` / `<ProgressBar>` for attendance percentages, and `.badge--success|warning|danger` for statuses.
6. Keep delays under 600ms so the page never feels slow.

---

## 4. Screen rollout plan

| Step | Screens | Status |
|---|---|---|
| 1 | Design system + auth screens | ✅ done |
| 2 | Student dashboard + Personal QR + Scan | next |
| 3 | Doctor / Engineer dashboard + reports | planned |
| 4 | Head dashboard + pending students | planned |
| 5 | Dean dashboard | planned |
| 6 | Responsive polish + final pass | planned |

Each page gets the shared `DashboardLayout` (sidebar + topbar) so navigation, role labels and the logo stay consistent.

---

## 5. Rules

- Never edit `Backend/` while doing UI work.
- Keep API calls, state and handlers untouched — only JSX structure and classes change.
- Use palette tokens (`var(--navy-800)`, `var(--ice)`, …) instead of hard-coded hex values in new code.
- Reuse `components/ui` before writing new inline styles.
