# OSVDI Remote Access Evaluation

Evaluation and comparison of remote access variants for SPICE-based clients in the Open Source Virtual Desktop Infrastructure (OSVDI) project, University of Freiburg.

## Documents

| Document | Description |
|----------|-------------|
| [report.md](report.md) | Main evaluation report — architecture, features, issues, gaps, evaluation plan |
| [accessibility-evaluation.md](accessibility-evaluation.md) | Touch UX comparison with 6 industry apps (TeamViewer, AnyDesk, RustDesk, MS RD Client, Chrome Remote Desktop, Citrix) |
| [cross-platform-strategy.md](cross-platform-strategy.md) | Cross-platform framework analysis (Flutter, KMP, Tauri, native rendering) — decisions pending evaluation |


## Naming Convention for Evidence

```
{variant}_{test}_{detail}.png

Examples:
android_scaling_cropped_viewport.png
ios_keyboard_ctrl_alt_missing.png
native_latency_typing_test.mp4
```

## Related Repositories

- [SPICEViewerAndroid](https://github.com/2002Bishwajeet/SPICEViewerAndroid) — Android WebView wrapper
- [SpiceMobile-iOS](https://github.com/2002Bishwajeet/SpiceMobile-iOS) — iOS WebView wrapper
- [OSVDI Frontend](https://gitlab.uni-freiburg.de/opensourcevdi/osvdi-fe) — OSVDI web frontend (upstream)

## Context

This evaluation is the first milestone of the project, concluding with a comprehensive presentation including practical demonstrations on various clients. Architecture decisions are deferred until after evaluation — see [report.md](report.md) Section 8.
