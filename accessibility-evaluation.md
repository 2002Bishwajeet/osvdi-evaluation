# Accessibility & Touch UX Evaluation

**Date:** 2026-05-09  
**Scope:** Evaluate touch interaction, gesture handling, cursor behavior, and screen scaling in OSVDI WebView wrappers against industry standards.  
**Industry reference apps:** TeamViewer, AnyDesk, RustDesk, Microsoft RD Client, Chrome Remote Desktop, Citrix Workspace

---

## 1. Industry Standard vs OSVDI: Feature Comparison

The "Industry Standard" column represents what **all or most** of the 6 reference apps support. This is the baseline users expect from any mobile remote desktop app.

### Touch & Gesture Input

| Feature | Industry Standard | OSVDI Android | OSVDI iOS | Status |
|---------|-------------------|---------------|-----------|--------|
| **Touch modes** | All offer 2+ modes (direct touch + trackpad/cursor) | Single mode only | Single mode only | Needs work |
| **One-finger tap → left click** | Universal | Working | Working | Done |
| **One-finger drag → move cursor** | Universal | Working | Working | Done |
| **Two-finger tap → right-click** | Supported by 4/6 apps | Working | Working | Done |
| **Two-finger drag → scroll** | Universal (mouse wheel equivalent) | Missing | Missing | Needs work |
| **Pinch-to-zoom** | Universal | Broken (TODO in code) | Partial (0.5x–1.0x) | Needs work |
| **Pan when zoomed** | Universal (drag to move viewport) | Missing | Missing | Needs work |
| **Long-press → drag** | Supported by 4/6 apps (some use for right-click) | Working (400ms) | Working (400ms) | Done |
| **Three-finger tap → middle click** | Supported by 2/6 apps | Missing | Missing | Nice-to-have |
| **Touch mode toggle** | Universal (switch direct ↔ trackpad) | Missing | Missing | Needs work |

### Screen Scaling & Viewport

| Feature | Industry Standard | OSVDI Android | OSVDI iOS | Status |
|---------|-------------------|---------------|-----------|--------|
| **Fit-to-screen on connect** | Universal default | No — screen cropped | Partial — taskbar cut off, gray bars | Needs work |
| **1:1 pixel mode** | Available in most (via zoom or setting) | N/A | N/A | Nice-to-have |
| **Custom zoom levels** | Pinch zoom or slider (all apps) | Broken | 0.5x–1.0x only | Needs work |
| **Zoom persistence** | Maintained across interactions (5/6 apps) | N/A | N/A | Needs work |
| **Resolution adaptation** | Server-side or client-side options (4/6 apps) | None | None | Nice-to-have |
| **Orientation choice** | Most allow portrait + landscape | Forced landscape | Forced landscape | Needs work |

### Cursor Handling

| Feature | Industry Standard | OSVDI Android | OSVDI iOS | Status |
|---------|-------------------|---------------|-----------|--------|
| **Cursor visible** | Always visible in cursor/mouse mode (all apps) | Missing | JS overlay (partial) | Needs work |
| **Cursor style** | Software overlay or remote cursor image | N/A | Fixed dot | Needs work |
| **Cursor size/speed adjust** | Rare (Citrix only) | No | No | Nice-to-have |
| **Cursor matches remote context** | Rare (Citrix only — text cursor, pointer, etc.) | No | No | Nice-to-have |

### Toolbar, Keyboard & Controls

| Feature | Industry Standard | OSVDI Android | OSVDI iOS | Status |
|---------|-------------------|---------------|-----------|--------|
| **Floating toolbar** | All apps have toolbar/control surface | 3 buttons (draggable) | 3 buttons (fixed) | Partial |
| **Toolbar movable** | 2/6 apps (AnyDesk, MS RD Client) | Yes (draggable) | No | Partial |
| **Modifier keys (Ctrl, Alt, Shift, Esc)** | All apps provide toggleable modifier buttons | Missing | Missing | Needs work |
| **Function keys (F1–F12)** | All apps (via Fn toggle or secondary layer) | Missing | Missing | Needs work |
| **Keyboard trigger** | Toolbar button (all apps) | Working | Working | Done |
| **Auto-keyboard on focus** | Rare (Citrix only) | No | No | Nice-to-have |
| **Gesture guide / help** | 2/6 apps (AnyDesk, Citrix) | Missing | Missing | Nice-to-have |
| **Haptic feedback** | Underutilized across industry | JS bridge exists, no handler | Fully implemented | Partial |

---

## 2. Gap Summary

### Completeness by Tier

