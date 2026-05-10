import time
import asyncio
from typing import Any, Dict

class TTLCache:
    """
    A Time-To-Live Hash Map Data Structure.
    Provides O(1) time complexity for insertions and lookups.
    Automatically invalidates entries older than `ttl_seconds`.
    """
    def __init__(self, ttl_seconds: int = 3600):
        self.ttl = ttl_seconds
        self.cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Any:
        """O(1) time complexity lookup."""
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry['timestamp'] < self.ttl:
                return entry['value']
            else:
                # O(1) time complexity deletion
                del self.cache[key]
        return None

    def set(self, key: str, value: Any):
        """O(1) time complexity insertion."""
        self.cache[key] = {
            'timestamp': time.time(),
            'value': value
        }

    def clear(self):
        """O(1) operation to reset the entire cache."""
        self.cache.clear()
