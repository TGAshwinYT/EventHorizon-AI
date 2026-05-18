import os
import json
from typing import Dict, Any

class MemoryService:
    def __init__(self):
        # Persistent storage folder in workspace
        self.memory_dir = os.path.join(os.getcwd(), "user_memory")
        os.makedirs(self.memory_dir, exist_ok=True)
        print(f"[MEMORY SERVICE] Persistent directory verified: {self.memory_dir}")

    def save_memory(self, user_id: str, key: str, value: str) -> bool:
        """
        Persistently save a key-value memory mapping for a given user.
        """
        try:
            user_file = os.path.join(self.memory_dir, f"{user_id}.json")
            data = {}
            if os.path.exists(user_file):
                try:
                    with open(user_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except Exception:
                    data = {}

            data[key] = value
            
            with open(user_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            print(f"[MEMORY SERVICE] Saved: user_id={user_id}, {key}={value}")
            return True
        except Exception as e:
            print(f"[MEMORY SERVICE ERROR] Save failed: {e}")
            return False

    def get_memory(self, user_id: str) -> Dict[str, Any]:
        """
        Retrieve all memory context for a given user.
        """
        try:
            user_file = os.path.join(self.memory_dir, f"{user_id}.json")
            if os.path.exists(user_file):
                with open(user_file, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            print(f"[MEMORY SERVICE ERROR] Retrieval failed: {e}")
        return {}

memory_service = MemoryService()
