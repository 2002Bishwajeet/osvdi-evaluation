# Cross-Platform Strategy Analysis

**Status:** Pending — decisions deferred until evaluation data exists (see [report.md](report.md) Section 8)

---

## The Core Question

The project currently has **two separate native codebases** (Android + iOS) that implement the same WebView-based approach with nearly identical JavaScript bridges. The project requirements specify support for:
- **Desktop:** Windows, Linux (Wayland/Xorg), macOS (x86, ARM64)
- **Mobile:** Android, iOS (both exist today)
- **Further:** Smart TVs

The question is not just "how to add more platforms" but also **"should the two existing mobile codebases be unified?"**

---

## Current Pain Points (Two Separate Repos)

| Issue | Impact |
|-------|--------|
| JS bridges have drifted (minor differences in touchToMouseScript.js) | Bug fixes must be applied twice |
| Feature parity gaps (Android has i18n, iOS has haptics + pinch zoom) | Users get inconsistent experience |
| No shared test suite | Regressions caught independently |
| Different licenses (Apache 2.0 vs GPLv2) | Legal ambiguity for shared code |
| Adding a 3rd platform (macOS/Windows/Linux) means a 3rd codebase | Unsustainable |

---

## Option Analysis

### Option A: WebView on Each Platform (Current Approach Extended)

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

### Option B: Cross-Platform Framework with WebView

Use a single cross-platform framework that provides a WebView component, sharing the bridge logic.

#### B1: Flutter + WebView Plugin

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
- Additional abstraction layer between hardware and user
- Flutter WebView on Linux uses WebKitGTK (less mature than Chromium)

#### B2: Kotlin Multiplatform (KMP) + Compose Multiplatform

| Aspect | Assessment |
|--------|-----------|
| **Supported Platforms** | Android, iOS, Desktop (JVM), Web (experimental) |
| **WebView Support** | Limited — no official multiplatform WebView component |
| **Native API Access** | Excellent via expect/actual pattern |
| **Maturity** | Android excellent, iOS/Desktop improving, Web experimental |

**Pros:** Shares logic in Kotlin, Android expertise transfers directly  
**Cons:** No unified WebView component across platforms, desktop support less mature than Flutter

---

## Conditional Recommendation: Flutter + WebView (Option B1)

> This recommendation is **conditional on evaluation results**. If evaluation shows WebView latency is unacceptable, architecture decisions must be revisited.

**Why Flutter is the cleanest path (if WebView approach is validated):**

1. **Coverage** — All 6 target platforms from one codebase
2. **WebView maturity** — `flutter_inappwebview` supports JS injection, cookie management, interceptors
3. **Incremental migration** — Existing JS bridges transfer directly; only the wrapper logic needs porting
4. **Native escape hatches** — Platform channels for USB, biometrics, printing
5. **Desktop mode** — Flutter handles multi-window/multi-display natively
6. **Thin client friendly** — Compiles to native AOT code (no browser overhead like Electron)
7. **CI/CD** — Single pipeline can build for all platforms

### Migration Path (If Approved Post-Evaluation)

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

## Native SPICE Rendering (Without WebView)

If latency measurements show WebView adds unacceptable overhead, a native rendering approach eliminates the browser layer entirely.

### What WebView Currently Does for Free

Without WebView, the app must handle everything the SPICE HTML5 client provides:
1. SPICE protocol negotiation (TLS, authentication, channel setup)
2. H264 video stream decoding
3. Frame rendering to a native surface
4. Input encoding (keyboard scancodes, mouse events → SPICE protocol messages)
5. Additional channels (audio, clipboard, USB, file transfer)

### Option N1: FFI Binding to libspice-client

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

**Effort:** High (~3-6 months). Cross-compiling libspice-client + dependencies (GLib, GStreamer, OpenSSL, pixman) for each platform.  
**Pros:** Proven protocol implementation, all channels, native latency  
**Cons:** Complex dependency tree, GLib event loop integration, mobile cross-compilation challenging

### Option N2: Rust-Based SPICE Client

**Effort:** Very high (~6-12 months). Clean, dependency-free, compiles everywhere.  
**Pros:** Minimal dependencies, excellent cross-compilation, memory safety  
**Cons:** Enormous upfront investment, must track SPICE protocol changes

### Option N3: GStreamer Pipeline

**Effort:** Medium-High (~2-4 months). Mature but heavy; ~50MB added to app size.  
**Pros:** Mature framework, hardware acceleration, handles audio  
**Cons:** Large binary size, complex mobile packaging

### Native Approach Comparison

| Approach | Platforms | Added Latency | Code Complexity | Binary Size | Dependencies |
|----------|-----------|---------------|-----------------|-------------|--------------|
| **WebView (current)** | All | +30-80ms | Low (~1500 LOC) | Minimal | None |
| **FFI to libspice-client** | All (hard on iOS) | ~0ms | High (~5000+ LOC) | +10-20MB | GLib, GStreamer, OpenSSL |
| **Rust SPICE client** | All | ~0ms | Very High (new impl) | +5-10MB | Minimal |
| **GStreamer pipeline** | All (hard on iOS) | ~5ms | Medium (~3000 LOC) | +50MB | GStreamer |

### Recommended Strategy: Hybrid Approach

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

### When to Invest in Native

| Trigger | Action |
|---------|--------|
| WebView round-trip >100ms | Begin FFI binding to libspice-client |
| Thin client hardware can't run WebView smoothly | Native renderer for those targets |
| USB/printing channels required | Must go native (WebView can't access) |
| SPICE HTML5 rewrite produces stable API | Reduces urgency for native |
| Gaming/real-time use case prioritized | Native renderer mandatory |
