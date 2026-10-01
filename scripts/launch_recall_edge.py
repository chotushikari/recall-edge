"""Launch Recall Edge as one local desktop-style application on Windows.

The launcher owns the API and dashboard child processes. It opens the dashboard
in Microsoft Edge app mode when Edge is installed, otherwise in the default
browser. Ctrl+C shuts down only child processes started by this launcher.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


def healthy(url: str) -> bool:
    try:
        with urlopen(url, timeout=1) as response:  # noqa: S310 - localhost health probe
            return response.status == 200
    except URLError:
        return False


def edge_executable() -> Path | None:
    candidates = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
    ]
    return next((path for path in candidates if path.exists()), None)


def wait_for(url: str, label: str) -> None:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if healthy(url):
            return
        time.sleep(0.25)
    raise RuntimeError(f"{label} did not become available at {url}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Launch Recall Edge as one local app.")
    parser.add_argument("--api-port", type=int, default=8000)
    parser.add_argument("--dashboard-port", type=int, default=3000)
    parser.add_argument("--no-open", action="store_true", help="Start services without opening the dashboard window")
    args = parser.parse_args()
    api_url = f"http://127.0.0.1:{args.api_port}"
    dashboard_url = f"http://127.0.0.1:{args.dashboard_port}"
    children: list[subprocess.Popen] = []
    try:
        if not healthy(f"{api_url}/health"):
            children.append(subprocess.Popen([sys.executable, "-m", "uvicorn", "backend.api.server:app", "--port", str(args.api_port)], cwd=ROOT))
            wait_for(f"{api_url}/health", "Recall API")
        next_bin = FRONTEND / "node_modules" / "next" / "dist" / "bin" / "next"
        if not healthy(dashboard_url):
            if not next_bin.exists():
                raise RuntimeError("Dashboard dependencies are missing. Run `npm install` in frontend once.")
            environment = {**os.environ, "NEXT_PUBLIC_API_BASE": api_url}
            children.append(subprocess.Popen(["node", str(next_bin), "start", "-p", str(args.dashboard_port)], cwd=FRONTEND, env=environment))
            wait_for(dashboard_url, "Recall dashboard")
        if not args.no_open:
            edge = edge_executable()
            if edge:
                subprocess.Popen([str(edge), f"--app={dashboard_url}"])
            else:
                webbrowser.open(dashboard_url)
        print(f"Recall Edge is running at {dashboard_url}. Press Ctrl+C to stop services launched here.")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for child in reversed(children):
            child.terminate()
        for child in reversed(children):
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()


if __name__ == "__main__":
    main()
