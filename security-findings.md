# OSVDI Remote Access — Security Findings

**Date:** 2026-05-28
**Scope:** Security audit of osvdi (backend), osvdi-fe (frontend), and spice-html5 (web client)
**Methodology:** Three-phase analysis (context research, comparative analysis, vulnerability assessment) with confidence >= 8/10 threshold
**Author:** Bishwajeet Parhi

---

## Executive Summary

**32 vulnerabilities** found across the three core OSVDI repositories: 16 HIGH, 16 MEDIUM.

| Component | HIGH | MEDIUM | Total |
|-----------|:----:|:------:|:-----:|
| osvdi (backend) | 6 | 6 | 12 |
| osvdi-fe (frontend) | 5 | 5 | 10 |
| spice-html5 (web client) | 5 | 5 | 10 |

### Most Critical Chains

1. **Backend auth bypass (one-shot):** Calling `/system/config` permanently sets the singleton API key to `"******"`. After that, anyone sending `Authorization: Bearer ******` gets InternalService access.

2. **Frontend account takeover:** `dangerouslySetInnerHTML` on API data (XSS) + Keycloak tokens in localStorage = steal any user's refresh token.

3. **spice-html5 credential theft:** XSS via `innerHTML` in `display_hostname()` + password stored on `window.spice_connection.password` = steal SPICE VM access.

---

## Part 1: osvdi Backend (C# ASP.NET Core 10)

### B1: Auth Bypass via Singleton Mutation — `System.cs:92-98`

* **Severity:** HIGH | **Confidence:** 10/10
* The `GetConfig` admin endpoint mutates the singleton `IOptions<OSVDIConfig>` directly: `config.Auth.ApiKey = "******"`. Since it's a singleton, this permanently changes the API key in memory. After one admin call, `ApiKeyAuthHandler` compares against `"******"` — meaning anyone sending `Authorization: Bearer ******` gets InternalService access.
* **Fix:** Never mutate the singleton. Create a DTO copy for the response.

### B2: Schedule-Task Accessible to All Users — `System.cs:30,100-111`

* **Severity:** HIGH | **Confidence:** 10/10
* `/system/schedule-task` has no admin-only policy. Any authenticated user can schedule tasks with arbitrary names. Task names collide with the `DeleteVmAt-{guid}` pattern used for VM lifecycle, enabling interference with other users' scheduled deletions.
* **Fix:** Add `.RequireAuthorization("Admin")`.

### B3: Unrestricted Flavor Creation with Arbitrary XML — `Flavors.cs:27-31`

* **Severity:** HIGH | **Confidence:** 9/10
* Any authenticated user can create flavors with arbitrary libvirt XML blobs. Combined with unrestricted template creation, a user can create VMs with excessive resources or unauthorized PCI passthrough.
* **Fix:** Restrict `CreateFlavor` to admin-only.

### B4: Auth Middleware After Endpoint Mapping — `Program.cs:146-149`

* **Severity:** HIGH | **Confidence:** 10/10
* `UseAuthentication()` and `UseAuthorization()` are called after `MapEndpoints()`. While minimal API endpoint filters partially mitigate this, any middleware added between them would operate on unauthenticated context.
* **Fix:** Move auth middleware before `MapEndpoints()`.

### B5: GetConfig Exposes Secrets — `System.cs:92-98`

* **Severity:** HIGH | **Confidence:** 9/10
* The config endpoint returns `LibVirtConfig` objects containing `RBDSecret` (Ceph auth), `SshHostKey`, and `RBDUsername` unmasked to any admin user.
* **Fix:** Mask all credential fields. Use a response DTO, not the live config object.

### B6: SNI Path Traversal in Proxy — `proxy/osvdi.js:8,26`

* **Severity:** HIGH | **Confidence:** 9/10
* The nginx NJS proxy extracts desktop ID from TLS SNI (`ssl_server_name.split(".")[0]`) and interpolates it into a backend URL with no UUID validation. An SNI like `../../api/v1/system/config.proxy.example.com` could reach unintended endpoints with the proxy's API key.
* **Fix:** Validate desktop ID matches UUID format before use.

### B7: Non-Constant-Time API Key Comparison — `ApiKeyAuthHandler.cs:37`

* **Severity:** MEDIUM | **Confidence:** 9/10
* String equality (`!=`) short-circuits on first differing character, enabling timing side-channel attacks.
* **Fix:** Use `CryptographicOperations.FixedTimeEquals()`.

### B8: Unrestricted CORS — `Program.cs:47-56`

* **Severity:** MEDIUM | **Confidence:** 10/10
* `AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()` — any website can make authenticated cross-origin API requests.
* **Fix:** Restrict to specific frontend origin(s).

