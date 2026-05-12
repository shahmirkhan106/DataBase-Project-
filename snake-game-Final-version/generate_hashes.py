import hashlib
import json
import os


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "file_hashes.json")

EXCLUDED_DIRS = {
    "__pycache__",
    "instance",
    ".git",
    ".idea",
    ".vscode",
}

EXCLUDED_FILES = {
    "file_hashes.json",
    "generate_hashes.py",
}


def sha256_for_file(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as file_obj:
        while True:
            chunk = file_obj.read(8192)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def generate_hash_manifest() -> dict:
    manifest = {}

    for root, dirs, files in os.walk(BASE_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]

        for filename in files:
            if filename in EXCLUDED_FILES:
                continue

            absolute_path = os.path.join(root, filename)
            relative_path = os.path.relpath(absolute_path, BASE_DIR)

            if any(part in EXCLUDED_DIRS for part in relative_path.split(os.sep)):
                continue

            manifest[relative_path] = sha256_for_file(absolute_path)

    return dict(sorted(manifest.items(), key=lambda item: item[0]))


def main() -> None:
    manifest = generate_hash_manifest()
    with open(OUTPUT_FILE, "w", encoding="utf-8") as file_obj:
        json.dump(manifest, file_obj, indent=2)
    print(f"Generated {OUTPUT_FILE} with {len(manifest)} file hashes.")


if __name__ == "__main__":
    main()
