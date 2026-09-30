"""Local vector-store adapter for Recall."""
from .store import (
    clear_memories,
    count_local,
    count_pending_sync,
    count_private,
    get_memory,
    get_pending_sync,
    index_memory,
    list_memories,
    mark_synced,
    search_memories,
    supersede_memory,
)

__all__ = ["clear_memories", "count_local", "count_pending_sync", "count_private", "get_memory", "get_pending_sync", "index_memory", "list_memories", "mark_synced", "search_memories", "supersede_memory"]
