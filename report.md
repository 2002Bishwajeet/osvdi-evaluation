# OSVDI Remote Access - Evaluation Report & Strategy

**Date:** 2026-05-06  
**Project:** OSVDI Remote Access Clients  
**Repositories:** SPICEViewerAndroid, spicemobile-ios  
**Author:** Bishwajeet Parhi

---

## 0. Terminology & Access Variants

Before diving in, the OSVDI project offers SPICE remote access via **three distinct client categories**:

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

The **native client** (`remote-viewer`) serves as the **ground truth baseline** for performance and feature completeness. It can be launched from the OSVDI web UI by clicking "native." The WebView wrappers and browser clients should be measured against it.

> **Note:** A colleague is actively rewriting the SPICE HTML5 web client code, which is currently dated and patched to support full-screen H264 video. This rewrite will directly impact both the WebView wrapper apps and the browser experience.

---

## 1. Current State Overview

### Architecture of the WebView Wrapper Apps

The Android and iOS apps in this project are **WebView wrappers** — thin native shells that embed a browser component to load the OSVDI web frontend (`https://demo.osvdi.uni-freiburg.de`). They inject JavaScript to bridge touch interactions into mouse/keyboard events the SPICE HTML5 client understands.

They are **not** native SPICE clients — they do not use libspice-gtk or handle protocol/video decoding themselves.

### Codebase Metrics — Side by Side

| Metric | Android | iOS |
|--------|---------|-----|
| **Language** | Java (6 classes, ~850 LOC) + JS (2 files, ~480 LOC) | Swift (6 files, ~1340 LOC) + JS (2 files, ~480 LOC) |
| **Build System** | Gradle 9.4.1, AGP 9.2.0 | Xcode 26.1, Swift 5.0 |
| **Min Platform** | SDK 21 (Android 5.0 Lollipop) | iOS 17.0 |
| **Target Platform** | SDK 36 (Android 15) | iOS 17+ (iPhone + iPad) |
| **Product Flavors/Targets** | 2 (bwLPRemote, OSVDIClient) | 2 (bwLP Remote, OSVDIClient) |
| **Localizations** | 15 languages | None (English only) |
| **CI/CD** | GitLab CI (lint, build, test, deploy) | None |
| **Native Code** | None (pure Java + JS) | None (pure Swift + JS) |
| **Dependencies** | Minimal (AndroidX, Material3) | Zero external dependencies |
| **UI Framework** | Android Views (XML layouts) | SwiftUI |
| **License** | Apache 2.0 | GPLv2 |
| **Persistence** | None (hardcoded values) | AppStorage (isTouchMode) |
| **Haptic Feedback** | JS bridge exists, native handler missing | Fully implemented (light + medium) |

---

## 2. What's Working

### Feature Comparison Matrix

| Feature | Android | iOS | Notes |
|---------|---------|-----|-------|
| WebView SPICE session loading | Working | Working | Both detect SPICE URLs, configure zoom/scrollbars |
| Touch-to-mouse emulation | Working | Working | Shared JS logic; single-finger movement, cursor overlay |
| Long-press drag | Working | Working | 400ms threshold on both |
| Two-finger right-click | Working | Working | 120ms immediate window on both |
| Virtual keyboard input | Working | Working | Hidden text field captures input, bridges via JS |
| Backspace handling | Working | Working | Android: onKeyPreIme(), iOS: deleteBackward() override |
| Floating overlay controls | Working | Working | Android: draggable. iOS: fixed position, top-right |
| Loading state indicator | Working | Working | Android: 555ms delay. iOS: standard spinner |
| Text selection blocking | Working | Working | Same JS (CSS + MutationObserver) |
| Landscape orientation lock | Working | Working | Forced for SPICE sessions |
| Pinch-to-zoom | Broken | Working | Android: TODO in code. iOS: 0.5x–1.0x via MagnificationGesture |
| Haptic feedback | Partial | Working | Android: JS bridge exists but no native handler. iOS: fully wired |
| Form auto-resubmission | Working | N/A | Android-specific WebViewClient behavior |
| New window/tab links | Working | N/A | Fixed in recent Android commit |
| Product flavor builds | Working | Working | Both have bwLPRemote + OSVDIClient variants |
| CI/CD pipeline | Working | Missing | Android: GitLab CI. iOS: no automation |
| Internationalization (i18n) | Working | Missing | Android: 15 languages. iOS: English only |
| Touch mode persistence | Missing | Working | iOS uses AppStorage; Android hardcoded |
| SPICE API target detection | Basic | Advanced | iOS detects SpiceKeyboard, rfb, noVNC canvas targets |
| Auth URL handling | Basic | Working | iOS explicitly detects OpenID Connect auth flows |

