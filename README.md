# OSVDI Remote Access Evaluation

Evaluation and comparison of remote access variants for SPICE-based clients in the Open Source Virtual Desktop Infrastructure (OSVDI) project, University of Freiburg.

## Structure

```
osvdi-evaluation/
├── report.md                    # Main evaluation report
├── evidence/                    # Screenshots and recordings
│   ├── ios/                     # iOS WebView wrapper (spicemobile-ios)
│   ├── android/                 # Android WebView wrapper (SPICEViewerAndroid)
│   ├── desktop-browser/         # SPICE HTML5 in Chrome/Firefox/Safari
│   ├── native-client/           # remote-viewer (patched) on Linux
│   ├── rdp-baseline/            # FreeRDP / Windows RDP baseline
│   └── guacamole/               # bwLehrpool Guacamole baseline
├── benchmarks/                  # Performance test results (latency, FPS, decode time)
└── keyboard-mapping/            # Keyboard/modifier key test results per variant
```

## Naming Convention for Evidence

Use descriptive names with the pattern:
```
{variant}_{test}_{detail}.png

Examples:
ios_login_oidc_flow.png
android_keyboard_ctrl_alt_missing.png
native_latency_typing_test.mp4
rdp_babylonjs_train_60fps.png
```

## Related Repositories

- [SPICEViewerAndroid](https://github.com/2002Bishwajeet/SPICEViewerAndroid) - Android WebView wrapper
- [SpiceMobile-iOS](https://github.com/2002Bishwajeet/SpiceMobile-iOS) - iOS WebView wrapper
- [OSVDI Frontend](https://gitlab.uni-freiburg.de/opensourcevdi/osvdi-fe) - OSVDI web frontend (upstream)

## Context

This evaluation is the first milestone of the project, concluding with a comprehensive presentation including practical demonstrations on various clients. See [report.md](report.md) for the full analysis.