### B9: Exception Messages Leaked — `CustomExceptionHandler.cs:82-95`

* **Severity:** MEDIUM | **Confidence:** 9/10
* Unhandled exceptions return `exception.Message` in the HTTP response, leaking database paths, hostnames, and internal details.
* **Fix:** Return generic error message; log full details server-side only.

### B10: TLS Verification Disabled — `proxy/osvdi.js:11,122`

* **Severity:** MEDIUM | **Confidence:** 10/10
* `verify: false` on `ngx.fetch` calls to the backend. If URLs change to HTTPS, MITM attacks become trivial.
* **Fix:** Remove `verify: false` or configure proper inter-service TLS.

### B11: Internal Visibility = Public — `Desktops.cs:97-127`

* **Severity:** MEDIUM | **Confidence:** 8/10
* Desktops with `Visibility.Internal` are visible to all authenticated users, not just organizational peers.
* **Fix:** Implement group-based filtering or rename to "Authenticated."

### B12: SSH Keys Mounted Read-Write — `compose.yaml:8-9`

* **Severity:** MEDIUM | **Confidence:** 8/10
* Host SSH keys mounted read-write into a root-running container. Container compromise = hypervisor access.
* **Fix:** Mount read-only (`:ro`), add non-root USER directive.

---

## Part 2: osvdi-fe Frontend (React 18 + Keycloak)

### F1: XSS via dangerouslySetInnerHTML — `DesktopDetailsPage.js:449`, `TemplateDetailsPage.js:404`

* **Severity:** HIGH | **Confidence:** 10/10
* Both pages iterate over all API response keys and render values through `dangerouslySetInnerHTML` with only newline-to-`<br/>` transformation. Any HTML/JS in a field (name, description) executes in the user's browser.
* **Fix:** Replace with `textContent` or React elements. Use DOMPurify if HTML is needed.

### F2: Tokens Stored in localStorage — `keycloakSlice.js:23,73`

* **Severity:** HIGH | **Confidence:** 10/10
* The entire Keycloak object (access token, refresh token, ID token) is `JSON.stringify`'d to localStorage. Accessible to any JS on the page, including XSS payloads.
* **Fix:** Use in-memory token management. For persistence, use Keycloak SSO session cookie (`check-sso`).

### F3: Route Guard Reads from Tamperable localStorage — `PrivateRoute.js:5`

* **Severity:** HIGH | **Confidence:** 9/10
* `PrivateRoute` checks `localStorage.getItem('keycloak')?.authenticated`. Any user can set this via console to access all protected routes.
* **Fix:** Read auth state from the Keycloak instance via Redux, not localStorage.

### F4: Hardcoded Fake JWT in Source — `desktopSlice.js:6`, `templateSlice.js:6`, `flavorSlice.js:5`

* **Severity:** HIGH | **Confidence:** 9/10
* A hardcoded JWT is used when `environment === "production-no-auth"`. The config is fetched from a public `config.json` at runtime — tampering enables auth bypass.
* **Fix:** Remove fake tokens from client code. Handle no-auth mode on the backend only.

### F5: Open Redirect — `HomePage.js:332,586-598`

* **Severity:** HIGH | **Confidence:** 9/10
* `window.location.replace(data.url)` and `window.location = desktopURL` use backend-provided URLs with no validation. Supports `javascript:` scheme and external URLs.
* **Fix:** Validate URLs against an allowlist of expected origins/schemes.

### F6: User Info Persisted in localStorage — `keycloakSlice.js:96`

* **Severity:** MEDIUM | **Confidence:** 9/10
* Full user profile (roles, permissions, admin status) stored in localStorage. Persists after tab close; readable on shared machines.
* **Fix:** Use `sessionStorage` or Redux only.

### F7: Broken Logout — `keycloakSlice.js:49-63`

* **Severity:** MEDIUM | **Confidence:** 9/10
* The `navigate` parameter in the logout thunk is always `undefined` (not in Redux thunk API). `localStorage.removeItem` may not execute before `kc.logout()` redirects away.
* **Fix:** Clear localStorage before calling `kc.logout()`.

### F8: Admin Check Client-Side Only — `HomePage.js:209,667`

* **Severity:** MEDIUM | **Confidence:** 8/10
* Admin features gated by `userInfo?.isAdmin` from localStorage — easily tamperable. Backend must independently enforce admin authorization.
* **Fix:** Treat frontend check as UX only; verify backend enforces roles on every admin endpoint.

### F9: Runtime Config Fetch Without Integrity — `config.js:4-6`

