import hashlib
import json
import os
from typing import Dict


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
HASH_FILE = os.path.join(BASE_DIR, "file_hashes.json")

EXCLUDED_PATHS = {
    "instance",
    "__pycache__",
    ".git",
    ".idea",
    ".vscode",
    "file_hashes.json",
}


def _sha256_for_file(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as file_obj:
        while True:
            chunk = file_obj.read(8192)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def _load_expected_hashes() -> Dict[str, str]:
    if not os.path.exists(HASH_FILE):
        return {}
    with open(HASH_FILE, "r", encoding="utf-8") as file_obj:
        return json.load(file_obj)


def run_integrity_check(strict: bool = True) -> bool:
    expected_hashes = _load_expected_hashes()
    if not expected_hashes:
        message = "[INTEGRITY] No file_hashes.json found or file is empty."
        if strict:
            print(f"{message} Startup blocked in strict mode.")
            return False
        print(f"{message} Skipping check in non-strict mode.")
        return True

    for relative_path, expected_hash in expected_hashes.items():
        if any(relative_path.startswith(path + os.sep) or relative_path == path for path in EXCLUDED_PATHS):
            continue

        absolute_path = os.path.join(BASE_DIR, relative_path)
        if not os.path.exists(absolute_path):
            if strict:
                print(f"[INTEGRITY] Missing file: {relative_path}")
                return False
            print(f"[INTEGRITY] Warning (non-strict): Missing file: {relative_path}")
            continue

        actual_hash = _sha256_for_file(absolute_path)
        if actual_hash != expected_hash:
            if strict:
                print(f"[INTEGRITY] Hash mismatch: {relative_path}")
                return False
            print(f"[INTEGRITY] Warning (non-strict): Hash mismatch: {relative_path}")
            continue

    print("[INTEGRITY] Integrity check passed.")
    return True
