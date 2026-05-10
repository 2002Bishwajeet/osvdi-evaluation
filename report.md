# OSVDI Remote Access - Evaluation Report

**Date:** 2026-05-11  
**Project:** OSVDI Remote Access Clients  
**Repositories:** SPICEViewerAndroid, spicemobile-ios  
**Author:** Bishwajeet Parhi

---

## 0. Terminology & Access Variants

The OSVDI project offers SPICE remote access via **three distinct client categories**:

| Term | What it means | Examples |
|------|---------------|---------|
| **Native client** | Standalone compiled application that implements the SPICE protocol directly using libspice-gtk. No browser component. Handles video decoding, rendering, and all SPICE channels natively. | `remote-viewer` (patched, on Linux/desktop), aSPICE / freeaSPICE (Android/iOS app stores) |
| **WebView wrapper** | Thin native mobile app that embeds a browser component (Android WebView / iOS WKWebView) to load the SPICE HTML5 web client. Adds touch-to-mouse bridging and overlay controls. | SPICEViewerAndroid, spicemobile-ios (this project) |
| **Browser (web client)** | The SPICE HTML5 client running directly in a desktop browser. No wrapper app — the browser IS the application. | `https://demo.osvdi.uni-freiburg.de` in Chrome/Firefox/Safari |

```
                    OSVDI Access Variants
                    =====================

    Native Client              WebView Wrapper              Browser
    ─────────────              ───────────────              ───────
    ┌─────────────┐       ┌───────────────────┐       ┌─────────────┐
    │ remote-viewer│       │ Android/iOS App   │       │ Chrome /    │
    │ aSPICE       │       │ ┌───────────────┐ │       │ Firefox /   │
    │              │       │ │ WebView       │ │       │ Safari      │
    │ libspice-gtk │       │ │ ┌───────────┐ │ │       │             │
    │ H264 decode  │       │ │ │ SPICE     │ │ │       │ SPICE HTML5 │
    │ All channels │       │ │ │ HTML5 +   │ │ │       │ Client      │
    │              │       │ │ │ JS bridges│ │ │       │             │
    └──────┬───────┘       │ │ └───────────┘ │ │       └──────┬──────┘
           │               │ └───────────────┘ │              │
           │               └────────┬──────────┘              │
           │                        │                         │
           ▼                        ▼                         ▼
    ┌─────────────────────────────────────────────────────────────┐
    │              QEMU/KVM VM (Remote Desktop)                    │
    │              via SPICE protocol (H264 + channels)            │
    └─────────────────────────────────────────────────────────────┘
```

The **native client** (`remote-viewer`) serves as the **ground truth baseline** for performance and feature completeness. It can be launched from the OSVDI web UI by clicking "native."



---


## 2. What's Working

| Feature | Android | iOS | Notes |
|---------|---------|-----|-------|
| WebView SPICE session loading | Working | Working | Both detect SPICE URLs, configure zoom/scrollbars |
| Touch-to-mouse emulation | Working | Working | Single-finger movement, JS bridge |
| Long-press drag | Working | Working | 400ms threshold |
| Two-finger right-click | Working | Working | 120ms immediate window |
| Virtual keyboard input | Working | Working | Hidden text field captures input |
| Backspace handling | Working | Working | Platform-specific interception |
| Floating overlay controls | Working | Working | Android: draggable. iOS: fixed position |
| Loading state indicator | Working | Working | Android: 555ms delay. iOS: spinner |
| Text selection blocking | Working | Working | Same JS (CSS + MutationObserver) |
| Landscape orientation lock | Working | Working | Forced for SPICE sessions |
| Product flavor builds | Working | Working | Both have bwLPRemote + OSVDIClient |
| CI/CD pipeline | Working | Missing | Android: GitLab CI. iOS: no automation |
| Internationalization | Working | Missing | Android: 15 languages. iOS: English only |
| Haptic feedback | Partial | Working | Android: JS bridge exists, no native handler |
| Pinch-to-zoom | Broken | Partial | Android: TODO in code. iOS: 0.5x-1.0x only |

---

## 3. Observed Issues

### Android: Cropped Viewport & Missing Cursor — Critical