### Build & Deployment

**Android:**
- Automated GitLab CI builds for debug and release APKs
- APK artifacts published to GitLab Pages
- Both product flavors build independently
- Lint, unit test, and instrumented test stages

**iOS:**
- No CI/CD pipeline configured
- Manual Xcode builds only
- Both targets (OSVDIClient, bwLP Remote) share all source code
- No automated testing infrastructure

---

## 3. What's Missing

### Critical Gaps (Both Platforms)

| Feature | Impact | Android | iOS | Difficulty |
|---------|--------|---------|-----|-----------|
| **Audio channel** (bidirectional) | Cannot use for conferencing/media | Missing | Missing | High — native bridge or WebRTC |
| **Clipboard/Copy-paste** | Basic workflow broken | Missing | Missing | Medium — JS clipboard API + native bridge |
| **File transfer** | Cannot move files to/from VM | Missing | Missing | High — SPICE channel or alternative |
| **USB redirection** | No local device access on VM | Missing | Missing | Very High — kernel-level, unlikely via WebView |
| **Multi-monitor/desktop mode** | Cannot use phone as trackpad + external display | Missing | Missing | High — platform-specific display APIs |
| **Performance metrics overlay** | Cannot measure round-trip latency | Missing | Missing | Medium |
| **Physical keyboard full support** | Modifier keys (Alt, Ctrl, Fn) unreliable | Missing | Missing | Medium |

### Platform-Specific Gaps

| Feature | Android Status | iOS Status |
|---------|---------------|------------|
| **Configurable settings UI** | Missing (all hardcoded) | Partial (isTouchMode persists, rest hardcoded) |
| **CI/CD pipeline** | Working | Missing entirely |
| **Internationalization** | 15 languages | English only |
| **Pinch-to-zoom** | Broken (TODO in code) | Working (0.5x–1.0x) |
| **Haptic feedback** | JS bridge exists, no native handler | Fully implemented |
| **OIDC auth detection** | Basic URL matching | Explicit auth URL handling |
| **Context menu prevention** | Via JS injection | Via JS + native WKUIDelegate |
| **Mac Catalyst support** | N/A | Not enabled (SwiftUI would support it) |

### Missing but Planned (from both READMEs)

- Audio (direct + headset)
- External keyboard/mouse support
- File transfer between remote and local
- Copy and paste
- Local printer integration
- Desktop mode (USB-C/HDMI external display)

### Evaluation Gaps (from Project Requirements)

| Requirement | Current Status |
|-------------|---------------|
| Ground truth comparison with FreeRDP | Not started |
| Benchmark execution in VMs | Not started |
| BabylonJS train demo performance test | Not started |
| Special keyboard mapping evaluation | Partial (backspace works, modifiers untested) |
| Multi-factor authentication integration | Not implemented |
| Security token support (YubiKey, Face ID) | Not implemented |
| Smart TV support | Not explored |
| Desktop client evaluation (Windows, Linux, macOS) | Not started |

---

## 4. What Can Be Improved

### Immediate Improvements (Low Effort, High Impact)

| Improvement | Android | iOS | Effort |
|-------------|---------|-----|--------|
| **Settings/Preferences UI** — cursor speed, zoom, default URL | SharedPreferences + Settings screen | Expand AppStorage + Settings view | Low |
| **Fix pinch-to-zoom (Android)** — ScaleGestureDetector wired but broken | Fix scaling math | Already working | Low |
| **Implement haptic handler (Android)** — JS bridge calls exist | Add native handler | Already working | Low |
| **Add CI/CD (iOS)** — No build automation | Already working | Add GitHub Actions or fastlane | Low-Medium |
| **Add i18n (iOS)** — English only | Already has 15 languages | Add String Catalogs | Low |
| **Physical keyboard pass-through** — Modifier keys unreliable | Intercept at Activity level | Intercept at UIKit level | Medium |
| **Connection status indicator** — Show latency/FPS | Add overlay | Add overlay | Medium |

