# OSVDI Evaluation — Deep Research Handoff

**Date:** 2026-05-28
**Session:** Deep investigation of the full OSVDI ecosystem
**Status:** In progress — agents completing analysis

---

## Repos Cloned & Analyzed

| Repo | Branch | Purpose | Status |
|------|--------|---------|--------|
| `osvdi` | main | Backend (C# ASP.NET, Docker) | Analyzed |
| `osvdi-fe` | main | Frontend (React 18, Redux) | Analyzed |
| `spice-html5` | cursor_fix | SPICE JS client (14 years old) | Deep analysis done |
| `spice-protocol` | new_video_codecs | Protocol headers (14 codecs) | Analyzed |
| `virt-viewer` | dev | Native client (GTK3, AppImage) | Agent running |
| `osvdi-spice` | encode_dmabuf_v8 | SPICE server (encoding pipeline) | Agent running |
| `spice-gtk` | queueu_remove_experiment | GTK client library | Agent running |
| `MeasurementFramework` | master | Nanosecond timing framework (C) | Analyzed |
| `latency-tester` | main | Visual latency tool (Rust + GTK) | Analyzed |
| `win32-vd_agent` | master | Windows guest agent | Analyzed |
| `spice-common` | master | Shared protocol definitions | Analyzed |
| `SPICEViewerAndroid` | master | Android WebView wrapper | Previously analyzed |

## Full OSVDI GitLab Project Inventory (18 repos)

Discovered via GitLab API:
- osvdi, osvdi-fe, osvdi-ansible
- spice, spice-gtk, spice-html5, spice-protocol, spice-common
- virt-viewer, qemu, gstreamer, linux (DRM kernel)
- MeasurementFramework, latency-tester, libva-tester
- win32-vd_agent, libvirt, gitlab-profile
- Subgroup: MobileSPICEViewer/SPICEViewerAndroid

---

## Critical Findings: spice-html5

### CRITICAL BUGS

1. **Hardcoded 1920x1080 resolution in H.264 decoder** (`display.js:1210-1212`)
   - WebCodecs VideoDecoder configured with `codedWidth: 1920, codedHeight: 1080`
   - Actual stream resolution from server (`m.stream_width`, `m.stream_height`) is IGNORED
   - **Breaks any non-1080p display**

2. **VideoDecoder never closed** (`display.js:1196-1237`)
   - New VideoDecoder created when `stream.start_time == 0` but never `.close()`d
   - Memory leak per video stream

3. **Mixed MediaSource + WebCodecs** (`display.js:1043-1237`)
   - Two video decode systems run in parallel — incomplete migration
   - Old MediaSource code still executes alongside new WebCodecs

4. **No WebSocket reconnection** (`spiceconn.js:88-129`)
   - Connection close = session lost, no retry logic
   - No keepalive/heartbeat after initial handshake

5. **File transfer is UI-only** (`filexfer.js`)
   - `file_xfer_start()` creates progress bar but NEVER actually reads/sends file data
   - Drag-drop shows 0% forever

### HIGH SEVERITY

6. **Codec hardcoded in force-webcodecs branch**
   - `avc1.640028` (H.264) forced regardless of server codec
   - VP8/VP9 support broken when WebCodecs enabled

7. **Modifier key state desync** (`inputs.js:32-286`)
   - Global Shift/Ctrl/Alt/Meta states never reset on focus loss
   - Race conditions in rapid modifier combinations

8. **No dead key / IME composition support**
   - Non-Latin input (CJK, Arabic, etc.) fundamentally broken
   - code_to_scancode.js only maps ~150 keys

9. **Audio playback Firefox hack** (`playback.js:105-131`)
   - Manually overwrites timestamps to force 10ms packet duration
   - Can cause audio desync in edge cases

10. **Unbounded image cache** (`display.js:729-734`)
    - Images with CACHE_ME flag accumulate indefinitely
    - Only evicted by server INVAL_LIST message

### MEDIUM SEVERITY

11. **Resize handling** (`resize.js`): Hardcoded 32-bit color depth, 200ms debounce arbitrary
12. **Cursor rendering**: BGRA→RGBA conversion works but simulate_cursor fallback is racy
13. **URI parsing** (`index.html:50-67`): No validation of spice:// URIs before connection
14. **Audio**: Opus-only at 48kHz/2ch, no volume/mute control, no fallback codecs
15. **No CI testing**: .gitlab-ci.yml only deploys to Pages, no tests/linting

---

## Critical Findings: OSVDI Backend

### Architecture
- 5 Docker services: ASP.NET Core 10 backend, nginx (NJS), cAdvisor, OTel scraper, LGTM stack
- nginx does SNI-based SPICE stream routing via NJS modules (`osvdi.js`)
- SPICE proxy flow: client → `{id}.proxy.example.com:443` → nginx extracts ID from SNI → queries backend API → proxies to VM SPICE port
- Full OTel tracing on SPICE connections with bandwidth monitoring every 15s

### Issues Found
- Backend sets SPICE to listen on `0.0.0.0` (all interfaces) — security concern in multi-tenant environments
- `query-spice` QMP used but response handling limited
- ProxyServerUrl validation only checks for `{id}` placeholder, no URL format validation
- SSE implementation reworked multiple times (3+ fix commits) — indicates instability

---

## Critical Findings: osvdi-fe (Frontend)

### Architecture  
- React 18 + Redux + MUI 7 + Bootstrap 5 + Keycloak 26
- Does NOT embed SPICE client — redirects browser via `window.location = desktopURL`
- SSE for real-time VM state updates (DesktopCreated, StateChanged, Deleted)
- Toggle: HTML5 SPICE vs Native SPICE URI

### Issues Found
- Keycloak instance stored in Redux state (non-serializable, `serializableCheck: false` workaround)
- SSE token passed as URL query parameter (`?access_token=...`) — security concern
- No session timeout UI — user not warned before token expiry
- No retry/backoff on SSE reconnection failures
- File transfer, clipboard — no frontend UI for these at all
- Hardcoded OS icons (TODO in code: "replace with backend call")
- Several unused components and commented-out code

---

## Critical Findings: Measurement Tools

### MeasurementFramework
- C library, nanosecond-precision timing via `clock_gettime(CLOCK_MONOTONIC)`
- Designed to embed into QEMU/SPICE server for frame-level latency measurement
- Supports parallel context-based measurements
- Outputs statistical analysis: mean, std_dev, merge windows
- Compiled with `-DENABLE_SPICE_MEASUREMENT`

### latency-tester
- Rust + GTK visual latency tool
- Two-timer approach: one on local, one on remote
- OCR-based (Tesseract) to read timer values from screenshots
- Measures full end-to-end perceived latency
- Pre-built Windows binaries available

### win32-vd_agent
- OSVDI fork of spice-vdagent for Windows guests
- Supports: clipboard, file transfer, multi-monitor, mouse, display config
- OSVDI additions: multi-GPU mouse fixes, extra button support, WebDAV clipboard

### spice-common
- Shared protocol library used by server/client/agent
- Added `SPICE_MSG_PLAYBACK_LATENCY` for audio sync feedback
- Protocol code generation from `.proto` files via Python

---

## SPICE Protocol: new_video_codecs Branch

14 codec types (up from 5):
- Standard: MJPEG, VP8, H.264, VP9, H.265, AV1
- 4:4:4 chroma: H.264_444, VP9_444, H.265_444, AV1_444
- Upsampling: H.264_U, VP9_U, H.265_U, AV1_U

Plus quality indicators, codec negotiation, GL scanout2 support.

---

## Critical Findings: SPICE Server (encode_dmabuf_v8)

### Architecture
- Zero-copy DMA-BUF GPU encoding: VM GPU → DMA-BUF fd → GStreamer → encoded stream → network
- GL_DRAW path (NEW): GPU scanout → direct encode, <1ms capture + 5-50ms encode
- Traditional QXL path: 50-150ms (rasterize + encode)
- 60 OSVDI-specific commits since Jan 2025

### Codec Support (SERVER-SIDE ENCODING)
- **H.264** — x264enc (SW), MSDK/VAAPI (HW), qp 15-35, ultrafast preset
- **VP8** — libvpx, CBR, min-qp 10, realtime deadline
- **VP9** — libvpx, CBR, realtime
- **MJPEG** — software only
- **NO H.265 / AV1 encoding** — despite protocol defining them, server has NO encoder code
- This means: protocol has 14 types, but server only encodes 4

### Performance Parameters
- Default FPS: 30, max FPS: 30
- Default bitrate: 8 Mbps, range: 128 Kbps - 20 Mbps
- Adaptive: client reports drops → server adjusts bitrate
- Frame drop: server drops frames when vbuffer exceeds limit
- Quality: 0-100 scale based on compression ratio

### DMA-BUF Details
- Multi-plane support (up to 4 planes)
- GPU selection via `SPICE_ENCODE_GPU=renderD128`
- Linux only — Windows/Mac: software encoding only
- Requires GStreamer >= 1.24 + drm_fourcc.h

### Key Issues
- FIXME: no scanout coalescing (multiple pending GL_DRAWs)
- Smartcard limited to single reader
- Intel GPU auto-detection only (no AMD/NVIDIA HW encode paths)
- Multi-plane warning but recently fixed in d973f638

---

## Critical Findings: spice-gtk (queueu_remove_experiment)

### Architecture
- ~48,000 LOC C code
- All 9 channel types fully implemented
- GStreamer-based video decoding with HW acceleration fallback

### Codec Decoding Support (CLIENT-SIDE)
- **Can decode 12 codecs**: MJPEG, VP8, H.264, VP9, H.265, AV1, plus 4:4:4 and upsampled variants
- Hardware acceleration: VAAPI (Intel/AMD), MSDK (Intel), software fallback
- Pipeline: AppSrc → Parser → HW_Decoder → VPP → Sink

### OSVDI-Specific Changes (14 commits)
1. **Removed decoding_queue** — replaced with atomic counter (performance win)
2. **Codec selection API** — `get_supported_codecs()`, `change_preferred_video_codec_types()`
3. **Wayland fixes** — mouse ungrab, event queue threading, overlay experiments
4. **MSDK plugin detection** — fixed find_best_hw_plugin not finding msdkvpp
5. **Frame metadata** — attached to GstBuffer for tracking
6. **Alignment=au** — reduces GStreamer decode buffering (lower latency)

### Channel Status
| Channel | Status |
|---------|--------|
| Display | Full (12 codecs, HW accel) |
| Inputs | Full (keyboard + mouse, PC XT scancodes) |
| Audio Playback | Full (Opus) |
| Audio Record | Full (Opus) |
| USB Redirect | Full (libusbredir + platform backends) |
| Clipboard | Full (GTK integration) |
| File Transfer | Full (WebDAV RFC 4918) |
| Smartcard | Full |
| Port | Full (QEMU monitor access) |

### Key Issues
- Multi-monitor: FIXME — only supports primary surface 0
- Adaptive quality: basic (env var control only, no UI)
- No printing channel (uses port workaround)
- Wayland support: partial, experimental overlay

---

## Key Insight: Server vs Client Codec Mismatch

| Codec | Protocol Defined | Server Encodes | spice-gtk Decodes | spice-html5 Decodes |
|-------|:----------------:|:--------------:|:-----------------:|:-------------------:|
| MJPEG | Yes | Yes | Yes | Yes (Canvas) |
| VP8 | Yes | Yes | Yes | Yes (MediaSource) |
| H.264 | Yes | Yes (HW+SW) | Yes (HW+SW) | Yes (WebCodecs, buggy) |
| VP9 | Yes | Yes | Yes | No |
| H.265 | Yes | **NO** | Yes | No |
| AV1 | Yes | **NO** | Yes | No |
| 4:4:4 variants | Yes | **NO** | Yes | No |
| Upsampled | Yes | **NO** | Yes | No |

**The protocol and client are ahead of the server.** Server only encodes 4 codecs despite protocol supporting 14. The HTML5 client only handles H.264 properly (and has critical bugs doing so).

---

## Critical Finding: HTML5 Rewrite Status

**The rewrite has NOT started.** Key facts:

- **Issue #15** in osvdi-fe: "Rewrite the HTML5 SPICE transport"
- Assigned to Rafael Gieschke (`@rg1045`)
- **Due date: May 15, 2026 — PAST DUE** (2+ weeks overdue)
- Milestone: "Minimum viable product extended (LibVirt)" → September 30, 2026
- Status: Open, no comments, no task checklist
- **No separate repo exists** — searched all 18 repos + branches
- Rafael has only done "HACK" patches on the existing 14-year-old codebase:
  - WebCodecs H.264 integration (hardcoded 1920x1080)
  - `spice://` URL parsing in index.html
  - Cursor color fix (BGRA→RGBA)
  - "Go back on disconnect" hack
- All commits prefixed "HACK:" confirming these are stopgap measures

**Impact on evaluation:** The presentation should clearly state that the HTML5 client rewrite is planned but not started, and the current client has critical bugs. This affects architectural decisions — investing in fixing the 14-year-old code vs waiting for the rewrite.

## UI/UX Slide Design Agent

The agent updated:
- `styles/index.css` — added section badges (numbered circles), accent bars, cover decorations, takeaway numbers, gradient titles, all with dark mode support
- `slides.md` — section divider slides now have numbered badges with colored circles, accent lines, and subtitles per section

## Pending Agent Results

- **UI/UX Slide Design**: May still be running (modified both CSS and slides.md)

---

## Presentation Location

`/Users/biswa/Documents/GitHub/osvdi-evaluation/presentation/slides.md`

Theme: academic (slidev-theme-academic)
Dev server: `cd presentation && pnpm dev` → localhost:3030

---

## Next Steps

1. Incorporate all agent findings into presentation
2. Verify claims against actual code (several "working" features may be broken)
3. Add slides for measurement methodology
4. Add slides for SPICE server encoding pipeline
5. Update pain points / gap analysis with verified findings
6. Run overflow check again after updates
7. Potentially add demo setup instructions
