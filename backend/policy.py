"""Deterministic, auditable memory privacy policy."""
from __future__ import annotations

from backend.contracts import Memory, MemoryType, PrivacyClass

DEFAULT_POLICY: dict[MemoryType, PrivacyClass] = {
    MemoryType.USER: PrivacyClass.PRIVATE,
    MemoryType.PERSON: PrivacyClass.PRIVATE,
    MemoryType.PROJECT: PrivacyClass.SYNCABLE,
    MemoryType.TOOL: PrivacyClass.SYNCABLE,
    MemoryType.TOPIC: PrivacyClass.SYNCABLE,
    MemoryType.ORG: PrivacyClass.SYNCABLE,
}
APP_OVERRIDES: dict[str, PrivacyClass] = {
    "com.1password.*": PrivacyClass.PRIVATE,
    "com.apple.passwords": PrivacyClass.PRIVATE,
    "com.bank.*": PrivacyClass.PRIVATE,
    "com.bitwarden.*": PrivacyClass.PRIVATE,
    "org.mozilla.firefox.private": PrivacyClass.PRIVATE,
    "com.apple.mail": PrivacyClass.PRIVATE,
    "com.freron.MailMate": PrivacyClass.PRIVATE,
}


def classify_privacy(memory_type: MemoryType, bundle_id: str | None = None) -> PrivacyClass:
    if bundle_id:
        for pattern, value in APP_OVERRIDES.items():
            if pattern.endswith(".*") and bundle_id.startswith(pattern[:-1]):
                return value
            if bundle_id == pattern:
                return value
    return DEFAULT_POLICY[memory_type]


def apply_policy(memory: Memory, bundle_id: str | None = None) -> Memory:
    resolved_bundle = bundle_id or memory.provenance.get("bundle_id")
    memory.privacy = classify_privacy(memory.memory_type, resolved_bundle)
    if memory.privacy is PrivacyClass.PRIVATE:
        memory.local_only = True
    return memory
