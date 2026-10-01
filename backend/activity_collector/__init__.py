"""Opt-in, local-only operating-system activity collectors."""

from .runner import LocalActivityCollector
from .windows import ActivityPoller, foreground_activity

__all__ = ["ActivityPoller", "LocalActivityCollector", "foreground_activity"]