### Medium-Term Improvements (Both Platforms)

1. **Clipboard bridge** — Platform clipboard API + JavaScript Clipboard API for bidirectional sync
2. **On-screen keyboard layouts** — Custom overlays with modifier keys, function keys, Esc (critical for terminal use)
3. **Configurable QoE** — User-selectable codec preference, bandwidth limits, quality vs. latency tradeoff
4. **External display support** — Android: Presentation API. iOS: UIScreen/external display detection. Phone acts as trackpad
5. **Orientation handling** — Allow portrait mode for certain use cases (reading, mobile-first VMs)
6. **Unify JavaScript bridges** — The touchToMouseScript.js and disableSelectionScript.js are nearly identical across repos but have drifted slightly; maintain a single source of truth

### Long-Term / Architectural

1. **Performance instrumentation** — Measure and display round-trip latency (input → display update)
2. **Native SPICE client integration** — For scenarios where WebView overhead is unacceptable
3. **Background behavior** — Handle incoming calls, app switching without dropping SPICE connection
4. **Offline/reconnection** — Graceful handling of network drops with session resume
5. **Converge to a single cross-platform codebase** — See Section 5

---

## 5. Cross-Platform Strategy Analysis

### The Core Question

The project currently has **two separate native codebases** (Android + iOS) that implement the same WebView-based approach with nearly identical JavaScript bridges. The project requirements specify support for:
- **Desktop:** Windows, Linux (Wayland/Xorg), macOS (x86, ARM64)
- **Mobile:** Android, iOS (both exist today)
- **Further:** Smart TVs

The question is not just "how to add more platforms" but also **"should the two existing mobile codebases be unified?"**

### Current Pain Points (Two Separate Repos)

| Issue | Impact |
|-------|--------|
| JS bridges have drifted (minor differences in touchToMouseScript.js) | Bug fixes must be applied twice |
| Feature parity gaps (Android has i18n, iOS has haptics + pinch zoom) | Users get inconsistent experience |
| No shared test suite | Regressions caught independently |
| Different licenses (Apache 2.0 vs GPLv2) | Legal ambiguity for shared code |
| Adding a 3rd platform (macOS/Windows/Linux) means a 3rd codebase | Unsustainable |

### Option Analysis

#### Option A: WebView on Each Platform (Current Approach Extended)

Maintain separate native wrappers per platform, each embedding a WebView/WKWebView.

| Platform | WebView Engine | Wrapper Language | Status |
|----------|---------------|-----------------|--------|
| Android | Android WebView (Chromium) | Java/Kotlin | Exists |
| iOS | WKWebView (WebKit) | Swift | Exists |
| macOS | WKWebView (WebKit) | Swift/AppKit | Not started |
| Windows | WebView2 (Edge/Chromium) | C#/.NET or C++ | Not started |
| Linux | WebKitGTK or CEF | C/C++ or Rust | Not started |

**Pros:** Maximum native control per platform, both mobile clients already work  
**Cons:** 5+ separate codebases, duplicated JS bridge logic, feature parity impossible to maintain, maintenance scales linearly with platforms

#### Option B: Cross-Platform Framework with WebView (Recommended)

Use a single cross-platform framework that provides a WebView component, sharing the bridge logic.

##### B1: Flutter + WebView Plugin

