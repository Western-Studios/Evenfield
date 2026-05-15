"""
Evenfield - Add email subscriber for alerts.
Usage: python add_subscriber.py user@example.com
"""

import json
import re
import sys
from pathlib import Path

SUBSCRIBERS_FILE = "subscribers.json"


def load_subscribers() -> list:
    try:
        return json.loads(Path(SUBSCRIBERS_FILE).read_text(encoding="utf-8"))
    except Exception:
        return []


def save_subscribers(subs: list) -> None:
    Path(SUBSCRIBERS_FILE).write_text(json.dumps(subs, indent=2), encoding="utf-8")


def valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email.strip()))


def main():
    if len(sys.argv) < 2:
        print("Usage: python add_subscriber.py user@example.com")
        sys.exit(1)

    email = sys.argv[1].strip().lower()

    if not valid_email(email):
        print(f"Error: '{email}' is not a valid email address.")
        sys.exit(1)

    subs = load_subscribers()

    if email in subs:
        print(f"  Already subscribed: {email}")
        return

    subs.append(email)
    save_subscribers(subs)
    print(f"  ✓ Subscribed: {email}")
    print(f"  Total subscribers: {len(subs)}")


if __name__ == "__main__":
    main()
