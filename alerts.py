"""
Evenfield - Email Alerts
Sends high-signal filing alerts and daily digest emails via Resend.
Reads from evenfield_enriched.json and congressional_enriched.json.
Tracks sent alerts in alerted_filings.json.

Usage:
  python alerts.py              # send per-filing high-signal alerts
  python alerts.py --digest     # send daily top-5 digest to all subscribers

Requires: pip install resend
"""

import io
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Configuration ─────────────────────────────────────────────────────────────

INSIDER_ENRICHED      = "evenfield_enriched.json"
CONGRESS_ENRICHED     = "congressional_enriched.json"
SUBSCRIBERS_FILE      = "subscribers.json"
ALERTED_FILE          = "alerted_filings.json"
SIGNAL_THRESHOLD      = 7
FROM_EMAIL            = "Evenfield <alerts@evenfield.app>"


# ── Helpers ────────────────────────────────────────────────────────────────────

def load_json(path: str, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: str, data) -> None:
    Path(path).write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def format_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso[:10]).strftime("%b %d, %Y")
    except Exception:
        return iso


def build_email_body(filings: list) -> str:
    today = datetime.now().strftime("%B %d, %Y")
    lines = [
        f"Evenfield High-Signal Alert — {today}",
        "=" * 50,
        f"{len(filings)} filing(s) with signal score ≥ {SIGNAL_THRESHOLD}",
        "",
    ]

    for f in filings:
        source = f.get("source_type", "insider")
        score  = f.get("signal_score", 0)
        filed  = format_date(str(f.get("filed_at") or ""))

        if source == "congressional":
            lines.append(f"[CONGRESS] {f.get('politician', '?')} ({f.get('party', '?')}, {f.get('chamber', '?')})")
            lines.append(f"  Ticker: {f.get('ticker', '?')}  |  {f.get('amount_range', '')}  |  {f.get('transaction', '')}")
        else:
            lines.append(f"[INSIDER]  {f.get('company', '?')} ({f.get('ticker', '?')})")
            lines.append(f"  Insider: {f.get('owner', '?')} — {f.get('role', '')}")

        lines.append(f"  Signal: {score}/10  |  Filed: {filed}")
        lines.append(f"  {f.get('plain_english', '')}")
        lines.append(f"  Why: {f.get('signal_reason', '')}")

        flags = f.get("flags", [])
        if flags:
            lines.append(f"  Flags: {', '.join(flags)}")

        src_url = f.get("source_url") or ""
        if src_url:
            lines.append(f"  Source: {src_url}")

        lines.append("")

    lines += [
        "-" * 50,
        "Evenfield — The market, explained.",
        "You are receiving this because you subscribed at evenfield.app",
        "Unsubscribe: reply with 'unsubscribe' in subject",
        "",
        "Data sourced from SEC EDGAR and public disclosures.",
        "Not financial advice.",
    ]
    return "\n".join(lines)


def send_alerts(subscribers: list, filings: list) -> int:
    try:
        import resend
    except ImportError:
        print("  Error: resend not installed. Run: pip install resend")
        return 0

    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        print("  Error: RESEND_API_KEY environment variable not set.")
        return 0

    resend.api_key = api_key

    today   = datetime.now().strftime("%B %d, %Y")
    subject = f"Evenfield Alert: {len(filings)} High-Signal Filing{'s' if len(filings) != 1 else ''} — {today}"
    body    = build_email_body(filings)

    sent = 0
    for email in subscribers:
        try:
            params: resend.Emails.SendParams = {
                "from":    FROM_EMAIL,
                "to":      [email],
                "subject": subject,
                "text":    body,
            }
            result = resend.Emails.send(params)
            print(f"  ✓ Sent to {email}  (id: {result.get('id', '?')})")
            sent += 1
        except Exception as e:
            print(f"  ✗ Failed to send to {email}: {e}")

    return sent


def run_alerts():
    print("\n" + "═" * 62)
    print("  EVENFIELD — Email Alerts")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═" * 62 + "\n")

    # Load all enriched filings
    insider   = load_json(INSIDER_ENRICHED,  [])
    congress  = load_json(CONGRESS_ENRICHED, [])
    all_filings = insider + congress

    # Load already-alerted IDs
    alerted   = load_json(ALERTED_FILE,      {})
    subscribers = load_json(SUBSCRIBERS_FILE, [])

    if not subscribers:
        print("  No subscribers found. Add with: python add_subscriber.py user@example.com")
        return

    # Find new high-signal filings
    high_signal = [
        f for f in all_filings
        if f.get("signal_score", 0) >= SIGNAL_THRESHOLD
        and f.get("id") not in alerted
    ]

    print(f"  {len(all_filings)} total enriched filings")
    print(f"  {len(high_signal)} new high-signal filings (score ≥ {SIGNAL_THRESHOLD})")
    print(f"  {len(subscribers)} subscriber(s)\n")

    if not high_signal:
        print("  Nothing new to send — all high-signal filings already alerted.")
        return

    # Print what we're about to send
    for f in high_signal:
        src  = "C" if f.get("source_type") == "congressional" else "I"
        name = f.get("politician") or f.get("owner") or "?"
        print(f"  [{src}] {name:35s}  {f.get('ticker','?'):6s}  {f.get('signal_score','?')}/10")

    print()

    sent = send_alerts(subscribers, high_signal)

    # Mark as alerted
    for f in high_signal:
        alerted[f["id"]] = datetime.now(timezone.utc).isoformat()
    save_json(ALERTED_FILE, alerted)

    print(f"\n{'─' * 62}")
    print(f"  Done — {sent} email(s) sent, {len(high_signal)} filing(s) marked as alerted\n")