```
┌──────────────────────────────────────────────┐
│  Flutter App (Dart)                           │
│  ┌────────────────────────────────────────┐  │
│  │  Shared Logic Layer                    │  │
│  │  - Connection management               │  │
│  │  - Settings/preferences                │  │
│  │  - Input handling (touch/keyboard)     │  │
│  │  - Overlay UI                          │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  webview_flutter / InAppWebView        │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │  SPICE HTML5 Client              │  │  │
│  │  │  + Injected JS bridges           │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  Platform Channels (per-platform)      │  │
│  │  - Clipboard, USB, Printing, Audio    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

| Aspect | Assessment |
|--------|-----------|
| **Supported Platforms** | Android, iOS, macOS, Windows, Linux, Web |
| **WebView Support** | `webview_flutter` (official) or `flutter_inappwebview` (more features) |
| **Native API Access** | Platform channels for USB, clipboard, printing, biometrics |
| **Desktop Mode** | Flutter desktop targets handle external displays |
| **Build Pipeline** | Single codebase, platform-specific CI per target |
| **Maturity** | Production-ready, large ecosystem |
| **Language** | Dart (easy to learn, good tooling) |

**Pros:**
- Single codebase for all platforms
- Strong WebView plugins with JS injection, cookie management, custom schemes
- Platform channels for native features (clipboard, USB, biometrics)
- Excellent desktop support (Windows, macOS, Linux)
- Hot reload for rapid development
- Material Design 3 built-in
- Existing i18n infrastructure

**Cons:**
- WebView on desktop may have different behavior than mobile
- Additional abstraction layer between hardware and user (as noted in project doc)
- Flutter WebView on Linux uses WebKitGTK (less mature than Chromium)

##### B2: Kotlin Multiplatform (KMP) + Compose Multiplatform

| Aspect | Assessment |
|--------|-----------|
| **Supported Platforms** | Android, iOS, Desktop (JVM), Web (experimental) |
| **WebView Support** | Limited — no official multiplatform WebView component |
| **Native API Access** | Excellent via expect/actual pattern |
| **Maturity** | Android excellent, iOS/Desktop improving, Web experimental |

**Pros:** Shares logic in Kotlin, Android expertise transfers directly  
**Cons:** No unified WebView component across platforms, desktop support less mature than Flutter

##### B3: Electron/Tauri for Desktop + Separate Mobile

| Aspect | Assessment |
|--------|-----------|
| **Desktop Platforms** | Windows, macOS, Linux |
| **Mobile** | Requires separate Android/iOS apps |
| **WebView** | The app IS the web content (Chromium in Electron, system WebView in Tauri) |

**Pros:** Desktop web apps are essentially the SPICE HTML5 client directly  
**Cons:** Still need separate mobile apps, Electron is heavy (contradicts "lightweight" requirement for thin clients)

##### B4: .NET MAUI + Blazor Hybrid

| Aspect | Assessment |
|--------|-----------|
| **Supported Platforms** | Android, iOS, macOS, Windows (no Linux) |
| **WebView Support** | BlazorWebView built-in |
| **Maturity** | Decent but smaller ecosystem than Flutter |

**Pros:** WebView is first-class, good Windows support  
**Cons:** No Linux support, smaller community, Microsoft-centric

---

### Recommendation: Flutter + WebView (Option B1)

**Why Flutter is the cleanest path:**

1. **Coverage** — All 6 target platforms from one codebase (Android, iOS, macOS, Windows, Linux, Web)
2. **WebView maturity** — `flutter_inappwebview` supports JS injection, custom user agents, interceptors, cookie management — everything the current app needs
3. **Incremental migration** — The existing JavaScript (touchToMouseScript.js, disableSelectionScript.js) transfers directly; only the Java wrapper logic needs porting to Dart
4. **Native escape hatches** — Platform channels allow per-platform native code for USB, biometrics, printing when needed
5. **Desktop mode** — Flutter handles multi-window/multi-display natively on desktop targets
6. **Thin client friendly** — Flutter apps compile to native AOT code (no browser overhead like Electron)
7. **CI/CD** — Single pipeline can build for all platforms via GitHub Actions or GitLab CI

### Migration Path

```
Phase 1: Flutter Foundation
├── Port overlay UI to Flutter widgets
├── Integrate flutter_inappwebview
├── Migrate JS injection (touchToMouseScript, disableSelectionScript)
├── Implement settings with SharedPreferences equivalent
└── Target: Android + iOS functional parity

Phase 2: Desktop Expansion
├── Enable macOS, Windows, Linux targets
├── Adapt touch-to-mouse for trackpad/mouse input on desktop
├── Implement keyboard pass-through (physical keyboards)
├── External display support via Flutter desktop windowing
└── Target: All desktop platforms with basic functionality

Phase 3: Advanced Channels
├── Clipboard sync (platform channels per OS)
├── File transfer UI and backend
├── Audio channel (platform-specific audio APIs)
├── Printing integration
└── Target: Feature completeness per project requirements

