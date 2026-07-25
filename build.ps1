# BeamMP Host - One-Click Windows Build Script
# ============================================
#
# WHAT THIS DOES:
#   1. Installs Microsoft Visual C++ Build Tools automatically (~6GB, 10-15 min)
#   2. Verifies link.exe is now available
#   3. Runs bun install + bun run tauri:build
#   4. Opens the folder containing your MSI installer
#
# HOW TO RUN:
#   1. Right-click PowerShell -> "Run as Administrator"
#   2. cd to the project folder:
#        cd "C:\Users\Solymi\Documents\7. Beam server"
#   3. Run this script:
#        .\build.ps1
#
#   (If PowerShell complains about script execution, run this first:
#        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#    then run .\build.ps1 again)
#
# WHAT YOU NEED:
#   - Windows 10 or 11
#   - Internet connection (~6GB download for MSVC Build Tools)
#   - Admin rights (for installing MSVC Build Tools)
#   - About 20-30 minutes total
#
# After the build succeeds, you'll find your installer at:
#   src-tauri\target\release\bundle\msi\BeamMP Host_0.1.0_x64_en-US.msi
# (the script will open that folder automatically)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [X]  $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  BeamMP Host - One-Click Windows Builder" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# ---- 0. Verify we're in the right folder ----
Write-Step "Checking project folder..."
if (-not (Test-Path "package.json") -or -not (Test-Path "src-tauri")) {
    Write-Err "Not in project root. Run this script from the folder containing package.json and src-tauri/."
    Write-Host "    Current directory: $(Get-Location)" -ForegroundColor Gray
    exit 1
}
Write-OK "Project folder looks good."

