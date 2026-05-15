"""
Evenfield - Federal Contracts Pipeline
Pulls federal contracts >$10M from USASpending.gov and cross-references
with known insider-trade tickers. No API key required.
"""

import gzip
import io
import json
import ssl
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
import urllib.request
import urllib.error

# Windows corporate proxy / self-signed cert workaround
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Configuration ─────────────────────────────────────────────────────────────

OUTPUT_FILE       = "lobbying_data.json"
ENRICHED_FILE     = "evenfield_enriched.json"
MIN_AMOUNT        = 10_000_000   # $10M threshold
LOOKBACK_DAYS     = 90           # Pull contracts from last 90 days

USASPENDING_URL   = "https://api.usaspending.gov/api/v2/search/spending_by_award/"

HEADERS = {
    "User-Agent":   "Evenfield/1.0 Kyle Bond kyle.p.bond@gmail.com",
    "Content-Type": "application/json",
    "Accept":       "application/json",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def fetch_post(url: str, payload: dict) -> dict | None:
    body = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as resp:
            raw = resp.read()
            if raw[:2] == b'\x1f\x8b':
                raw = gzip.decompress(raw)
            return json.loads(raw.decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")[:300]
        print(f"  [HTTP {e.code}] {url} — {body_text}")
        return None
    except Exception as e:
        print(f"  [Error] {e}")
        return None


def load_json(path: str, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: str, data) -> None:
    Path(path).write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def build_ticker_map(enriched: list) -> dict:
    """Return {ticker: company_name} and a set of lowercase company name fragments."""
    tm = {}
    for f in enriched:
        t = str(f.get("ticker") or "").strip().upper()
        c = str(f.get("company") or "").strip()
        if t:
            tm[t] = c
    return tm


def find_matching_tickers(recipient: str, ticker_map: dict) -> list:
    """Check whether the contract recipient name matches any known company."""
    recipient_lower = recipient.lower()
    matches = []
    for ticker, company in ticker_map.items():
        if not company:
            continue
        # Match on company name fragment (first significant word, >=4 chars)
        words = [w for w in company.lower().split() if len(w) >= 4
                 and w not in ("inc.", "inc", "corp", "corp.", "ltd", "llc", "co.", "the", "and")]
        if any(w in recipient_lower for w in words[:3]):   # check first 3 meaningful words
            matches.append(ticker)
    return matches


def format_amount(v) -> str:
    try:
        n = float(v)
        if n >= 1e9:  return f"${n/1e9:.1f}B"
        if n >= 1e6:  return f"${n/1e6:.1f}M"
        if n >= 1e3:  return f"${n/1e3:.0f}K"
        return f"${n:,.0f}"
    except Exception:
        return str(v)


# ── Fetch contracts ────────────────────────────────────────────────────────────

def fetch_contracts(start_date: str, end_date: str, page: int = 1) -> dict | None:
    payload = {
        "filters": {
            "time_period": [{"start_date": start_date, "end_date": end_date}],
            "award_type_codes": ["A", "B", "C", "D"],   # procurement contracts
        },
        "fields": [
            "Recipient Name",
            "Award Amount",
            "Awarding Agency Name",
            "Start Date",
            "Description",
            "Award ID",
        ],
        "limit": 100,
        "page": page,
        "sort": "Award Amount",
        "order": "desc",
        "subawards": False,
    }
    return fetch_post(USASPENDING_URL, payload)


def run_pipeline():
    print("\n" + "═" * 62)
    print("  EVENFIELD — Federal Contracts Pipeline (USASpending.gov)")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═" * 62 + "\n")

    # Date range
    end_dt   = datetime.now()
    start_dt = end_dt - timedelta(days=LOOKBACK_DAYS)
    start_date = start_dt.strftime("%Y-%m-%d")
    end_date   = end_dt.strftime("%Y-%m-%d")
    print(f"  Range: {start_date} → {end_date}  |  Min amount: {format_amount(MIN_AMOUNT)}\n")

    # Load enriched insider data for cross-referencing
    enriched   = load_json(ENRICHED_FILE, [])
    ticker_map = build_ticker_map(enriched)
    print(f"  {len(ticker_map)} insider tickers loaded for cross-reference\n")

    # Fetch pages until we have enough or exhaust results
    all_results = []
    page = 1
    while True:
        print(f"  Fetching page {page}...")
        resp = fetch_contracts(start_date, end_date, page)
        if not resp:
            break

        results = resp.get("results", [])
        if not results:
            break

        # Filter client-side for >= MIN_AMOUNT
        for r in results:
            amount = r.get("Award Amount") or 0
            try:
                amount = float(amount)
            except Exception:
                amount = 0
            if amount >= MIN_AMOUNT:
                all_results.append(r)

        # If the smallest result on this page is < MIN_AMOUNT, no need to fetch more pages
        last_amount = 0
        try:
            last_amount = float(results[-1].get("Award Amount") or 0)
        except Exception:
            pass
        if last_amount < MIN_AMOUNT or len(results) < 100:
            break

        page += 1
        if page > 5:   # safety cap
            break

    print(f"\n  {len(all_results)} contracts ≥ {format_amount(MIN_AMOUNT)}\n")

    # Build structured contract records
    contracts = []
    seen_ids  = set()

    for r in all_results:
        award_id  = str(r.get("Award ID") or "")
        recipient = str(r.get("Recipient Name") or "Unknown").strip().title()
        amount    = r.get("Award Amount") or 0
        agency    = str(r.get("Awarding Agency Name") or "").strip()
        date      = str(r.get("Start Date") or "")[:10]
        desc      = str(r.get("Description") or "").strip()[:200]

        contract_id = f"contract_{award_id}" if award_id else f"contract_{recipient}_{date}"
        if contract_id in seen_ids:
            continue
        seen_ids.add(contract_id)

        matching_tickers = find_matching_tickers(recipient, ticker_map)

        record = {
            "id":               contract_id,
            "award_id":         award_id,
            "recipient":        recipient,
            "amount":           float(amount),
            "amount_fmt":       format_amount(amount),
            "agency":           agency,
            "date":             date,
            "description":      desc,
            "insider_tickers":  matching_tickers,
            "fetched_at":       datetime.now(timezone.utc).isoformat(),
        }
        contracts.append(record)

        cross = f"  📈 Insider tickers: {', '.join(matching_tickers)}" if matching_tickers else ""
        print(f"  {format_amount(amount):>10s}  {recipient[:40]:40s}  {agency[:30]}{cross}")

    # Sort by amount desc
    contracts.sort(key=lambda x: x["amount"], reverse=True)

    save_json(OUTPUT_FILE, contracts)

    print(f"\n{'─' * 62}")
    print(f"  Done — {len(contracts)} contracts saved to {OUTPUT_FILE}\n")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true",
                        help="Run one cycle and exit (for CI/GitHub Actions)")
    parser.parse_args()  # accept --once; lobbying pipeline is always single-run
    run_pipeline()
