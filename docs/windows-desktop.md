# Recall for Windows

Recall is a local-first Windows app for inspecting computer memories through a
timeline, daily digest, search, and local Q&A. It starts a loopback-only local
API and opens the dashboard in a native WebView2 window. Your data remains on
the device.

## Run the demo build

1. Open `Recall.exe` from the supplied `Recall-Windows-<version>` folder.
2. If Windows SmartScreen appears, choose **More info** and then **Run anyway**
   only after confirming that you received the folder from a trusted source.
3. Use the Timeline, Search, Daily Digest, and Ask Recall views to explore the
   bundled demo data.

The demo opens with background capture and cloud sync disabled. It does not
silently record activity. Recall stores its local app data in
`%LOCALAPPDATA%\Recall`.

## Build the Windows app

From a checked-out repository with Python, Node.js, and the project
dependencies installed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_windows_app.ps1 `
  -Version 0.1.0 -Publisher Piyush_codex
```

The build produces a portable release folder:

```text
dist\Recall-Windows-0.1.0\Recall.exe
```

This is an unsigned portable Windows app, not an MSI installer. A production
release should be code-signed before broad distribution so users do not need to
override SmartScreen warnings.

## Source preview

For development, use the source launcher instead:

```powershell
python scripts\launch_recall_edge.py
```