# ---- 1. Check if link.exe is already available ----
Write-Step "Checking for MSVC linker (link.exe)..."
$link = Get-Command link.exe -ErrorAction SilentlyContinue
if ($link) {
    Write-OK "link.exe already available at: $($link.Source)"
} else {
    Write-Warn "link.exe not found. Installing Microsoft Visual C++ Build Tools..."
    Write-Host "    This is a ~6GB download and takes 10-15 minutes." -ForegroundColor Gray
    Write-Host "    A UAC prompt may appear - please approve it." -ForegroundColor Gray
    Write-Host ""

    # Try winget first (preinstalled on Windows 10 1809+ and Windows 11)
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "    Using winget to install VS 2022 Build Tools with C++ workload..." -ForegroundColor Gray
        # The --override passes args directly to the VS installer:
        #   --quiet         = no UI
        #   --wait          = wait for completion before returning
        #   --add           = install the VCTools workload (C++ build tools + Windows SDK)
        #   --includeRecommended = also install CMake, ATL, etc. (recommended by Microsoft)
        & winget install Microsoft.VisualStudio.2022.BuildTools `
            --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" `
            --accept-source-agreements --accept-package-agreements

        if ($LASTEXITCODE -ne 0) {
            Write-Warn "winget install returned exit code $LASTEXITCODE. Trying direct download..."
            $directSuccess = $false
        } else {
            $directSuccess = $true
        }
    } else {
        $directSuccess = $false
    }

    if (-not $directSuccess) {
        Write-Host "    Downloading VS Build Tools installer directly..." -ForegroundColor Gray
        $installer = "$env:TEMP\vs_buildtools.exe"
        try {
            Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vs_buildtools.exe" -OutFile $installer -UseBasicParsing
        } catch {
            Write-Err "Failed to download VS Build Tools installer: $_"
            Write-Host "    Please install manually from:" -ForegroundColor Gray
            Write-Host "    https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Gray
            Write-Host "    Select 'Desktop development with C++' workload, then re-run this script." -ForegroundColor Gray
            exit 1
        }
        Write-Host "    Running VS Build Tools installer (this may take 10-15 minutes)..." -ForegroundColor Gray
        $proc = Start-Process -FilePath $installer `
            -ArgumentList "--quiet","--wait","--add","Microsoft.VisualStudio.Workload.VCTools","--includeRecommended" `
            -PassThru -Wait
        if ($proc.ExitCode -ne 0) {
            Write-Warn "Installer exited with code $($proc.ExitCode). Continuing anyway to check if it succeeded..."
        }
    }

    # Refresh PATH for this session
    Write-Host "    Refreshing PATH..." -ForegroundColor Gray
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    # Try to load vcvars64.bat to set up the MSVC environment for this session
    $vcvarsPaths = @(
        "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
        "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
        "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat",
        "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat",
        "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
    )
    $vcvars = $vcvarsPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($vcvars) {
        Write-Host "    Loading MSVC environment from: $vcvars" -ForegroundColor Gray
        cmd /c "`"$vcvars`" >nul 2>&1 && set" | ForEach-Object {
            if ($_ -match "^(.*?)=(.*)$") {
                Set-Item -Path "env:$($matches[1])" -Value $matches[2]
            }
        }
    }

    # Final verification
    $link = Get-Command link.exe -ErrorAction SilentlyContinue
    if ($link) {
        Write-OK "link.exe now available at: $($link.Source)"
    } else {
        Write-Err "link.exe still not found after MSVC Build Tools install."
        Write-Host ""
        Write-Host "    This usually means the installer is still finishing in the" -ForegroundColor Gray
        Write-Host "    background, OR you need to restart your computer for PATH" -ForegroundColor Gray
        Write-Host "    changes to take effect system-wide." -ForegroundColor Gray
        Write-Host ""
        Write-Host "    Please do ONE of these:" -ForegroundColor Yellow
        Write-Host "      1. Wait 5 minutes, then re-run this script." -ForegroundColor White
        Write-Host "      2. Restart your computer, then re-run this script." -ForegroundColor White
        Write-Host "      3. Manually verify MSVC Build Tools installed correctly:" -ForegroundColor White
        Write-Host "         Open 'Visual Studio Installer' from Start menu," -ForegroundColor Gray
        Write-Host "         confirm 'Visual Studio Build Tools 2022' is installed" -ForegroundColor Gray
        Write-Host "         with the 'Desktop development with C++' workload." -ForegroundColor Gray
        exit 1
    }
}

# ---- 2. Check Rust ----
Write-Step "Checking Rust toolchain..."
$rustc = Get-Command rustc -ErrorAction SilentlyContinue
if (-not $rustc) {
    Write-Warn "Rust not found. Installing via rustup..."
    Invoke-Expression "& { $(Invoke-RestMethod https://win.rustup.rs/x86_64) -y }"
    $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
    $rustc = Get-Command rustc -ErrorAction SilentlyContinue
    if (-not $rustc) {
        Write-Err "Rust installation failed."
        Write-Host "    Install manually from https://rustup.rs/ and re-run this script." -ForegroundColor Gray
        exit 1
    }
}
$rustVersion = (& rustc --version) 2>&1
Write-OK "Rust: $rustVersion"

# ---- 3. Check Bun ----
Write-Step "Checking Bun..."
$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) {
    Write-Warn "Bun not found. Installing..."
    Invoke-Expression "& { $(Invoke-RestMethod https://bun.sh/install.ps1) }"
    $env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
    $bun = Get-Command bun -ErrorAction SilentlyContinue
    if (-not $bun) {
        Write-Err "Bun installation failed."
        Write-Host "    Install manually from https://bun.sh/ and re-run this script." -ForegroundColor Gray
        exit 1
    }
}
Write-OK "Bun: $(bun --version)"

# ---- 4. Install JS dependencies ----
Write-Step "Installing JavaScript dependencies (bun install)..."
& bun install
if ($LASTEXITCODE -ne 0) {
    Write-Err "bun install failed."
    exit 1
}
Write-OK "Dependencies installed."

# ---- 5. Build the Tauri app ----
Write-Step "Building Tauri desktop app..."
Write-Host "    First build takes ~5-10 minutes for Rust compilation (585 crates)." -ForegroundColor Gray
Write-Host "    Subsequent builds take ~30 seconds thanks to caching." -ForegroundColor Gray
Write-Host ""
& bun run tauri:build
$buildExit = $LASTEXITCODE

if ($buildExit -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCEEDED!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your installer(s) are at:" -ForegroundColor White

    $msiFolder = "src-tauri\target\release\bundle\msi"
    $nsisFolder = "src-tauri\target\release\bundle\nsis"

    if (Test-Path $msiFolder) {
        Write-Host "  MSI:  $msiFolder" -ForegroundColor Cyan
        Get-ChildItem $msiFolder -Filter "*.msi" | ForEach-Object {
            Write-Host "        -> $($_.Name)" -ForegroundColor Gray
        }
    }
    if (Test-Path $nsisFolder) {
        Write-Host "  NSIS: $nsisFolder" -ForegroundColor Cyan
        Get-ChildItem $nsisFolder -Filter "*.exe" | ForEach-Object {
            Write-Host "        -> $($_.Name)" -ForegroundColor Gray
        }
    }

    Write-Host ""
    Write-Host "Opening folder in Explorer..." -ForegroundColor White
    if (Test-Path $msiFolder) {
        Invoke-Item $msiFolder
    } elseif (Test-Path $nsisFolder) {
        Invoke-Item $nsisFolder
    } else {
        Invoke-Item "src-tauri\target\release\bundle"
    }

    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "  1. Double-click the .msi file to install BeamMP Host" -ForegroundColor Gray
    Write-Host "  2. Launch 'BeamMP Host' from your Start menu" -ForegroundColor Gray
    Write-Host "  3. Walk through the setup wizard (get a BeamMP AuthKey from" -ForegroundColor Gray
    Write-Host "     https://keymaster.beammp.com/ and a playit.gg account from" -ForegroundColor Gray
    Write-Host "     https://playit.gg/ - both free)" -ForegroundColor Gray
    Write-Host "  4. Start your server, share your public address, race with friends" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "  BUILD FAILED" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Look at the error messages above. Common fixes:" -ForegroundColor Yellow
    Write-Host "  - 'link.exe not found': restart your computer (PATH needs refresh)" -ForegroundColor Gray
    Write-Host "  - 'could not compile X': paste the error and I'll help" -ForegroundColor Gray
    Write-Host "  - 'bun: command not found': run 'irm bun.sh/install.ps1 | iex'" -ForegroundColor Gray
    Write-Host ""
    exit $buildExit
}