Phase 4: Optimization & QoE
├── Performance metrics overlay
├── Configurable codec/quality/bandwidth
├── Biometric authentication integration
├── USB redirection (where platform allows)
└── Target: Production-grade across all platforms
```

---

## 6. WebView Considerations (from Project Document)

The project document raises important concerns about WebView:

| Concern | Mitigation in Flutter |
|---------|----------------------|
| "Additional layer between hardware and user" | Flutter compiles to native code; WebView is only for SPICE rendering, not app UI |
| "Heavy influence on buffering/decoding delay" | Can configure WebView hardware acceleration, media codec preferences |
| "Less control over special keyboards" | Flutter intercepts keyboard events at the framework level before WebView |
| "Browser is a software monster for thin clients" | Flutter + WebView is significantly lighter than a full browser |
| "SPICE web code rewrite planned" | WebView approach benefits from the rewrite automatically |

### Alternative: Native SPICE Rendering (Without WebView)

If latency measurements show WebView adds unacceptable overhead (>50ms round-trip), a native rendering approach eliminates the browser layer entirely. This section evaluates the options.

#### What WebView Currently Does for Free

Without WebView, the app must handle everything the SPICE HTML5 client provides:
1. SPICE protocol negotiation (TLS, authentication, channel setup)
2. H264 video stream decoding
3. Frame rendering to a native surface
4. Input encoding (keyboard scancodes, mouse events → SPICE protocol messages)
5. Additional channels (audio, clipboard, USB, file transfer)

#### Option N1: FFI Binding to libspice-client (Most Practical)

```
Flutter/Dart App
    │
    ├── Dart FFI ──► libspice-client-glib (C library, already exists)
    │                    ├── Protocol handling
    │                    ├── Channel management
    │                    └── Video stream output (raw frames)
    │
    ├── Hardware decoder (platform-specific)
    │       Android: MediaCodec
    │       iOS: VideoToolbox
    │       Desktop: FFmpeg / platform decoder
    │
    └── Flutter Texture widget ◄── decoded frames rendered here
```

- `libspice-client` is the same C library powering `virt-viewer` and `remote-viewer` on Linux
- Cross-compile for Android (NDK), iOS, macOS, Windows, Linux
- Dart FFI or platform channels call into the library
- Decoded H264 frames rendered to a Flutter `Texture` widget (zero-copy GPU path)
- Input sent back through FFI as SPICE protocol messages

**Effort:** High (~3-6 months for a team). Cross-compiling libspice-client + its dependencies (GLib, GStreamer, OpenSSL, pixman) for each platform is the hardest part.

**Pros:** Proven protocol implementation, all SPICE channels available, native latency  
**Cons:** Complex dependency tree, GLib event loop integration, mobile cross-compilation challenging

#### Option N2: Rust-Based SPICE Client + Flutter Rendering

```
Flutter/Dart App
    │
    └── Dart FFI ──► Rust library (new implementation)
                         ├── SPICE protocol (partial or full)
                         ├── H264 decoding via platform APIs
                         └── Frame buffer output
```

- Write a SPICE protocol library in Rust (portable, memory-safe, no GLib dependency)
- Rust's cross-compilation story is excellent for all target platforms
- Only implement needed channels incrementally (video + input first, audio/clipboard later)
- Render via Flutter Texture or native surface

**Effort:** Very high (~6-12 months). Reimplementing protocol logic from scratch, but the result is clean, dependency-free, and compiles everywhere.

**Pros:** Minimal dependencies, excellent cross-compilation, memory safety, full control  
**Cons:** Enormous upfront investment, must track SPICE protocol changes

#### Option N3: GStreamer Pipeline (Middle Ground)

```
Native App (Flutter or platform-specific)
    │
    └── GStreamer pipeline
            ├── spicesrc (SPICE protocol source element)
            ├── h264parse → avdec_h264 / hardware decoder
            └── video sink → native surface / Flutter Texture