Scoring: Implemented = 2, Partial = 1, Missing = 0

#### MVP (Must-Have) — app is broken without these

| Feature | OSVDI Android | OSVDI iOS |
|---------|---------------|-----------|
| Fit-to-screen scaling | 0 | 1 |
| Visible cursor | 0 | 1 |
| Tap repositions cursor | 0 | 0 |
| Pinch-to-zoom | 0 | 1 |
| Pan when zoomed | 0 | 0 |
| Modifier keys (Ctrl, Alt, Shift, Esc) | 0 | 0 |
| Back/home navigation | 0 | 2 |
| Session survives screen lock | 2 | 0 |
| Orientation choice | 0 | 0 |
| **MVP Total** | **2 / 18 (11%)** | **5 / 18 (28%)** |

#### Enhanced — comfortable for real work

| Feature | OSVDI Android | OSVDI iOS |
|---------|---------------|-----------|
| Two-finger scroll | 0 | 0 |
| Two-finger right-click | 2 | 2 |
| Long-press drag | 2 | 2 |
| Touch mode toggle | 0 | 0 |
| Function keys (F1–F12, Esc) | 0 | 0 |
| Keyboard trigger button | 2 | 2 |
| Floating toolbar | 2 | 2 |
| Haptic feedback | 0 | 2 |
| Gesture help/onboarding | 0 | 0 |
| **Enhanced Total** | **8 / 18 (44%)** | **10 / 18 (56%)** |

#### Premium — competitive with industry leaders

| Feature | OSVDI Android | OSVDI iOS |
|---------|---------------|-----------|
| Cursor size/speed adjust | 0 | 0 |
| Remote cursor matching | 0 | 0 |
| Auto-keyboard on focus | 0 | 0 |
| Gesture customization | 0 | 0 |
| 1:1 pixel mode | 0 | 0 |
| Resolution adaptation | 0 | 0 |
| Three-finger middle click | 0 | 0 |
| **Premium Total** | **0 / 14 (0%)** | **0 / 14 (0%)** |

### Summary

| Tier | Android | iOS | What it means |
|------|---------|-----|---------------|
| **MVP** | 2 / 18 (11%) | 5 / 18 (28%) | App is usable for basic remote desktop |
| **Enhanced** | 8 / 18 (44%) | 10 / 18 (56%) | Comfortable for real daily work |
| **Premium** | 0 / 14 (0%) | 0 / 14 (0%) | Competitive with TeamViewer/AnyDesk |
| **Overall** | **10 / 50 (20%)** | **15 / 50 (30%)** | |

---


## 4. UX Best Practices for Mobile Remote Desktop

Based on analysis of 6 industry apps, these are the patterns OSVDI should adopt:

### Must-Have

1. **Two input modes** — Direct touch (tap = click there) and trackpad/cursor (relative movement). Easy toggle.
2. **Pinch-to-zoom + pan** — Zoom magnifies viewport, two-finger drag pans. Universal expectation.
3. **Two-finger scroll** — Maps to mouse wheel for scrolling remote content.
4. **Visible, high-contrast cursor** — Must remain visible against any background.
5. **Modifier key bar** — Toggleable Ctrl, Alt, Shift, Win/Cmd, Esc in toolbar or above keyboard.
6. **Fit-to-screen default** — Remote desktop scaled to fit device on connect.

### Should-Have

7. **Function key row** — F1–F12, accessible via Fn toggle or secondary keyboard layer.
8. **Haptic feedback** — Confirm clicks, mode switches, and edge boundaries.
9. **Minimal-footprint toolbar** — Floating button or swipe-to-reveal to minimize screen obstruction.
10. **Zoom persistence** — Maintained across keyboard show/hide and orientation changes.
11. **Orientation support** — Allow both portrait and landscape.

### Nice-to-Have

12. **Auto-keyboard on focus** — Detect editable fields, auto-show keyboard.
13. **Gesture customization** — Let power users remap finger gestures.
14. **Remote cursor matching** — Show actual remote cursor shape.
15. **Gesture guide** — In-app tutorial or help overlay.

### Anti-Patterns to Avoid

- **Forced orientation** — Locking to landscape without user choice.
- **Mode not persisting** — Re-selecting touch mode every session frustrates users.
- **Gesture conflicts with OS** — Three-finger gestures conflict with Android system navigation.
- **No visible toolbar anchor** — Purely gesture-triggered menus are undiscoverable.
- **Zoom resetting on keyboard** — Breaks user flow when keyboard appears/disappears.
- **No visual feedback for mode switches** — Users need confirmation (icon, haptic, color change).