<img src="evidence/android/missing_mouse_pointer_and_cropped_screen.png" width="400" alt="Android: cropped screen, no cursor">

**Observed:** The remote desktop (Windows VM in Edge browser) is cropped on the right — content is cut off and inaccessible. No mouse cursor is visible anywhere on screen despite `touchToMouseScript.js` containing cursor overlay logic.

| Problem | Impact | Expected (industry standard) |
|---------|--------|------------------------------|
| Screen not scaled to device | Critical — portions of remote desktop unreachable | Fit-to-screen by default, pinch to zoom for detail |
| Mouse cursor missing | Critical — cannot see where you're pointing | Visible software cursor overlay tracking touch position |

### iOS: Taskbar Cut Off & Viewport Scaling — High

<img src="evidence/ios/taskbar_not_visible.png" width="400" alt="iOS: taskbar cut off, gray bars on sides">

**Observed:** The remote Linux desktop is visible but the bottom taskbar is cut off. Gray bars appear on both left and right sides, indicating the content is not properly scaled to fill the device viewport. The overlay buttons (blue circles) are visible on the edges.

| Problem | Impact | Expected (industry standard) |
|---------|--------|------------------------------|
| Taskbar cropped at bottom | High — cannot access running apps, system tray, start menu | Full remote desktop visible within viewport |
| Gray bars on sides | Medium — wasted screen space | Content scaled to fill available area or user-configurable aspect ratio |

### iOS: Infinite Loading State — High

<img src="evidence/ios/forever_loading_onBack_flaky.png" width="400" alt="iOS: stuck on Loading spinner">