```

- GStreamer already has a `spice` source element
- Handles protocol + decoding + rendering in one declarative pipeline
- Cross-platform (Android, iOS, macOS, Windows, Linux)
- Can use hardware decoders via platform-specific GStreamer plugins

**Effort:** Medium-High (~2-4 months). GStreamer is mature but heavy; packaging it for mobile adds ~50MB to app size.

**Pros:** Mature pipeline framework, hardware acceleration, handles audio too  
**Cons:** Large binary size, complex packaging on mobile, GStreamer mobile support less mature

#### Native Approach Comparison

| Approach | Platforms | Added Latency | Code Complexity | Binary Size | Dependencies |
|----------|-----------|---------------|-----------------|-------------|--------------|
| **WebView (current)** | All | +30-80ms | Low (~1500 LOC) | Minimal | None |
| **FFI to libspice-client** | All (hard on iOS) | ~0ms | High (~5000+ LOC) | +10-20MB | GLib, GStreamer, OpenSSL |
| **Rust SPICE client** | All | ~0ms | Very High (new impl) | +5-10MB | Minimal |
| **GStreamer pipeline** | All (hard on iOS) | ~5ms | Medium (~3000 LOC) | +50MB | GStreamer |

#### Recommended Strategy: Hybrid Approach

Rather than choosing purely WebView or purely native, a **hybrid** offers the best tradeoff:

```
┌─────────────────────────────────────────────────────────┐
│  Flutter App                                             │
│                                                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  OSVDI Gateway UI   │  │  SPICE Session Rendering │  │
│  │  (WebView)          │  │  (Native via FFI)        │  │
│  │                     │  │                          │  │
│  │  - Login/auth flow  │  │  - H264 decode           │  │
│  │  - VM selection     │  │  - Frame rendering       │  │
│  │  - Settings pages   │  │  - Input handling        │  │
│  │  - Gateway UI       │  │  - Audio/clipboard       │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│                                                          │
│  Decision point: URL contains "spice+tls://" ?           │
│  ├── No  → WebView (complex web UI, no latency need)    │
│  └── Yes → Switch to native renderer (low latency)      │
└─────────────────────────────────────────────────────────┘
```

- **WebView** for the OSVDI gateway (login, VM selection, settings) — complex web UI that would be expensive to reimplement natively
- **Native renderer** for the actual SPICE desktop session — where latency matters most
- Decision point: when a `spice+tls://` URL is detected, hand off to the native pipeline
- This matches the current architecture's URL detection logic (both Android and iOS already detect SPICE URLs)

#### When to Invest in Native