# ── Digest mode ───────────────────────────────────────────────────────────────

def build_digest_body(top5: list) -> str:
    today = datetime.now().strftime("%B %d, %Y")
    lines = [
        f"Evenfield Daily Digest — {today}",
        "=" * 54,
        f"Today's top {len(top5)} signal{'s' if len(top5) != 1 else ''} across insider filings and congressional trades.",
        "",
    ]

    for i, f in enumerate(top5, 1):
        source  = f.get("source_type", "insider")
        score   = f.get("signal_score", 0)
        ticker  = f.get("ticker", "?")
        flags   = ", ".join(f.get("flags", [])[:3]) or "—"

        if source == "congressional":
            who = f"{f.get('politician','?')} ({f.get('party','?')}, {f.get('chamber','')})"
            label = f"#{i} [CONGRESS] {ticker} · Signal {score}/10"
        else:
            who = f"{f.get('owner','?')} — {f.get('role','Insider')} at {f.get('company','?')}"
            label = f"#{i} [INSIDER]  {ticker} · Signal {score}/10"

        lines.append(label)
        lines.append(f"  {who}")
        lines.append(f"  {f.get('plain_english', '').strip()}")
        lines.append(f"  Flags: {flags}")
        if f.get("source_url"):
            lines.append(f"  Source: {f['source_url']}")
        lines.append("")

    lines += [
        "─" * 54,
        "Evenfield | The market, explained.",
        "Data: SEC EDGAR · STOCK Act · USASpending.gov",
        "Not financial advice.",
        "",
        "You are receiving this because you subscribed to Evenfield alerts.",
        "To unsubscribe, reply to this email with 'UNSUBSCRIBE' in the subject.",
    ]
    return "\n".join(lines)


def run_digest():
    print("\n" + "═" * 62)
    print("  EVENFIELD — Daily Digest")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═" * 62 + "\n")

    try:
        import resend
    except ImportError:
        print("  Error: resend not installed. Run: pip install resend")
        return

    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        print("  Error: RESEND_API_KEY environment variable not set.")
        return

    resend.api_key = api_key

    subscribers = load_json(SUBSCRIBERS_FILE, [])
    if not subscribers:
        print("  No subscribers found. Add with: python add_subscriber.py user@example.com")
        return

    insider    = load_json(INSIDER_ENRICHED,  [])
    congress   = load_json(CONGRESS_ENRICHED, [])
    all_filings = insider + congress

    # Sort all filings by signal score, take top 5
    scored = [f for f in all_filings if isinstance(f.get("signal_score"), int)]
    scored.sort(key=lambda x: x.get("signal_score", 0), reverse=True)
    top5   = scored[:5]

    print(f"  {len(all_filings)} total enriched filings")
    print(f"  Top {len(top5)} selected for digest\n")

    if not top5:
        print("  No enriched filings available — nothing to send.")
        return

    for f in top5:
        src  = "C" if f.get("source_type") == "congressional" else "I"
        name = f.get("politician") or f.get("owner") or "?"
        print(f"  [{src}] {name:35s}  {f.get('ticker','?'):6s}  {f.get('signal_score','?')}/10")

    today   = datetime.now().strftime("%B %d, %Y")
    subject = f"Evenfield Daily — {today} Top Signals"
    body    = build_digest_body(top5)

    sent = errors = 0
    print()
    for sub in subscribers:
        email = sub.get("email") if isinstance(sub, dict) else sub
        if not email:
            continue
        try:
            params: resend.Emails.SendParams = {
                "from":    FROM_EMAIL,
                "to":      [email],
                "subject": subject,
                "text":    body,
            }
            result = resend.Emails.send(params)
            print(f"  ✓ Digest sent to {email}  (id: {result.get('id', '?')})")
            sent += 1
        except Exception as e:
            print(f"  ✗ Failed: {email} — {e}")
            errors += 1

    print(f"\n{'─' * 62}")
    print(f"  Digest complete — {sent} sent, {errors} errors\n")


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if "--digest" in sys.argv:
        run_digest()
    else:
        run_alerts()