**Observed:** The app gets stuck on a "Loading..." spinner indefinitely in two scenarios:
1. **Back navigation** — pressing back from a SPICE session (flaky, doesn't always happen)
2. **Screen lock/unlock** — locking the device during a session and unlocking consistently triggers the infinite loading state

The user must force-quit and relaunch the app to recover. The WKWebView likely loses its connection or page state when the app is suspended during screen lock, and does not handle reloading gracefully.

| Problem | Impact | Expected (industry standard) |
|---------|--------|------------------------------|
| Infinite loading after back navigation | Medium — requires app restart | Graceful disconnect, return to VM selection |
| Infinite loading after screen lock/unlock | High — very common user action breaks the session | Session survives background/suspend, or auto-reconnect on resume |

### iOS: Forced Landscape Orientation — Medium

The app always launches in landscape mode with no option to switch to portrait. Users should be able to choose their preferred orientation — portrait can be useful for reading documents, vertical web pages, or mobile-first VM layouts. Competitors like TeamViewer and AnyDesk allow both orientations with the remote desktop adapting accordingly.

| Problem | Impact | Expected (industry standard) |
|---------|--------|------------------------------|
| Forced landscape, no portrait option | Medium — limits usability for vertical content | User choice between portrait and landscape, or auto-rotate support |

### Both Platforms: Tap Does Not Move Cursor — High

The cursor only moves when dragging/hovering a finger across the screen. Tapping a different location does **not** reposition the cursor there — it clicks at the cursor's current position instead. For example, if the cursor is on an icon and the user double-taps elsewhere on the screen, the double-click registers on the icon, not where the user tapped.

In industry apps with "direct touch" mode, tapping anywhere instantly moves the cursor there and clicks. The current behavior forces users to always drag to their target first, making every interaction slower and less intuitive.

| Problem | Impact | Expected (industry standard) |
|---------|--------|------------------------------|
| Tap doesn't reposition cursor | High — every click requires a drag to target first | Tap moves cursor to touch position and clicks there (direct touch mode) |

### Both Platforms: Missing Touch Gestures — High

| Gesture | Industry Standard | OSVDI Status |
|---------|-------------------|--------------|
| Two-finger pan (viewport scroll when zoomed) | Universal | Missing |
| Two-finger scroll (mouse wheel) | Universal | Missing |
| Pinch-to-zoom | Universal | Broken (Android), Partial (iOS) |
| Touch mode toggle (direct vs trackpad) | Universal | Missing |

### Both Platforms: Missing Modifier Keys — High

The overlay has only 3 buttons (home, keyboard, one action). No modifier keys (Ctrl, Alt, Shift, Esc, function keys). Users cannot perform Ctrl+C, Ctrl+V, Alt+Tab, Ctrl+Alt+Del, or use function keys.

Every competitor provides toggleable modifier keys in the toolbar or above the on-screen keyboard.

---

## 4. Accessibility & Touch UX Assessment

A detailed comparison with 6 industry-leading remote desktop apps (TeamViewer, AnyDesk, RustDesk, Microsoft RD Client, Chrome Remote Desktop, Citrix Workspace) is available in **[accessibility-evaluation.md](accessibility-evaluation.md)**.

### Summary Scores

| Category | OSVDI Android | OSVDI iOS | Industry Standard |
|----------|---------------|-----------|-------------------|
| Touch & gestures | 4 / 10 | 4 / 10 | 10 / 10 |
| Screen & viewport | 0 / 6 | 1 / 6 | 6 / 6 |
| Cursor handling | 0 / 4 | 1 / 4 | 4 / 4 |
| Keyboard & controls | 2 / 6 | 2 / 6 | 6 / 6 |
| Toolbar & feedback | 2 / 4 | 4 / 4 | 4 / 4 |
| **Total** | **8 / 30 (27%)** | **13 / 30 (43%)** | **30 / 30** |

### What's Done, What Needs Work

| Category | Done | Needs Work |
|----------|------|------------|
| **Touch** | Tap, drag, right-click, long-press drag | Two-finger scroll, zoom, pan, touch mode toggle |
| **Screen** | Basic WebView loading | Fit-to-screen, zoom, orientation choice |
| **Cursor** | iOS partial overlay | Android visibility, proper styling |
| **Keyboard** | Text input, keyboard toggle | Modifier keys, function keys |
| **Toolbar** | Floating overlay exists | Expand with Ctrl/Alt/Fn buttons |

---

## 5. What's Missing (Feature Gaps)

### Critical Gaps (Both Platforms)

| Feature | Impact | Difficulty | Notes |
|---------|--------|-----------|-------|
| **Audio channel** (bidirectional) | Cannot use for conferencing/media | High | Native bridge or WebRTC required |
| **Clipboard/copy-paste** | Basic workflow broken | Medium | JS Clipboard API + native bridge |
| **File transfer** | Cannot move files to/from VM | High | SPICE channel or alternative |
| **USB redirection** | No local device access on VM | Very High | Fundamentally impossible via WebView |
| **Multi-monitor/desktop mode** | No external display support | High | Platform-specific display APIs |
| **Performance metrics overlay** | Cannot measure round-trip latency | Medium | Needed for evaluation |
| **Physical keyboard full support** | Modifier keys unreliable | Medium | Must intercept at native level |

### Platform-Specific Gaps

| Feature | Android | iOS |
|---------|---------|-----|
| Settings/preferences UI | Missing (hardcoded) | Partial (isTouchMode persists) |
| CI/CD pipeline | Working | Missing |
| Internationalization | 15 languages | English only |
| Pinch-to-zoom | Broken | Partial (0.5x-1.0x) |
| Haptic feedback | JS bridge, no handler | Fully implemented |
| OIDC auth detection | Basic URL matching | Explicit auth handling |
| Mac Catalyst | N/A | Not enabled |

---

## 6. Improvement Roadmap

### Immediate (Low Effort, High Impact)

| Improvement | Android | iOS | Effort |
|-------------|---------|-----|--------|
| **Fix screen scaling** — fit remote desktop to device viewport | CSS transform or viewport meta | Already partial | Medium |
| **Fix cursor visibility** — debug JS cursor overlay rendering | Debug touchToMouseScript.js | Already working (partial) | Low |
| **Fix pinch-to-zoom** — ScaleGestureDetector is wired but broken | Fix scaling math | Already partial | Low |
| **Add modifier key bar** — Ctrl, Alt, Shift, Esc toggle buttons | Extend overlay UI | Extend overlay UI | Medium |


### Medium-Term

1. **Two-finger scroll** — Map two-finger vertical drag to scroll wheel events
2. **Two-finger pan** — Viewport panning when zoomed in
3. **Touch mode toggle** — Direct touch vs trackpad-style cursor control
4. **Clipboard bridge** — Platform clipboard API + JavaScript Clipboard API
5. **On-screen modifier/function key layouts** — Custom overlays for Ctrl, Alt, F1-F12
6. **Unify JavaScript bridges** — Single source of truth for touchToMouseScript.js

### Long-Term / Architectural

1. **Performance instrumentation** — Round-trip latency measurement overlay
2. **Native SPICE client integration** — For scenarios where WebView overhead is unacceptable
3. **Background behavior** — Handle app switching without dropping SPICE connection
4. **Offline/reconnection** — Graceful network drop handling with session resume

---

## 7. Comparison with Existing Solutions

### OSVDI Access Variants (Internal)

| Variant | Platform | Rendering | Channels | Status |
|---------|----------|-----------|----------|--------|
| **remote-viewer (patched)** | Linux (Debian) | Native (libspice-gtk) | Full (video, audio, USB, clipboard, printing) | Production — ground truth |
| **SPICE HTML5 in browser** | Any desktop browser | Browser canvas | Video only (patched H264), limited input | Working — rewrite in progress |
| **SPICEViewerAndroid** | Android | WebView (Chromium) | Video + touch/keyboard bridge | Working — significant UX gaps |
| **spicemobile-ios** | iOS (iPhone/iPad) | WebView (WKWebView) | Video + touch/keyboard bridge | Working — some UX gaps |




## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebView latency unacceptable for interactive use | Unknown (must measure) | High | Benchmark against native; have FFI fallback plan |
| SPICE HTML5 rewrite breaks injected JS bridges | High | Medium | Coordinate with colleague on API stability |
| Jumping to architecture decisions before evaluation | Medium | High | Complete evaluation matrix before proposing changes |
| USB/printing channels impossible via WebView | Certain | Medium | Document as limitation; native code required |
| Platform-specific keyboard/modifier behavior | High | Medium | Systematic testing matrix per platform |

---

## 10. Summary

### Current State

The OSVDI WebView wrapper apps are **functional but significantly behind industry standards** for mobile remote desktop UX. Critical issues include cropped/unscaled remote desktop viewport, missing mouse cursor (Android), broken zoom, and absent modifier keys.

Compared to industry leaders (TeamViewer, AnyDesk, RustDesk, MS RD Client, Chrome Remote Desktop, Citrix), the Android app scores **29%** and iOS scores **39%** on accessibility feature completeness.

### What Must Happen First

**Evaluate before architecting.** The first milestone is a comprehensive comparison of all access variants.

### Architecture Decisions Pending Evaluation

Architecture and cross-platform framework decisions are deferred until evaluation data exists. A detailed analysis of options (Flutter, KMP, Electron/Tauri, .NET MAUI, native rendering approaches) is available in **[cross-platform-strategy.md](cross-platform-strategy.md)**.

| If evaluation shows... | Then consider... |
|------------------------|------------------|
| WebView latency is acceptable (<80ms) | Unify via cross-platform framework; invest in channels |
| WebView latency is unacceptable | Invest in native rendering (FFI to libspice-gtk) |
| SPICE HTML5 rewrite is fast and complete | WebView approach becomes more viable |
| Keyboard/modifier handling broken in browsers | Must intercept at native level |
| Advanced channels required on mobile | Must go native for USB/printing |

### Key Insight

The native client (`remote-viewer`) already works and supports everything. The WebView wrappers need significant UX improvements to be usable for everyday remote desktop work. Whether the long-term path is improving the WebView wrappers or building native SPICE clients depends on **measured evaluation data**.

---

## Related Documents

- **[Accessibility & Touch UX Evaluation](accessibility-evaluation.md)** — detailed comparison with 6 industry apps, gesture mapping tables, gap analysis
- **[Cross-Platform Strategy](cross-platform-strategy.md)** — Flutter, KMP, native rendering options, migration paths
- **[Keyboard Mapping Template](keyboard-mapping/template.md)** — per-variant keyboard test template
- **[Benchmark Template](benchmarks/template.md)** — performance benchmark test template
