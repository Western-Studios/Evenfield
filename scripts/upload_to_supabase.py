"""
Upload one or more JSON files to Supabase Storage (bucket: pipeline-data).
Overwrites any existing file with the same name.

Usage:
  python scripts/upload_to_supabase.py <file1.json> [file2.json ...]

Required env vars:
  SUPABASE_URL          e.g. https://wornbqdvjsohvofeqcrk.supabase.co
  SUPABASE_SERVICE_KEY  Service role key (never use anon key here)
"""

import os
import sys
from pathlib import Path

def main():
    files = sys.argv[1:]
    if not files:
        print("Usage: python scripts/upload_to_supabase.py <file1.json> [file2.json ...]")
        sys.exit(1)

    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")
        sys.exit(1)

    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: supabase package not installed. Run: pip install supabase")
        sys.exit(1)

    client = create_client(url, key)
    bucket = "pipeline-data"

    for filepath in files:
        path = Path(filepath)
        if not path.exists():
            print(f"  SKIP  {filepath} (file not found)")
            continue

        dest = path.name  # upload as the bare filename, no subdirs
        data = path.read_bytes()

        try:
            # upsert=True overwrites the existing file if it already exists
            client.storage.from_(bucket).upload(
                path=dest,
                file=data,
                file_options={
                    "content-type": "application/json",
                    "upsert": "true",
                },
            )
            size_kb = len(data) / 1024
            print(f"  OK    {dest}  ({size_kb:.1f} KB)")
        except Exception as e:
            print(f"  ERROR {dest}: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
