# Product Requirements Document
## AfterLink — Official Project Website v2.0
**Rebuild & Upgrade Plan**

---

| Field | Detail |
|---|---|
| **Project** | AfterLink Website v2.0 |
| **Author** | Ajju (Javali Ajayakumar) |
| **Current Site** | https://afterlinkdocs.vercel.app |
| **Tech Stack** | HTML · CSS · Vanilla JavaScript (no frameworks) |
| **Status** | Planning |
| **Created** | May 2026 |
| **Version** | 1.0 |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [Current Site Analysis](#3-current-site-analysis)
4. [Target Audience](#4-target-audience)
5. [Design System](#5-design-system)
6. [Site Architecture](#6-site-architecture)
7. [Section-by-Section Requirements](#7-section-by-section-requirements)
8. [New Features (Not in Current Site)](#8-new-features-not-in-current-site)
9. [Responsive Design Specification](#9-responsive-design-specification)
10. [Animation & Interaction System](#10-animation--interaction-system)
11. [Performance Requirements](#11-performance-requirements)
12. [Accessibility Requirements](#12-accessibility-requirements)
13. [File Structure](#13-file-structure)
14. [Implementation Schedule](#14-implementation-schedule)

---

## 1. Overview

AfterLink is a custom binary TCP communication protocol published on npm. The current documentation website at `afterlinkdocs.vercel.app` is a single-page app with good technical content but limited interactivity, no visual storytelling, and minimal mobile optimization.

This PRD defines the complete rebuild of the website into a **world-class protocol documentation site** — visually striking, developer-focused, and fully responsive across all devices — using only HTML, CSS, and vanilla JavaScript.

### Design Direction

**Aesthetic: "Industrial Terminal"** — dark background, monospace accents, electric cyan highlights, tight grid systems, and controlled glowing effects. Think Cloudflare docs meets Vercel's precision meets a retro terminal. The site should feel like the protocol itself: fast, tight, no bloat.

---

## 2. Goals & Success Metrics

### Goals

- Replace the current single-page site with a multi-section, deeply interactive documentation website
- Establish AfterLink as a credible, professional open-source protocol project
- Reduce bounce rate by increasing visual engagement and scroll depth
- Make it easy for developers to go from landing → install → first working code in under 5 minutes
- Make the site fully responsive across mobile (320px), tablet (768px), and desktop (1440px)

### Success Metrics

| Metric | Current (Estimated) | Target |
|---|---|---|
| Mobile usability score (Lighthouse) | ~60 | > 90 |
| Performance score (Lighthouse) | ~70 | > 90 |
| Accessibility score | ~65 | > 95 |
| Time to first working code example | ~3 min | < 2 min |
| Sections/features count | 8 | 14+ |
| Interactive elements | ~4 (tabs, copy buttons) | 12+ |

---

## 3. Current Site Analysis

### What Exists (v1.0)

| Section | Status | Notes |
|---|---|---|
| Navigation (sticky, hamburger mobile) | ✅ Done | Works but unstyled on small screens |
| Hero with stats bar | ✅ Done | Static, no animation |
| Features grid (6 cards) | ✅ Done | No hover states |
| Protocol comparison table | ✅ Done | Horizontal scroll on mobile is broken |
| Installation (tabs: npm/pnpm/yarn/GitHub) | ✅ Done | Good UX pattern |
| Quick Start (3-step guide) | ✅ Done | Code blocks need syntax highlighting |
| API Reference (method list) | ✅ Done | Very plain, hard to scan |
| Troubleshooting (accordion) | ✅ Done | Good pattern, needs better styling |
| Release Notes | ✅ Done | Static text |
| Contact form + links | ✅ Done | No validation, no success state |
| Footer | ✅ Done | Basic |

### What is Missing (v2.0 additions)

- Live protocol frame visualizer (animated binary frame inspector)
- Interactive code playground (client/server demo side-by-side)
- Performance benchmark section with animated counters
- Dark/light mode toggle
- Search across docs
- Syntax-highlighted code blocks (Prism.js)
- Sticky progress reading bar
- Version switcher (v1.0.0 → v1.1.0 etc.)
- Proper mobile nav (full-screen overlay)
- Protocol architecture diagram (animated SVG)
- "Copy link to section" anchors
- Social share metadata (Open Graph, Twitter cards)
- 404 page
- Scroll-to-top button
- Table of contents sidebar (desktop docs view)

---

## 4. Target Audience

| Persona | Profile | Key Need |
|---|---|---|
| **Backend Developer** | Node.js dev, 2–5 yrs experience | Quick install + working code in minutes |
| **Open Source Explorer** | Discovers via GitHub/npm | Protocol spec, comparison vs HTTP/gRPC |
| **Student / Learner** | Diploma/degree CS student | Clear explanations, working examples |
| **IoT Engineer** | Embedded/edge developer | Low-overhead protocol details, frame spec |
| **Tech Evaluator** | Engineering manager evaluating tools | Performance data, reliability, production readiness |

---

## 5. Design System

### Color Palette

```css
:root {
  /* Backgrounds */
  --bg-base:       #0a0c0f;   /* Primary dark background */
  --bg-surface:    #111418;   /* Card / panel surface */
  --bg-elevated:   #1a1e24;   /* Elevated elements */
  --bg-border:     #252a32;   /* Borders, dividers */

  /* Accent — Electric Cyan */
  --accent-primary:  #00d4ff;  /* Primary CTA, highlights */
  --accent-glow:     rgba(0, 212, 255, 0.15); /* Glow effects */
  --accent-dim:      #0099bb;  /* Hover state */

  /* Secondary accent — Amber (for warnings, frame types) */
  --accent-secondary: #f59e0b;

  /* Text */
  --text-primary:   #e8eaed;  /* Main text */
  --text-secondary: #8b9094;  /* Muted text */
  --text-code:      #00d4ff;  /* Inline code */

  /* Status */
  --color-success:  #10b981;
  --color-error:    #ef4444;
  --color-warning:  #f59e0b;

  /* Light mode overrides (toggled via class) */
  --bg-base-light:     #f8fafc;
  --bg-surface-light:  #ffffff;
  --text-primary-light: #0f172a;
}
```

### Typography

```css
/* Display / headings — Distinctive, sharp */
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

--font-display: 'Space Mono', monospace;  /* Used for hero, section titles */
--font-body:    'DM Sans', sans-serif;    /* Body text, descriptions */
--font-code:    'Space Mono', monospace;  /* Code blocks */

/* Type scale */
--text-xs:   0.75rem;   /* 12px — badges, labels */
--text-sm:   0.875rem;  /* 14px — secondary text */
--text-base: 1rem;      /* 16px — body */
--text-lg:   1.125rem;  /* 18px — lead text */
--text-xl:   1.5rem;    /* 24px — section subtitles */
--text-2xl:  2rem;      /* 32px — section titles */
--text-3xl:  2.75rem;   /* 44px — hero subtitle */
--text-hero: clamp(2.5rem, 6vw, 4.5rem); /* Responsive hero title */
```

### Spacing System

```css
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-6:  24px
--space-8:  32px
--space-12: 48px
--space-16: 64px
--space-24: 96px
```

### Component Tokens

```css
--radius-sm:  4px
--radius-md:  8px
--radius-lg:  12px
--radius-xl:  16px
--radius-pill: 999px

--shadow-glow: 0 0 24px rgba(0, 212, 255, 0.2);
--shadow-card: 0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3);

--transition-fast:   150ms ease;
--transition-normal: 250ms ease;
--transition-slow:   400ms ease;
```

---

## 6. Site Architecture

### Pages

```
afterlinkdocs.vercel.app/
├── index.html          ← Main single-page doc site (all sections)
├── 404.html            ← Custom 404 page (NEW)
├── css/
│   ├── main.css        ← Global styles, variables, reset
│   ├── components.css  ← Reusable component styles
│   ├── sections.css    ← Section-specific styles
│   └── responsive.css  ← Breakpoint overrides
├── js/
│   ├── main.js         ← Init, scroll behavior, theme toggle
│   ├── tabs.js         ← Tab switching (install, API)
│   ├── copy.js         ← Copy-to-clipboard for code blocks
│   ├── search.js       ← In-page search (NEW)
│   ├── visualizer.js   ← Frame visualizer (NEW)
│   ├── counter.js      ← Animated stat counters (NEW)
│   └── toc.js          ← Sidebar table of contents (NEW)
└── assets/
    ├── logo.png
    ├── logo-light.png
    └── og-image.png    ← Social share image (NEW)
```

### Navigation Structure (Single Page)

```
#home          → Hero section
#features      → Feature grid
#how-it-works  → Architecture diagram (NEW)
#benchmark     → Performance benchmarks (NEW)
#protocol      → Frame visualizer (NEW)
#comparison    → Protocol comparison table
#installation  → Install tabs
#quickstart    → Hello World guide
#playground    → Code playground (NEW)
#api           → API reference
#troubleshooting → Accordion FAQ
#releases      → Changelog
#roadmap       → Upgrade schedule (NEW)
#contact       → Contact form
```

---

## 7. Section-by-Section Requirements

### 7.1 Navigation Bar

**Current:** Basic sticky nav with text links and GitHub button.

**v2.0 Requirements:**
- Sticky top navigation, `backdrop-filter: blur(16px)` frosted glass effect on scroll
- AfterLink logo (SVG or PNG) left-aligned
- Nav links center-aligned, with underline-slide hover animation
- Version badge (`v1.0.0`) right side, pill-shaped with accent color
- GitHub star count (fetched from GitHub API via `fetch()` on load)
- **Dark/light mode toggle button** (moon/sun icon, CSS transitions)
- **Mobile:** Full-screen overlay nav with staggered link entrance animations
- Active section highlighting (IntersectionObserver-based)
- Reading progress bar (thin line at very top of viewport, fills as user scrolls)

---

### 7.2 Hero Section

**Current:** Heading + subtext + two buttons + 5 static stat chips.

**v2.0 Requirements:**
- Full viewport height (`100svh`)
- Background: animated dot-grid pattern (CSS `radial-gradient` repeating) with subtle parallax on scroll
- Large display heading with a **typewriter effect** cycling through:
  - `"Fast Communication"`
  - `"Binary Protocol"`
  - `"Zero Boilerplate"`
  - `"< 1ms Latency"`
- Subheading text below (static)
- **npm install command** in a styled terminal box with a one-click copy button
- Three CTA buttons: `Get Started` (primary), `View on npm` (secondary), `GitHub` (ghost)
- **Animated stat row** — 5 stats that count up from 0 on page load:
  - `10 Byte` Header
  - `< 1ms` Latency
  - `100K+` Req/sec
  - `16` Frame Types
  - `4` npm Packages
- Below stats: subtle scroll-down arrow with bounce animation

---

### 7.3 Features Grid

**Current:** 6 static cards with icon, title, and 2-line description.

**v2.0 Requirements:**
- 3-column grid on desktop, 2-column on tablet, 1-column on mobile
- Cards have a subtle top border that glows in accent color on hover
- Each card expands slightly on hover (`transform: translateY(-4px)`)
- Cards animate in with staggered fade+slide on scroll (IntersectionObserver)
- Add 2 new feature cards (total 8):
  - **Streaming** — `STREAM_START / DATA / END` frames for chunked data
  - **CLI Tooling** — built-in `afterlink` CLI for testing routes
- Each card has a small icon (Unicode symbol or inline SVG, no external dependencies)
- A subtle background gradient mesh behind the section

---

### 7.4 How It Works (NEW SECTION)

A visual explanation of the AfterLink connection lifecycle.

**Requirements:**
- Section title: "How AfterLink Works"
- 4-step horizontal flow (on desktop), vertical on mobile:
  1. **Connect** — Client opens TCP socket → HELLO handshake
  2. **Route** — Client sends REQUEST frame with route name
  3. **Validate** — Server runs Zod schema check automatically
  4. **Respond** — Server sends RESPONSE or publishes to Pub/Sub topic
- Each step has a number badge, short title, and 2-line description
- An animated SVG line connects the steps, drawing left-to-right on scroll
- Below the steps: inline ASCII diagram of the connection lifecycle (styled in a terminal box)

---

### 7.5 Performance Benchmarks (NEW SECTION)

**Requirements:**
- Section title: "Built for Speed"
- 4 large animated counter cards:
  - `100,000+` — Requests per second (single core)
  - `< 1ms` — Round-trip latency (LAN, p50)
  - `10 bytes` — Frame header size
  - `< 50KB` — Memory per idle connection
- Counters animate from 0 to target value when section enters viewport (IntersectionObserver)
- Below counters: a horizontal bar chart comparing header sizes (HTML/CSS, no canvas):
  - AfterLink: 10 bytes
  - MQTT: 2–5 bytes
  - gRPC: 5–50 bytes
  - WebSocket: 2–14 bytes
  - HTTP/REST: 200–800 bytes
- Bar widths are CSS-animated on scroll entry

---

### 7.6 Protocol Frame Visualizer (NEW SECTION)

An interactive binary frame inspector — the most unique section on the site.

**Requirements:**
- Section title: "The 10-Byte Frame"
- A styled terminal/hex-display box showing the binary frame layout
- Each segment of the frame is color-coded and labeled:
  - `[FF]` Frame Type — electric cyan
  - `[00]` Flags — amber
  - `[00 00 00 01]` Message ID — purple
  - `[00 00 00 1A]` Payload Length — green
  - `[...payload...]` MessagePack data — muted
- **Dropdown selector** for Frame Type — user picks REQUEST, RESPONSE, PUBLISH, etc.
- On selection, the Frame Type byte updates and the label changes (no page reload)
- Below the visualizer: a clean table of all 16 frame types with code, direction, and description
- All interactions are vanilla JS — no external libraries

---

### 7.7 Protocol Comparison Table

**Current:** Static HTML table, breaks on mobile.

**v2.0 Requirements:**
- Same data, but responsively redesigned
- On mobile: table becomes a card-per-protocol layout (CSS media query)
- Column headers are sticky horizontally (CSS `position: sticky`)
- AfterLink column has a highlighted background
- Cells use colored icons (✅/❌ replaced with actual colored SVG circles)
- Subtle row hover highlight

---

### 7.8 Installation

**Current:** Tab switcher with 4 tabs (npm, pnpm, yarn, GitHub).

**v2.0 Requirements:**
- Same structure, improved styling
- Add Prism.js (CDN) for syntax highlighting of all code blocks
- Active tab has a sliding underline indicator animation
- Copy button on every code block — shows "Copied!" feedback for 2 seconds
- Requirements note (Node.js 20+, MIT License) styled as a callout box
- Add OS detection hint: "Detected: macOS — showing bash commands"

---

### 7.9 Quick Start

**Current:** 3 numbered steps with code blocks.

**v2.0 Requirements:**
- Same 3-step flow, improved visual hierarchy
- Step numbers are large (64px) and slightly overlapping the card (decorative)
- Each step's code block has Prism.js highlighting
- A "What you'll build" callout at the top showing the expected terminal output
- A sticky sidebar (desktop only) showing which step the user is on as they scroll

---

### 7.10 Code Playground (NEW SECTION)

An interactive split-pane demo showing server and client code side by side.

**Requirements:**
- Section title: "Try It Live"
- Two-column layout (desktop), tab-switch layout (mobile):
  - Left: Server code (editable `<textarea>` with monospace styling)
  - Right: Client code (editable)
- Below: a "Simulated Output" terminal box showing what the result would look like
- A "Run Demo" button triggers a JS-simulated output animation (not real execution — a visual simulation that types out the expected result character by character)
- **Preset scenarios** via pill buttons:
  - `Ping / Pong`
  - `Schema Validation`
  - `Pub/Sub Chat`
  - `Streaming`
- Switching presets swaps the code content with a smooth fade transition
- This is entirely a **UI demo** — no server execution required

---

### 7.11 API Reference

**Current:** Two flat lists of method names with single-line descriptions.

**v2.0 Requirements:**
- Split into two tab panels: **Server API** | **Client API**
- Each method entry becomes an expandable accordion item:
  - Collapsed: method signature + one-line description
  - Expanded: parameters table, return type, and a code example
- Method signatures are syntax-highlighted inline
- A "Jump to method" quick-search input at the top of the section
- On desktop: sticky alphabet/category sidebar for fast navigation

---

### 7.12 Troubleshooting

**Current:** 7 accordion items, well structured.

**v2.0 Requirements:**
- Keep accordion structure
- Add category filter pills at the top: `Connection` | `Auth` | `Validation` | `Performance` | `All`
- Clicking a filter shows only relevant error items
- Each accordion item has a colored severity badge: `Error` | `Warning` | `Info`
- Code blocks inside accordions are syntax-highlighted with Prism.js
- Add 3 new troubleshooting entries:
  - "TLS Handshake Failure"
  - "Pub/Sub messages delivered out of order"
  - "ECONNRESET on Windows"

---

### 7.13 Release Notes / Changelog

**Current:** 3 static release cards.

**v2.0 Requirements:**
- Vertical timeline layout with a connecting line on the left
- Each release is a card on the right side of the timeline
- Version badge (pill-shaped), date, and status tag: `Stable` / `Coming Soon` / `Planned`
- New releases section added per upgrade roadmap:
  - v1.1.0 — TLS, compression, rate limiting
  - v1.2.0 — CLI, browser SDK, TypeScript
  - v2.0.0 — Cluster, Python/Dart SDKs, metrics

---

### 7.14 Roadmap (NEW SECTION)

**Requirements:**
- Section title: "What's Coming"
- 3-column phase layout on desktop, stacked on mobile:
  - Phase 1 — v1.1 (June 2026)
  - Phase 2 — v1.2 (July 2026)
  - Phase 3 — v2.0 (August 2026)
- Each phase card lists the features as a checklist (unchecked = planned, checked = done)
- A horizontal progress bar below showing overall completion percentage
- Cards animate in with staggered delay on scroll

---

### 7.15 Contact

**Current:** Contact form + links, no validation, no success state.

**v2.0 Requirements:**
- Keep the form layout
- Add live client-side validation:
  - Name: required, min 2 chars
  - Email: regex pattern check
  - Message: required, min 10 chars
  - Real-time red/green border feedback on blur
- On submit: show a success state (checkmark animation, "Message sent!" text) — no actual submission needed, just a UI demo state
- Add loading spinner on the submit button during "sending"
- Show three contact methods as styled cards (Email, GitHub, Security) with hover effects

---

## 8. New Features (Not in Current Site)

| Feature | Section | Priority |
|---|---|---|
| Dark / Light mode toggle | Global | High |
| Reading progress bar | Global nav | High |
| Active section nav highlight | Nav | High |
| GitHub star count (live API) | Nav | Medium |
| Typewriter hero animation | Hero | High |
| Animated stat counters | Hero + Benchmark | High |
| Prism.js syntax highlighting | All code blocks | High |
| How It Works flow diagram | New section | High |
| Performance benchmarks | New section | High |
| Frame visualizer (interactive) | New section | High |
| Code playground (simulated) | New section | Medium |
| API accordion with examples | API section | High |
| Troubleshooting category filter | Troubleshooting | Medium |
| Changelog timeline layout | Releases | Medium |
| Roadmap section | New section | Medium |
| Scroll-to-top button | Global | Low |
| In-page search | Global | Medium |
| Section anchor copy links | All H2s | Low |
| 404 custom page | New file | Low |
| Open Graph / social meta tags | `<head>` | High |
| Mobile full-screen nav overlay | Mobile | High |
| Responsive table → card on mobile | Comparison | High |
| TOC sidebar (desktop) | Docs sections | Medium |
| OS detection for install hints | Installation | Low |

---

## 9. Responsive Design Specification

### Breakpoints

```css
/* Mobile first */
/* Base: 0px – 479px (small phones) */
@media (min-width: 480px)  { /* Large phones */ }
@media (min-width: 768px)  { /* Tablets */ }
@media (min-width: 1024px) { /* Small desktop */ }
@media (min-width: 1280px) { /* Desktop */ }
@media (min-width: 1440px) { /* Wide desktop */ }
```

### Layout Rules Per Breakpoint

| Element | Mobile (< 768px) | Tablet (768–1024px) | Desktop (1024px+) |
|---|---|---|---|
| Navigation | Hamburger → full-screen overlay | Hamburger → overlay | Inline horizontal links |
| Hero text size | `clamp(2rem, 8vw, 2.5rem)` | `clamp(2.5rem, 5vw, 3.5rem)` | `clamp(3rem, 4vw, 4.5rem)` |
| Features grid | 1 column | 2 columns | 3 columns |
| Comparison table | Card layout (1 per protocol) | Scrollable table | Full table |
| Installation tabs | Stacked (scroll) | Tabs with full width | Tabs |
| Quick Start steps | Vertical | Vertical | Vertical with sticky sidebar |
| Playground | Tabbed (server/client) | Tabbed | Side by side |
| API reference | Accordion only | Accordion + basic sidebar | Accordion + sticky sidebar |
| How It Works | Vertical steps | Vertical steps | Horizontal flow with SVG line |
| Benchmarks | 2×2 grid | 2×2 grid | 4-column row |
| Roadmap | Stacked cards | 2-column | 3-column |
| Contact form | Full-width stacked | 2-column grid | 2-column grid |

### Mobile-Specific Requirements

- Tap targets minimum `44×44px` for all interactive elements
- No horizontal overflow (test at 320px width)
- Font sizes never below `14px` (legibility)
- Bottom padding on all sections minimum `48px`
- Mobile nav closes on link click and on Escape key
- Touch-friendly accordions (no hover-only interactions)
- Code blocks: horizontally scrollable, never break layout

---

## 10. Animation & Interaction System

### CSS Animations (No JS Required)

```css
/* Fade in up — used for cards on scroll */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Typewriter cursor blink */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* Progress bar fill */
@keyframes fillBar {
  from { width: 0%; }
  to   { width: var(--target-width); }
}

/* Counter number — CSS approach uses JS for counting */

/* Glow pulse on hero */
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.2); }
  50%       { box-shadow: 0 0 40px rgba(0, 212, 255, 0.4); }
}
```

### JavaScript Animations

| Trigger | Effect | Implementation |
|---|---|---|
| Page load | Hero stat counters animate from 0 | `requestAnimationFrame` loop |
| Page load | Typewriter cycles through phrases | `setInterval` + string slicing |
| Scroll into view | Cards fade in with stagger | `IntersectionObserver` + CSS class add |
| Scroll into view | Benchmark bars animate width | `IntersectionObserver` + CSS var |
| Scroll into view | How It Works SVG line draws | `IntersectionObserver` + `stroke-dashoffset` |
| Scroll | Reading progress bar fills | `scroll` event + width calculation |
| Click (copy) | Button shows "Copied!" then resets | `setTimeout` + class toggle |
| Click (theme toggle) | Fade between dark/light | CSS transition on `body` class |
| Click (nav mobile) | Full-screen overlay slides in | CSS class toggle + `transform` |
| Hover (feature card) | Lift + border glow | Pure CSS `transform` + `box-shadow` |

### Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. Performance Requirements

| Metric | Target |
|---|---|
| Lighthouse Performance | > 90 |
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Total Blocking Time | < 200ms |
| Cumulative Layout Shift | < 0.1 |
| Total page size (uncompressed) | < 500KB |
| Total page size (compressed) | < 150KB |
| Number of HTTP requests | < 12 |

### Performance Strategies

- All fonts loaded via `font-display: swap`
- Prism.js loaded only for the languages used (JS only, not all 100+)
- No jQuery, no lodash, no React — pure vanilla
- Images: logo in SVG where possible, PNG otherwise with `width` and `height` attrs to avoid CLS
- JS deferred with `defer` attribute on all `<script>` tags
- CSS variables for theming (no second stylesheet for dark mode)
- IntersectionObserver for lazy animation triggering (no scroll event spam)
- GitHub star count request: cached in `sessionStorage` to avoid repeat fetches

---

## 12. Accessibility Requirements

- All images have meaningful `alt` text
- All interactive elements (buttons, links, accordions) are keyboard navigable
- Focus indicators always visible (`outline` never set to `none` without replacement)
- Color contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text
- ARIA roles: `role="navigation"`, `role="main"`, `role="search"`, `aria-expanded` on accordions
- Screen reader text for icon-only buttons (`aria-label`)
- Skip-to-main-content link at very top of page (visually hidden until focused)
- Tab order follows visual reading order
- Form inputs have associated `<label>` elements
- Error messages associated with inputs via `aria-describedby`

---

## 13. File Structure

```
afterlinkdocs.vercel.app/
│
├── index.html                  ← Main document, all sections
├── 404.html                    ← Custom 404 page
│
├── css/
│   ├── main.css                ← Reset, variables, typography, utilities
│   ├── components.css          ← Buttons, cards, badges, code blocks, tabs, accordions
│   ├── sections.css            ← Per-section styles (hero, features, etc.)
│   └── responsive.css          ← All @media queries in one file
│
├── js/
│   ├── main.js                 ← Init, theme toggle, scroll-to-top, mobile nav
│   ├── scroll.js               ← Reading progress bar, active nav highlight
│   ├── tabs.js                 ← Tab switching component (install, API)
│   ├── accordion.js            ← Accordion open/close, category filtering
│   ├── copy.js                 ← Copy-to-clipboard for all code blocks
│   ├── counter.js              ← Animated number counters (IntersectionObserver)
│   ├── typewriter.js           ← Hero typewriter effect
│   ├── visualizer.js           ← Frame type selector and byte display
│   ├── playground.js           ← Code playground preset switching + simulated output
│   ├── search.js               ← In-page doc search
│   ├── toc.js                  ← TOC sidebar generation and active tracking
│   └── github.js               ← Fetch + cache GitHub star count
│
└── assets/
    ├── logo.png
    ├── logo-light.png
    └── og-image.png
```

---

## 14. Implementation Schedule

### Week 1 — Foundation
- Set up file structure and CSS variable system
- Implement design tokens (colors, typography, spacing)
- Build navigation (desktop + mobile overlay)
- Build reading progress bar
- Implement dark/light mode toggle

### Week 2 — Hero + Stats + Features
- Build Hero section (typewriter, animated stats, terminal box)
- Build Features grid (8 cards, hover effects, scroll animations)
- Build How It Works flow diagram with animated SVG line

### Week 3 — Protocol + Benchmarks
- Build Frame Visualizer section (interactive frame type selector)
- Build Performance Benchmarks section (animated counters + CSS bars)
- Build Protocol Comparison table (with mobile card fallback)

### Week 4 — Install + Quick Start + Playground
- Integrate Prism.js syntax highlighting
- Rebuild Installation tabs
- Rebuild Quick Start section
- Build Code Playground (preset switcher, simulated terminal output)

### Week 5 — API + Troubleshooting
- Rebuild API Reference as expandable accordions with code examples
- Add category filter pills to Troubleshooting
- Add 3 new troubleshooting entries

### Week 6 — Changelog + Roadmap + Contact
- Build Changelog timeline layout
- Build Roadmap section (3 phases, progress bar)
- Rebuild Contact form with live validation and success state

### Week 7 — Polish + QA
- In-page search implementation
- GitHub star count integration
- TOC sidebar (desktop)
- Scroll-to-top button
- Open Graph / social meta tags
- 404 custom page
- Accessibility audit and fixes

### Week 8 — Performance + Launch
- Lighthouse audit on all pages (target > 90 all categories)
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile device testing (iPhone 12, Samsung S21, iPad)
- Testing at 320px, 375px, 768px, 1024px, 1440px
- Deploy to Vercel

---

## Appendix A: External Dependencies Allowed

| Library | Version | CDN URL | Purpose |
|---|---|---|---|
| Prism.js | 1.29.0 | `cdnjs.cloudflare.com` | Syntax highlighting |

No other external JS libraries. All animations, interactions, and UI logic in vanilla JS.

---

## Appendix B: Open Graph Meta Tags

```html
<meta property="og:title" content="AfterLink — Binary Communication Protocol" />
<meta property="og:description" content="A custom 10-byte binary protocol for real-time messaging. Faster than HTTP, simpler than gRPC." />
<meta property="og:image" content="https://afterlinkdocs.vercel.app/assets/og-image.png" />
<meta property="og:url" content="https://afterlinkdocs.vercel.app" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="AfterLink — Binary Communication Protocol" />
<meta name="twitter:description" content="10-byte binary frame. < 1ms latency. 100K+ req/sec." />
<meta name="twitter:image" content="https://afterlinkdocs.vercel.app/assets/og-image.png" />
```

---

*Document version 1.0 — May 2026 — Ajju (Javali Ajayakumar)*
