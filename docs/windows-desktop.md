# Recall Desktop Preview for Windows

Recall runs as a local runtime on Windows 10/11. It starts a local API and the
dashboard, then opens the dashboard in Edge app mode when Microsoft Edge is
available. Your permitted activity stays on the device.

## Run from a downloaded source bundle

1. Download and extract `Recall-Desktop-Preview.zip`.
2. Install Python 3.11+ and Node.js 20+.
3. Double-click `scripts\start_recall_windows.cmd`.
4. On the first run, the launcher installs local Python and dashboard
   dependencies, then opens Recall.

The launcher does not enable activity or visual capture. Capture remains off
until the user explicitly starts it in the dashboard.

## Create a preview bundle

From a checked-out repository, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package_windows_preview.ps1
```

This creates `dist\Recall-Desktop-Preview.zip` from tracked source files. It
is a portable preview bundle, not a signed native `.exe` installer. Building a
signed installer is the next desktop-distribution milestone; it requires a
native shell and Windows code-signing process, neither of which should be
faked for a download page.