| Trigger | Action |
|---------|--------|
| WebView round-trip measured at >100ms | Begin FFI binding to libspice-client |
| Thin client hardware can't run WebView smoothly | Native renderer for those targets |
| USB/printing channels required | Must go native (WebView can't access these) |
| SPICE HTML5 rewrite produces stable API | Reduces urgency for native (new web client may be faster) |
| Gaming/real-time use case prioritized | Native renderer mandatory |

#### Practical Recommendation

1. **Start with Flutter + WebView** (works today, covers all platforms, ~2 weeks to parity)
2. **Measure actual latency** on target hardware with SPICE full-video stream
3. **If latency is acceptable** (<80ms round-trip for office/coding use): stay with WebView, invest in channels (audio, clipboard, file transfer)
4. **If latency is unacceptable**: invest in Option N1 (FFI to libspice-client) for desktop thin clients first, then mobile
5. **Keep WebView** for the gateway/login flow regardless — it's complex web UI that tracks upstream changes automatically

---

## 7. Comparison with Existing Solutions

### OSVDI Access Variants (Internal)

| Variant | Platform | Rendering | Channels | Status |
|---------|----------|-----------|----------|--------|
| **remote-viewer (patched)** | Linux (Debian) | Native (libspice-gtk) | Full (video, audio, USB, clipboard, printing) | Production — ground truth |
| **SPICE HTML5 in browser** | Any desktop browser | Browser canvas | Video only (patched H264), limited input | Working — rewrite in progress |
| **SPICEViewerAndroid** | Android | WebView (Chromium) | Video + touch/keyboard bridge | Working — this project |
| **spicemobile-ios** | iOS (iPhone/iPad) | WebView (WKWebView) | Video + touch/keyboard bridge | Working — this project |

### External Solutions (Evaluation Baselines)

| Solution | Platforms | Protocol | Open Source | Native? |
|----------|-----------|----------|-------------|---------|
| aSPICE / freeaSPICE | Android, iOS | SPICE (native, libspice-gtk) | Yes | Yes |
| FreeRDP | Windows, Linux, macOS, Android, iOS | RDP | Yes | Yes |
| Microsoft RD Client | Android, iOS, Windows, macOS | RDP | No | Yes |
| Apache Guacamole | Web (any browser) | RDP, VNC, SSH | Yes | No (browser) |
| Remmina | Linux | RDP, VNC, SPICE | Yes | Yes |
| Citrix Workspace | Android, iOS, Windows, macOS, Linux | ICA/HDX | No | Yes |

### Evaluation Matrix

The following matrix should be populated through testing. The **native client** and **FreeRDP** serve as the ground truth baselines.

| Test | Native (remote-viewer) | WebView Android | WebView iOS | Browser (desktop) | FreeRDP (RDP baseline) |
|------|----------------------|-----------------|-------------|-------------------|----------------------|
| Round-trip latency (typing) | TBD | TBD | TBD | TBD | TBD |
| Round-trip latency (mouse) | TBD | TBD | TBD | TBD | TBD |
| H264 decode time | TBD | TBD | TBD | TBD | N/A (RDP codec) |
| BabylonJS train demo FPS | TBD | TBD | TBD | TBD | TBD |
| Modifier keys (Ctrl, Alt, Fn, Esc) | TBD | TBD | TBD | TBD | TBD |
| Audio (bidirectional) | Supported | Not implemented | Not implemented | Not implemented | TBD |
| Clipboard | Supported | Not implemented | Not implemented | Not implemented | TBD |
| USB redirection | Supported | Not possible (WebView) | Not possible (WebView) | Not possible (browser) | TBD |
| File transfer | Supported | Not implemented | Not implemented | Not implemented | TBD |
| Printing | Supported | Not implemented | Not implemented | Not implemented | TBD |
| Multi-monitor | TBD | Not implemented | Not implemented | TBD | TBD |

### Key Observations

- **The native client already supports all channels** (audio, USB, clipboard, printing, file transfer). The WebView wrappers inherit only what the HTML5 client exposes — currently just video and basic input.
- **aSPICE/freeaSPICE in the app stores** are native SPICE clients for mobile. They should be evaluated alongside the WebView wrappers to understand what native mobile SPICE looks like today.
- **FreeRDP** provides the ground truth for what a mature, cross-platform remote desktop client feels like. Key comparison point for UX and latency expectations.

### Code Reuse Opportunity (WebView Wrappers)

The JavaScript bridges (touchToMouseScript.js + disableSelectionScript.js) are already **shared logic** between Android and iOS — ~480 LOC that's nearly identical but has drifted slightly. The remaining platform-specific code:
- Android: ~850 LOC Java (WebView config, keyboard bridge, overlay UI)
- iOS: ~1340 LOC Swift (WebView config, keyboard bridge, overlay UI, SwiftUI views)

Total: **~2190 LOC** doing the same thing in two languages.

---

## 8. Evaluation Plan (Priority 1)

The first milestone is a **comprehensive evaluation** of all access variants, concluded with a presentation including practical demonstrations. Architecture and framework decisions come after this evaluation, informed by measured data — not assumptions.

### Phase 1: Establish Ground Truth

1. **Set up native client** — Get `remote-viewer` (patched) running, have Sebastian demonstrate the Linux/Debian version
2. **Set up FreeRDP baseline** — Run FreeRDP clients against a Windows RDP service (with remote access enabled)
3. **Test Guacamole** — Evaluate the bwLehrpool remote (`bwlehrpool.ruf.uni-freiburg.de/guacamole`) as a browser-only VNC/RDP baseline
4. **Document what "good" looks like** — Record latency, visual quality, and channel support for the native and RDP baselines

### Phase 2: Evaluate WebView Wrappers (These Apps)

5. **Test Android WebView app** — Run SPICEViewerAndroid on device and emulator, document behavior differences vs iOS
6. **Test iOS WebView app** — Already partially done; document remaining issues
7. **Test desktop browser** — Load OSVDI in Chrome, Firefox, Safari on Windows/macOS/Linux
8. **Keyboard mapping audit** — Systematically test all modifier keys (Ctrl, Alt, AltGr, Fn, Esc, function keys) across all variants and document which work/fail
9. **Run benchmarks** — BabylonJS train demo (`babylonjs.com/Demos/Train/`), installed VM benchmarks; record FPS and visual quality

### Phase 3: Measure and Compare

10. **Round-trip latency** — Measure input-to-display delay for each variant (typing, mouse movement, click response)
11. **Video decode performance** — Compare H264 decode time: native (hardware) vs WebView vs browser
12. **Channel completeness** — Fill in the evaluation matrix (Section 7) for each variant
13. **UX assessment** — Login flow, VM selection, multi-factor auth, credential storage, mobile app configuration

### Phase 4: Identify Improvements

14. **Catalog what's missing** per variant (from the evaluation matrix)
15. **Catalog UX issues** — Quirks, unclear guidance, annoyances in interaction
16. **Propose improvement roadmap** — Informed by measured data, not assumptions
17. **Prepare presentation** with practical demonstrations on various clients

### For Cross-Platform Decision (After Evaluation)

Architecture decisions should wait until evaluation data exists. Key questions that need measured answers:

| Question | How to answer |
|----------|---------------|
| Does WebView add unacceptable latency? | Compare round-trip: native vs WebView vs browser |
| Can the browser handle special keys reliably? | Keyboard mapping audit across platforms |
| Is the SPICE HTML5 rewrite fast enough? | Test when available (colleague's timeline) |
| Can WebView apps match native channel support? | Document which channels are even possible via WebView |
| Is a cross-platform framework worth the migration cost? | Compare maintenance cost of 2 repos vs 1, factoring in desktop needs |

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebView latency unacceptable for interactive use | Unknown (must measure) | High | Benchmark against native client; have FFI fallback plan |
| SPICE HTML5 rewrite breaks injected JS bridges | High | Medium | Coordinate with colleague on API stability; design bridges against stable interfaces |
| Jumping to architecture decisions before evaluation | Medium | High | Complete the evaluation matrix (Section 7) before proposing framework changes |
| USB/printing/security channels impossible via WebView | High | Medium | Document as limitation; these require native code regardless of framework |
| Platform-specific keyboard/modifier key behavior | High | Medium | Systematic testing matrix; document per-platform results |
| AI-generated analysis doesn't match low-level reality | Medium | Medium | Validate all claims against native client behavior; consult with project colleagues |

---

## 10. Summary

### Current State

The OSVDI project has **three access variants** for SPICE remote desktops:

1. **Native client** (`remote-viewer`, patched) — the ground truth. Full channel support, native performance, currently Linux/desktop only.
2. **WebView wrapper apps** (this project) — Android and iOS mobile apps wrapping the SPICE HTML5 client. Functional for video + basic input. Missing all advanced channels (audio, clipboard, USB, file transfer, printing).
3. **Browser client** — SPICE HTML5 running directly in desktop browsers. Actively being rewritten by a colleague.

The two WebView wrapper apps exist as **separate codebases** (Java + Swift) with shared JavaScript bridges (~480 LOC). Feature parity is inconsistent — Android leads in i18n and CI/CD; iOS leads in haptics, pinch-to-zoom, and auth handling.

### What Must Happen First

**Evaluate before architecting.** The first milestone is a comprehensive comparison of all access variants:
- Measure round-trip latency across native, WebView, and browser clients
- Document keyboard/modifier key behavior per variant
- Run standardized benchmarks (BabylonJS train demo, VM benchmarks)
- Catalog channel completeness per variant
- Compare against FreeRDP and Guacamole baselines

This evaluation will reveal whether WebView's overhead is acceptable, which channels are feasible without native code, and where the real bottlenecks are.

### Architecture Decisions Pending Evaluation

| If evaluation shows... | Then consider... |
|------------------------|------------------|
| WebView latency is acceptable (<80ms round-trip) | Unify mobile apps via cross-platform framework (Flutter, Tauri, Capacitor); invest in channel support |
| WebView latency is unacceptable | Invest in native rendering (FFI to libspice-gtk, or GStreamer pipeline) |
| SPICE HTML5 rewrite is fast and feature-complete | WebView approach becomes more viable; less urgency for native |
| Keyboard/modifier handling is broken in browsers | Must intercept at native level regardless of rendering approach |
| Advanced channels (USB, printing) are required on mobile | Must go native for those channels — WebView cannot access them |

### Key Insight

The WebView approach keeps the codebase minimal and inherits upstream SPICE HTML5 improvements automatically. But it introduces a **browser layer** between the hardware and the user that affects decoding latency, codec availability, input handling, and channel support. Whether this tradeoff is acceptable depends on **measured data** — which the evaluation phase will provide.

The native client (`remote-viewer`) already works and supports everything. The question is how much of that experience can be replicated in the WebView wrappers and browsers, and where native code becomes unavoidable.
