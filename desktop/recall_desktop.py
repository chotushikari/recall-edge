"""Native Windows host for Recall's local API and dashboard.

The packaged executable starts both services on loopback only, then presents
the dashboard in a WebView2 window. No activity capture is enabled on launch.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.request import urlopen

import uvicorn
import webview


APP_NAME = "Recall"

# A direct source run places ``desktop`` (rather than the repository root) on
# sys.path. The packaged executable already collects backend as a top-level
# module, so this is only needed for the local test path.
if not getattr(sys, "frozen", False):
    source_root = str(Path(__file__).resolve().parents[1])
    if source_root not in sys.path:
        sys.path.insert(0, source_root)


def bundled_root() -> Path:
    """Return PyInstaller's resource directory, or the repository root in dev."""
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parents[1]


def user_data_root() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    root = base / APP_NAME
    root.mkdir(parents=True, exist_ok=True)
    return root


def available_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for(url: str, label: str) -> None:
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=1) as response:  # noqa: S310 - loopback probe
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.15)
    raise RuntimeError(f"{label} did not start at {url}")


def run_api(port: int) -> uvicorn.Server:
    from backend.api.server import app

    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True, name="recall-api").start()
    wait_for(f"http://127.0.0.1:{port}/health", "Recall API")
    return server


def run_dashboard(root: Path, api_port: int) -> tuple[subprocess.Popen[str], int]:
    dashboard_port = available_port()
    runtime = root / "frontend-runtime"
    node = root / "node.exe"
    # Running this file from the repository is the quickest way to test the
    # native window before PyInstaller has produced Recall.exe. The build
    # script prepares the same self-contained runtime under dist/windows-app.
    if not node.is_file() or not (runtime / "server.js").is_file():
        preview_root = root / "dist" / "windows-app"
        runtime = preview_root / "frontend-runtime"
        node = preview_root / "node.exe"
    if not node.is_file() or not (runtime / "server.js").is_file():
        raise RuntimeError("Recall's dashboard runtime is missing. Reinstall Recall.")
    environment = {
        **os.environ,
        "HOSTNAME": "127.0.0.1",
        "PORT": str(dashboard_port),
        "NEXT_PUBLIC_API_BASE": f"http://127.0.0.1:{api_port}",
    }
    process = subprocess.Popen(
        [str(node), "server.js"],
        cwd=runtime,
        env=environment,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        text=True,
    )
    wait_for(f"http://127.0.0.1:{dashboard_port}", "Recall dashboard")
    return process, dashboard_port


def main() -> None:
    root = bundled_root()
    data_root = user_data_root()
    os.chdir(data_root)
    os.environ.setdefault("OPENCHRONICLE_ROOT", str(data_root / "openchronicle"))
    os.environ.setdefault("RECALL_QDRANT_LOCAL_PATH", str(data_root / "qdrant"))
    os.environ.setdefault("RECALL_SYNC_ENABLED", "false")
    # The packaged preview uses deterministic local vectors. It never downloads
    # a model or sends a memory to a model provider during first launch.
    os.environ.setdefault("RECALL_EMBEDDING_MODE", "fallback")

    api_port = available_port()
    api_server = run_api(api_port)
    dashboard_process, dashboard_port = run_dashboard(root, api_port)
    window = webview.create_window(
        "Recall — Your private computer memory",
        f"http://127.0.0.1:{dashboard_port}",
        width=1440,
        height=940,
        min_size=(960, 680),
        background_color="#070713",
    )
    try:
        webview.start(debug=False)
    finally:
        dashboard_process.terminate()
        try:
            dashboard_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            dashboard_process.kill()
        api_server.should_exit = True
        window.destroy()


if __name__ == "__main__":
    main()
