"""
Evenfield - Congressional Trades Pipeline
Pulls STOCK Act trade disclosures from Quiver Quantitative (primary)
with SEC EFTS fallback. Runs every 4 hours.
"""

import argparse
import gzip
import io
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── CLI args — parsed at module level so they're available everywhere ─────────
parser = argparse.ArgumentParser()
parser.add_argument("--once", action="store_true",
                    help="Run one cycle and exit (for GitHub Actions)")
parser.add_argument("--loop", action="store_true",
                    help="Run continuously on POLL_INTERVAL_SECONDS (local dev)")
args = parser.parse_args()

# ── Configuration ─────────────────────────────────────────────────────────────

OUTPUT_FILE           = "congressional_filings.json"
SEEN_FILE             = "seen_congressional.json"
POLL_INTERVAL_SECONDS = 4 * 3600

HEADERS = {
    "User-Agent":      "Evenfield/1.0 Kyle Bond kyle.p.bond@gmail.com",
    "Accept-Encoding": "gzip, deflate",
    "Accept":          "application/json",
}

QUIVER_URL = "https://api.quiverquant.com/beta/live/congresstrading"

# Committee keyword → company sector match (for conflict detection)
COMMITTEE_SECTORS = {
    "armed services":  ["defense", "aerospace", "raytheon", "lockheed", "northrop", "general dynamics", "l3"],
    "banking":         ["bank", "financial", "credit", "insurance", "jpmorgan", "wells fargo", "citigroup", "goldman"],
    "energy":          ["energy", "oil", "gas", "solar", "wind", "nuclear", "utility", "exxon", "chevron", "pioneer"],
    "health":          ["pharma", "biotech", "health", "medical", "drug", "pfizer", "merck", "abbvie", "bristol"],
    "intelligence":    ["cyber", "security", "surveillance", "palantir", "booz allen", "saic", "leidos", "maxar"],
    "judiciary":       ["prison", "corrections", "geo group", "corecivic", "detention"],
    "commerce":        ["telecom", "tech", "retail", "transport", "amazon", "google", "meta", "apple", "comcast"],
    "agriculture":     ["food", "farm", "agriculture", "fertilizer", "deere", "archer daniels", "bunge"],
    "finance":         ["bank", "insurance", "investment", "hedge fund", "blackrock", "vanguard", "fidelity"],
    "technology":      ["semiconductor", "software", "cloud", "nvidia", "amd", "intel", "qualcomm", "broadcom"],
    "foreign affairs": ["weapons", "defense", "arms", "raytheon", "lockheed"],
}