* **Severity:** MEDIUM | **Confidence:** 8/10
* `config.json` fetched at runtime controls API URL, Keycloak URL, realm, and environment. Cache poisoning could redirect all auth and API traffic.
* **Fix:** Add CSP, validate expected domains, or embed critical config at build time.

### F10: No Content Security Policy — `public/index.html`

* **Severity:** MEDIUM | **Confidence:** 8/10
* No CSP header or meta tag. XSS payloads have unrestricted access to exfiltrate data, load scripts, and access localStorage.
* **Fix:** Add strict CSP restricting `script-src`, `connect-src`, and `frame-ancestors`.

---

## Part 3: spice-html5 (SPICE JavaScript Client)

### S1: XSS via innerHTML in display_hostname — `spice_auto.html:249`, `spice.html:192`

* **Severity:** HIGH | **Confidence:** 10/10
* The `title` URL parameter is written to the DOM via `innerHTML` without sanitization. Trivially exploitable: `?title=<img src=x onerror=alert(1)>`.
* **Fix:** Replace `innerHTML` with `textContent`.

### S2: SPICE Password in URL — `spice_auto.html:110`

* **Severity:** HIGH | **Confidence:** 9/10
* The SPICE password is accepted as `?password=...` URL query parameter, exposed in browser history, proxy logs, and Referer headers.
* **Fix:** Accept via POST body or prompt. If URL is required, strip with `history.replaceState()` after reading.

### S3: Token Cookie Without Secure/HttpOnly — `spice_auto.html:104-106`

* **Severity:** HIGH | **Confidence:** 9/10
* A `token` query parameter is stored as a cookie with `path=/` but no `Secure`, `HttpOnly`, or `SameSite` flags. Readable by any JS, sent over HTTP.
* **Fix:** Set `Secure; HttpOnly; SameSite=Strict`.

### S4: SSRF via WebSocket Host/Port Params — `spice_auto.html:83-123`

* **Severity:** HIGH | **Confidence:** 9/10
* `host`, `port`, and `path` URL params are used to construct a WebSocket URI with no allowlisting. Enables internal network scanning from victim's browser.
* **Fix:** Validate host against an allowlist of permitted SPICE servers.

### S5: WebSocket URI Injection from Fragment — `index.html:50-54`

* **Severity:** HIGH | **Confidence:** 9/10
* `location.hash` is transformed into a WebSocket URI via string replacement (`spice://` → `ws://`). No hostname validation. Fragment is invisible to server logs.
* **Fix:** Parse URI and validate hostname against an allowlist.

### S6: Password on Global Object — `spiceconn.js:65,73-74`

* **Severity:** MEDIUM | **Confidence:** 9/10
* SPICE password stored as `this.password` and accessible via `window.spice_connection.password`. Combined with XSS (S1), enables credential theft.
* **Fix:** Clear password after auth ticket is sent: `delete this.password`.

### S7: DoS via Server-Controlled Canvas Allocation — `display.js:506-507`, `cursor.js:131-133`

* **Severity:** MEDIUM | **Confidence:** 9/10
* Surface dimensions from server messages are used to allocate canvases with no bounds checking. A 65535x65535 surface = ~17 GB allocation attempt.
* **Fix:** Cap at reasonable maximums (e.g., 8192x8192 for surfaces, 256x256 for cursors).

### S8: Unvalidated Message Size Allocation — `spiceconn.js:231,256`

* **Severity:** MEDIUM | **Confidence:** 8/10
* `msg.size` (32-bit uint from server) passed to `wire_reader.request()` without bounds. Up to 4 GB allocation.
* **Fix:** Cap at a reasonable maximum (e.g., 32 MB).

### S9: Unvalidated Loop Counts in Deserialization — `spicemsg.js:120-128` et al.

* **Severity:** MEDIUM | **Confidence:** 8/10
* Count fields from server binary data control loop iterations without bounds. `num_common_caps = 0xFFFFFFFF` = 4 billion iterations.
* **Fix:** Validate that `count * element_size <= remaining_buffer_bytes`.

### S10: Open Redirect via history.back — `index.html:88-91`

* **Severity:** MEDIUM | **Confidence:** 8/10
* `disconnect()` calls `history.back()`. If the user arrived from an attacker-controlled page, they're sent back to it (fake "session expired" phishing).
* **Fix:** Navigate to a known safe URL instead of `history.back()`.

---

## Scope Limitations

- Findings are from **static code analysis only** — no runtime testing or penetration testing
- TLS configuration, Keycloak server hardening, and network-level security were not evaluated
- The SPICE server (C code in osvdi-spice) and native client (virt-viewer) were not audited
- Guest VM security (agent permissions, escape vectors) was not in scope
- `win32-vd_agent`, `spice-gtk`, and `spice-protocol` were not audited
