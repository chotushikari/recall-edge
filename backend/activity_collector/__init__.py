"""Opt-in, local-only operating-system activity collectors."""

from .windows import ActivityPoller, foreground_activity

__all__ = ["ActivityPoller", "foreground_activity"]