PARTY_NORM = {
    "D": "Democrat", "R": "Republican", "I": "Independent",
    "democrat": "Democrat", "republican": "Republican", "independent": "Independent",
    "democratic": "Democrat",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def fetch_url(url: str, body: bytes | None = None) -> str | None:
    req = urllib.request.Request(url, data=body, headers=HEADERS,
                                  method="POST" if body else "GET")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
            if raw[:2] == b'\x1f\x8b':
                raw = gzip.decompress(raw)
            return raw.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        print(f"  [HTTP {e.code}] {url}")
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


def days_between(date_a: str, date_b: str) -> int | None:
    try:
        a = datetime.fromisoformat(str(date_a)[:10])
        b = datetime.fromisoformat(str(date_b)[:10])
        return (b - a).days
    except Exception:
        return None


def detect_committee_conflict(committees: list, ticker: str, company: str) -> bool:
    target = (ticker + " " + company).lower()
    for committee in committees:
        c_lower = str(committee).lower()
        for key, keywords in COMMITTEE_SECTORS.items():
            if key in c_lower:
                if any(kw in target for kw in keywords):
                    return True
    return False


def make_id(rep: str, ticker: str, date: str, direction: str) -> str:
    import hashlib
    raw = f"{rep}|{ticker}|{date}|{direction}"
    return "cong_" + hashlib.md5(raw.encode()).hexdigest()[:14]


# ── Parsing ────────────────────────────────────────────────────────────────────

def parse_entry(raw: dict) -> dict | None:
    rep     = str(raw.get("Representative") or raw.get("Senator") or "").strip()
    ticker  = str(raw.get("Ticker") or "").strip().upper()
    if not rep:
        return None

    party_raw   = str(raw.get("Party") or "")
    chamber_raw = str(raw.get("House") or raw.get("Chamber") or "")
    transaction = str(raw.get("Transaction") or raw.get("Type") or "").lower()
    amount      = str(raw.get("Range") or raw.get("Amount") or "")
    trade_date  = str(raw.get("Date") or raw.get("TransactionDate") or "")[:10]
    disc_date   = str(raw.get("DisclosureDate") or raw.get("Filed") or trade_date)[:10]
    company     = str(raw.get("Company") or raw.get("Issuer") or ticker)
    source_url  = str(raw.get("Link") or raw.get("url") or "")

    committees = raw.get("Committees") or []
    if isinstance(committees, str):
        committees = [c.strip() for c in committees.split(";") if c.strip()]

    acquired = "A" if any(w in transaction for w in ("purchase", "buy", "bought", "exchange")) else "D"
    days     = days_between(trade_date, disc_date) if trade_date and disc_date else None
    party    = PARTY_NORM.get(party_raw.strip(), party_raw.strip())

    flags = ["congressional-trade"]
    if days is not None and days > 30:
        flags.append("late-disclosure")
    if detect_committee_conflict(committees, ticker, company):
        flags.append("committee-conflict")
    if acquired == "A":
        flags.append("open-market purchase")
    else:
        flags.append("open-market sale")

    return {
        "id":                make_id(rep, ticker, trade_date, acquired),
        "source_type":       "congressional",
        "politician":        rep,
        "party":             party,
        "chamber":           chamber_raw.strip(),
        "committees":        committees,
        "ticker":            ticker,
        "company":           company,
        "transaction":       transaction,
        "acquired_disposed": acquired,
        "amount_range":      amount,
        "trade_date":        trade_date,
        "disclosure_date":   disc_date,
        "days_to_disclosure": days,
        "flags":             flags,
        "filed_at":          disc_date,
        "owner":             rep,
        "role":              f"{chamber_raw.strip()} · {party}",
        "source_url":        source_url,
        "transactions": [{
            "code":             "P" if acquired == "A" else "S",
            "verb":             "purchased" if acquired == "A" else "sold",
            "security":         "Common Stock",
            "shares":           "",
            "price":            "",
            "total_value":      "",
            "acquired_disposed": acquired,
            "date":             trade_date,
            "shares_after":     "",
            "type":             "non-derivative",
            "amount_range":     amount,
        }],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Data sources ───────────────────────────────────────────────────────────────

def fetch_quiver() -> list | None:
    print("  → Quiver Quantitative...")
    text = fetch_url(QUIVER_URL)
    if not text:
        return None
    try:
        data = json.loads(text)
        if isinstance(data, list) and data:
            print(f"    ✓ {len(data)} trades")
            return data
        if isinstance(data, dict) and ("error" in data or "detail" in data):
            msg = data.get("error") or data.get("detail", "unknown")
            print(f"    ✗ API error: {msg}")
        return None
    except json.JSONDecodeError:
        return None


def fetch_efts_fallback() -> list:
    """SEC EFTS search for POSTEFFECT congressional filings (limited)."""
    print("  → SEC EFTS fallback...")
    today = datetime.now().strftime("%Y-%m-%d")
    url = (
        "https://efts.sec.gov/LATEST/search-index"
        "?q=%22form+type%3APOSTEFFECT%22"
        f"&dateRange=custom&startdt={today}&enddt={today}"
        "&hits.hits._source=period_of_report,entity_name,file_date"
    )
    text = fetch_url(url)
    if not text:
        return []
    try:
        data  = json.loads(text)
        hits  = data.get("hits", {}).get("hits", [])
        results = []
        for hit in hits:
            src = hit.get("_source", {})
            results.append({
                "Representative": src.get("entity_name", "Unknown"),
                "Ticker": "",
                "Company": src.get("entity_name", ""),
                "Transaction": "Unknown",
                "Range": "",
                "Party": "",
                "House": "",
                "Date": src.get("period_of_report", today),
                "DisclosureDate": src.get("file_date", today),
            })
        print(f"    ✓ {len(results)} entries")
        return results
    except Exception as e:
        print(f"    ✗ Parse error: {e}")
        return []


# ── Main loop ──────────────────────────────────────────────────────────────────

def run_once():
    seen    = load_json(SEEN_FILE,   {})
    filings = load_json(OUTPUT_FILE, [])
    if isinstance(filings, dict):
        filings = []

    raw_trades = fetch_quiver() or fetch_efts_fallback()
    if not raw_trades:
        print("  No data from any source.")
        return 0

    new_count = errors = 0

    for raw in raw_trades:
        try:
            filing = parse_entry(raw)
        except Exception as e:
            print(f"  [Parse error] {e}")
            errors += 1
            continue

        if filing is None:
            continue

        fid = filing["id"]
        if fid in seen:
            continue

        seen[fid]  = True
        filings.append(filing)
        new_count += 1

        direction  = "BUY " if filing["acquired_disposed"] == "A" else "SELL"
        flags_str  = "  [" + ", ".join(filing["flags"]) + "]" if filing["flags"] else ""
        ticker_str = f"{filing['ticker']:6s}" if filing["ticker"] else "     ?"
        print(f"  {direction} | {ticker_str} | {filing['politician']:35s} | {filing['amount_range']}{flags_str}")

    save_json(OUTPUT_FILE, filings)
    save_json(SEEN_FILE,   seen)

    total = len(filings)
    print(f"\n{'─' * 62}")
    print(f"  Done — {new_count} new, {errors} errors | {total} total\n")
    return new_count


def run_pipeline():
    print("\n" + "═" * 62)
    print("  EVENFIELD — Congressional Trades Pipeline")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═" * 62 + "\n")

    cycle = 0
    while True:
        cycle += 1
        print(f"[Cycle {cycle}] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        run_once()
        print(f"  Sleeping {POLL_INTERVAL_SECONDS // 3600}h...\n")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    print("\n" + "═" * 62)
    print("  EVENFIELD — Congressional Trades Pipeline")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Mode: {'continuous loop' if args.loop else 'single-run (--once)'}")
    print("═" * 62 + "\n")

    if args.loop:
        run_pipeline()
    else:
        run_once()
