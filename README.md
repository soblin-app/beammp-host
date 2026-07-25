# BeamMP Host — Real Desktop App (Tauri)

**This is now a real desktop application.** When built with Tauri, it spawns the actual `BeamMP-Server.exe` and `playit-agent.exe` binaries as real child processes, tails their real stdout, parses the real playit claim URL, and exposes a real public address that your friends can join from BeamNG.drive.

The same UI runs in two modes:

| Mode | When | Backend |
|---|---|---|
| **Tauri desktop** (production) | Built with `bun run tauri:build` | Real Rust backend spawning real binaries |
| **Browser preview** (dev only) | `bun run dev` | Mock implementations for UI exploration |

The app auto-detects which mode it's in via `bridge.isTauri()` and routes calls accordingly. The "Prototype notice" banner on the claim URL only appears in browser mode — in Tauri mode the URL is real.

---

## What you need (Windows prerequisites)

Install these on your Windows PC **before** building. All are free.

### 1. Rust toolchain
Install from https://rustup.rs/ — run the installer, choose default options. This gives you `cargo` and `rustc`.

Verify:
```powershell
cargo --version
```

### 2. Microsoft Visual C++ Build Tools
Tauri needs the MSVC compiler. Install "Build Tools for Visual Studio 2022" from https://visualstudio.microsoft.com/visual-cpp-build-tools/. In the installer, check **"Desktop development with C++"**.

### 3. WebView2 (preinstalled on Windows 10/11)
If you're on a fresh Windows install, get the Evergreen Runtime from https://developer.microsoft.com/microsoft-edge/webview2/. Windows 11 has it by default.

### 4. Node.js 18+ and Bun
- Node.js: https://nodejs.org/ (LTS)
- Bun: `irm bun.sh/install.ps1 | iex` in PowerShell

Verify:
```powershell
node --version
bun --version
```

### 5. External accounts (the app cannot create these)
- **BeamMP AuthKey** — sign in at https://keymaster.beammp.com/ with Discord, click "Generate Key". You'll paste this into the app's Config tab.
- **playit.gg account** — sign up free at https://playit.gg/. You'll authorize the agent via the claim URL flow on first run.

---

## Build the app

### Option A: Download this project and build locally

1. **Download** the project (zip from this sandbox's `download/` folder, or clone if you've pushed it to your own git repo).

2. **Unzip** and open a PowerShell terminal in the project root.

3. **Install JS dependencies:**
   ```powershell
   bun install
   ```

4. **Build the Tauri desktop app:**
   ```powershell
   bun run tauri:build
   ```
   This will:
   - Build the Next.js frontend to a static export (`out/`)
   - Compile the Rust backend in `src-tauri/` (first build takes ~5 minutes — Rust compiles slowly the first time)
   - Bundle everything into Windows installers

5. **Find the installer:**
   The build outputs to `src-tauri/target/release/bundle/`:
   - `msi/BeamMP Host_0.1.0_x64_en-US.msi` — Windows MSI installer
   - `nsis/BeamMP Host_0.1.0_x64-setup.exe` — NSIS installer

   Double-click either to install. The app will appear in your Start menu as "BeamMP Host".

### Option B: Run in dev mode (faster iteration, no installer)

```powershell
bun run tauri:dev
```

This opens the app window immediately with hot-reload. Useful while you're tweaking settings.

---

## First run setup

When you launch BeamMP Host for the first time:

1. **Setup Wizard** opens automatically. Walk through:
   - **Install BeamMP-Server** — click Download. The app fetches the latest release from https://github.com/BeamMP/BeamMP-Server/releases and saves `BeamMP-Server.exe` to your install dir (default `C:\Users\<you>\BeamMP-Server\`).
   - **AuthKey** — click "Open keymaster.beammp.com", sign in with Discord, generate a key, paste it into the wizard.
   - **Server Config** — name your server, pick a map, set max players.
   - **Install playit** — click Download. The app fetches `playit.exe` from https://github.com/playit-cloud/playit-agent/releases.
   - **Claim Agent** — click "Start the playit agent". A **real** claim URL appears (printed by the actual `playit-agent` binary). Click "Open in browser", sign in to playit.gg, approve the new agent. Then click "I've authorized — continue".
   - **Create Tunnel** — the agent auto-provisions a TCP+UDP tunnel. You'll see a real public address like `abiding-otter-auto.ply.gg:12345`.
   - **Done** — click "Start my server".

2. **If BeamMP-Server doesn't appear in the server list within 60 seconds:**
   - Check the **Server** tab → Live Console for errors
   - Common cause: Windows Firewall is blocking `BeamMP-Server.exe`. Click "Allow access" if a firewall prompt appeared, or add an inbound rule for port 30814 (TCP+UDP).
   - Verify your AuthKey is valid — if BeamMP revokes it, the server won't register with the master server. Generate a new one at keymaster.beammp.com.

3. **Share your public address** with friends (Join Info tab → Copy for Discord):
   ```
   Join my BeamMP server: My BeamMP Server — abiding-otter-auto.ply.gg:12345 (Direct Connect in BeamNG)
   ```

4. **Players join:** open BeamNG.drive (with BeamMP launcher installed) → Multiplayer → Direct Connect → paste the address → Connect.

---

## How the real backend works

The Rust backend in `src-tauri/src/` does the actual work:

| File | Responsibility |
|---|---|
| `lib.rs` | App entry, plugin registration, system tray, IPC command registration |
| `beammp.rs` | Spawns `BeamMP-Server.exe` with stdin/stdout pipes, tails stdout to the frontend via Tauri events, supervises lifecycle (auto-restart on crash with backoff) |
| `playit.rs` | Spawns `playit.exe`, regex-parses the claim URL from stdout (`https://playit.gg/claim/...`), polls the agent's local HTTP API at `http://127.0.0.1:53200/tunnels` for tunnel info |
| `config.rs` | Reads/writes `ServerConfig.toml` and `settings.json` to the user's `%APPDATA%\BeamMPHost\` directory |
| `github.rs` | Fetches latest release tags from GitHub API, downloads the OS-appropriate asset to disk |

The frontend (`src/lib/beammp/tauri-bridge.ts`) calls these via `@tauri-apps/api/core`'s `invoke()` and listens for events via `@tauri-apps/api/event`'s `listen()`.

---

## Troubleshooting

### "BeamMP-Server not found at ... and not on PATH"
Click **Settings → Install BeamMP-Server**, or set the install directory in Settings to wherever you've manually placed `BeamMP-Server.exe`.

### "playit-agent not found"
Same — **Settings → Install playit-agent**, or point the install dir at your existing `playit.exe` location.

### The claim URL shows "Invalid claim code" on playit.gg
This should NOT happen in the Tauri build (only in browser preview mode). If it does:
- Make sure you're running the actual Tauri app, not the browser preview
- Check the **Server** tab → Live Console for `[AGENT]` errors from the real playit binary
- The claim URL is time-sensitive — if you wait too long (>5 min) it expires. Restart the agent from the Tunnel tab to get a fresh URL.

### The server is running but doesn't show up in BeamMP's server list
Check the **Server** tab console for these specific log lines:
- `Successfully registered with master server. Server is publicly listed.` → all good
- `AuthKey invalid` or `AuthKey rejected` → your key is bad/revoked. Generate a new one.
- `Failed to bind socket on 0.0.0.0:30814` → another process is using port 30814. Change the Port in Config, or stop the conflicting process.
- No registration attempt logged → Windows Firewall is blocking outbound traffic. Allow `BeamMP-Server.exe`.

If your server is **Private** (the default), it won't show in the public list — players must Direct Connect using the public address. Toggle Private OFF in Config to make it appear in the public list.

### Players can't connect even though the server is running
90% of the time this is a port mismatch between BeamMP's `Port` and the tunnel's local port. The app shows a red "Port mismatch detected" warning on the Dashboard and Tunnel tabs when this happens — click "Resync tunnel to port XXXX" to fix it.

If that doesn't work, log in to https://playit.gg, find your tunnel, and manually edit its "Local Port" to match your `ServerConfig.toml` Port (default 30814).

### Build fails with "link.exe not found"
You didn't install the MSVC Build Tools. See Prerequisites section above.

### Build fails on first compile with weird Rust errors
Run `cargo clean` in `src-tauri/`, then `bun run tauri:build` again. The first build downloads and compiles ~300 dependencies; flaky networks sometimes cause failures mid-download.

---

## Project structure

```
my-project/
├── src/                          # Next.js frontend (UI)
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx              # Entry: wires up Tauri event handlers
│   ├── components/beammp/        # All UI panels
│   └── lib/beammp/
│       ├── store.ts              # Zustand store (dual-mode: Tauri vs mock)
│       ├── tauri-bridge.ts       # invoke() + listen() wrapper, isTauri() detection
│       ├── server-config.ts      # TOML schema + validation
│       ├── beammp-server-mock.ts # Mock for browser mode
│       ├── playit-agent-mock.ts  # Mock for browser mode
│       ├── github-api.ts         # Browser-side GitHub API (for dev mode)
│       ├── maps.ts               # BeamMP map paths
│       ├── color-codes.ts        # BeamMP ^-color codes
│       └── types.ts
├── src-tauri/                    # Real Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── capabilities/default.json # Tauri v2 permissions
│   ├── icons/                    # App icons (PNG, ICO, ICNS)
│   └── src/
│       ├── main.rs               # Entry
│       ├── lib.rs                # Plugin registration, tray, IPC handlers
│       ├── beammp.rs             # Real BeamMP-Server process management
│       ├── playit.rs             # Real playit-agent process management + claim URL parsing
│       ├── config.rs             # ServerConfig.toml + settings.json I/O
│       └── github.rs             # GitHub releases API + binary downloads
├── package.json                  # Tauri scripts: tauri:dev, tauri:build
├── next.config.ts                # Static export when TAURI_BUILD=1
└── README.md                     # This file
```

---

## Security & privacy

- The app **never** runs binaries as Administrator. BeamMP-Server and playit-agent both run as your normal user.
- **No telemetry.** Config, logs, and secrets never leave your machine except to BeamMP's and playit's own official endpoints, via their own binaries.
- The BeamMP AuthKey is stored in `ServerConfig.toml` in your install dir.
- The playit agent secret is stored in `config.toml` in the playit install dir.
- App settings are stored in `%APPDATA%\BeamMPHost\settings.json`.

---

## Acknowledgements

- [BeamMP](https://beammp.com/) — multiplayer mod for BeamNG.drive
- [playit.gg](https://playit.gg/) — tunneling service
- [Tauri](https://tauri.app/) — desktop app framework
- [BeamMP/BeamMP-Server](https://github.com/BeamMP/BeamMP-Server) and [playit-cloud/playit-agent](https://github.com/playit-cloud/playit-agent) — both open source on GitHub
