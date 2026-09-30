# Recall Edge Browser Companion

This unpacked Chrome/Edge extension records browser tab activity into a local Recall Edge API only. It is intentionally separate from the desktop collector because browser URLs and inactive tabs require explicit browser permission.

## What is captured

- Tab title and a sanitized URL (`origin + pathname` only)
- Changes to active and background non-incognito tabs

It does not capture incognito tabs, query strings, fragments, credentials, page content, keystrokes, screenshots, clipboard data, or any remote endpoint. Raw activity remains local and is never sent to Qdrant Cloud.

## Install

1. Run Recall Edge at `http://127.0.0.1:8000`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode, choose **Load unpacked**, and select this folder.
4. Open the extension's **Options** page and confirm capture is enabled.

Disable it from the browser's extension controls at any time. Use `DELETE /activities/all` in Recall Edge to remove locally collected browser and desktop activity.
