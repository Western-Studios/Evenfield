"""
Evenfield - Phase 1 Data Pipeline
Pulls Form 4 insider trading filings from SEC EDGAR
No API key required - all public data
"""

import gzip
import json
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.error

# ── Runtime guard (CI / GitHub Actions) ──────────────────────────────────────
START_TIME = time.time()
MAX_RUNTIME = 20 * 60  # 20 minutes — exit cleanly before GHA 30-min timeout

# ── Configuration ────────────────────────────────────────────────────────────

POLL_INTERVAL_SECONDS = 120          # Check for new filings every 2 minutes
OUTPUT_FILE = "evenfield_filings.json"
SEEN_FILE = "seen_filings.json"      # Tracks filings we've already processed

# Browser-like User-Agent — SEC/EDGAR may block plain bot strings from CI IPs
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Evenfield/1.0; +https://evenfield.app; contact@evenfield.app)",
    "Accept": "application/atom+xml,application/xml,text/xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

# EDGAR EFTS (full-text search) API — JSON, different rate-limiting from RSS feed
# URL is built dynamically per-run using today's date (see get_recent_form4_entries)
EFTS_BASE = "https://efts.sec.gov/LATEST/search-index?q=%22%22&forms=4&dateRange=custom"

# Transaction codes and what they mean in plain English
TRANSACTION_CODES = {
    "P": "purchased",
    "S": "sold",
    "A": "was awarded",
    "D": "disposed of",
    "F": "forfeited shares for tax",
    "G": "gifted",
    "M": "exercised options for",
    "X": "exercised expiring options for",
    "C": "converted",
    "E": "expired",
    "H": "expired in-the-money",
    "I": "discretionary",
    "L": "small acquisition",
    "O": "out-of-money option",
    "U": "tender of shares",
    "W": "acquired by will/laws",
    "Z": "deposit into voting trust",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch_url(url):
    """Fetch a URL with proper headers, return text or None on failure."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read()
            if raw[:2] == b'\x1f\x8b':
                raw = gzip.decompress(raw)
            return raw.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        print(f"  [HTTP {e.code}] {url}")
        return None
    except Exception as e:
        print(f"  [Error fetching URL] {e}")
        return None


def fetch_url_with_retry(url, max_retries=3):
    """Fetch a URL, retrying up to max_retries times with a 2s delay."""
    for attempt in range(max_retries):
        result = fetch_url(url)
        if result:
            return result
        if attempt < max_retries - 1:
            print(f"  Retry {attempt + 1}/{max_retries - 1}...")
            time.sleep(2)
    return None


def load_json_file(path):
    """Load a JSON file, return empty structure on missing/corrupt file."""
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return {}


def save_json_file(path, data):
    """Save data to a JSON file, pretty-printed."""
    Path(path).write_text(json.dumps(data, indent=2, default=str))


def format_dollars(value):
    """Format a number as a dollar amount."""
    try:
        v = float(value)
        if v >= 1_000_000:
            return f"${v/1_000_000:.1f}M"
        elif v >= 1_000:
            return f"${v/1_000:.0f}K"
        else:
            return f"${v:.2f}"
    except Exception:
        return "$unknown"


def format_shares(value):
    """Format share count with commas."""
    try:
        return f"{int(float(value)):,}"
    except Exception:
        return str(value)


# ── EFTS Feed Parsing ─────────────────────────────────────────────────────────

def get_recent_form4_entries():
    """
    Fetch Form 4 filings from EDGAR's EFTS (full-text search) JSON API.
    Returns a list of {id, filing_url, title, filed_at} dicts,
    None if EDGAR is completely unreachable after retries.
    """
    from datetime import date
    today = date.today().isoformat()
    url = f"{EFTS_BASE}&startdt={today}&enddt={today}"

    print(f"  Checking EFTS API for Form 4 filings ({today})...")
    text = fetch_url_with_retry(url)
    if not text:
        return None  # None = unreachable (caller handles graceful exit)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  [JSON parse error] {e}")
        return []

    hits = data.get("hits", {}).get("hits", [])
    total = data.get("hits", {}).get("total", {}).get("value", len(hits))
    print(f"  Found {total} filing(s) for {today}")

    entries = []
    for hit in hits:
        accession_dashed = hit.get("_id", "").strip()
        if not accession_dashed:
            continue

        source = hit.get("_source", {})

        # Derive CIK from the first segment of the accession number.
        # Accession format: XXXXXXXXXX-YY-NNNNNN  (first 10 digits = submitter CIK)
        parts = accession_dashed.split("-")
        try:
            cik = str(int(parts[0]))  # strip leading zeros
        except (ValueError, IndexError):
            continue

        accession_no_dash = accession_dashed.replace("-", "")
        filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dash}-index.htm"

        entries.append({
            "id":         accession_dashed,
            "filing_url": filing_url,
            "title":      source.get("entity_name", "Unknown"),
            "filed_at":   source.get("file_date", today),
        })

    return entries


# ── Form 4 XML Parsing ────────────────────────────────────────────────────────

def get_form4_xml_url(index_url):
    """
    Given a filing index URL, find the actual Form 4 XML document URL.
    Index URL looks like: https://www.sec.gov/Archives/edgar/data/CIK/ACCESSION-INDEX.htm
    EDGAR serves two XML entries per filing: one inside xslF345X06/ (XSLT display
    wrapper) and one bare. We skip the wrapper and take the raw XML.
    """
    html = fetch_url_with_retry(index_url)
    if not html:
        return None

    def extract_href(line):
        start = line.find('href="')
        if start == -1:
            return None
        start += 6
        end = line.find('"', start)
        return line[start:end]

    candidates = []
    for line in html.splitlines():
        if 'href="' not in line or ".xml" not in line.lower():
            continue
        path = extract_href(line)
        if not path or not path.startswith("/Archives"):
            continue
        if "xslF345X" in path:
            continue  # skip XSLT display wrapper
        candidates.append(path)

    if candidates:
        return "https://www.sec.gov" + candidates[0]

    return None


def parse_form4_xml(xml_text, meta):
    """
    Parse Form 4 XML and return a structured filing dict.
    Returns None if we can't extract meaningful data.
    """
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    def find_text(tag):
        el = root.find(".//" + tag)
        return el.text.strip() if el is not None and el.text else ""

    # ── Issuer (the company) ──
    company_name   = find_text("issuerName")
    ticker         = find_text("issuerTradingSymbol")

    # ── Reporting owner (the insider) ──
    owner_name     = find_text("rptOwnerName")
    is_director    = find_text("isDirector") == "1"
    is_officer     = find_text("isOfficer")  == "1"
    officer_title  = find_text("officerTitle")
    is_10pct       = find_text("isTenPercentOwner") == "1"

    # Build a human-readable role
    roles = []
    if is_director:
        roles.append("Director")
    if is_officer and officer_title:
        roles.append(officer_title)
    elif is_officer:
        roles.append("Officer")
    if is_10pct:
        roles.append("10% Owner")
    role_str = ", ".join(roles) if roles else "Insider"

    # ── Transactions ──
    # EDGAR XML wraps most numeric/date fields in a <value> child element.
    # Helper: read tag text, preferring the nested <value> element if present.
    def tx_text(el, tag):
        node = el.find(".//" + tag)
        if node is None:
            return ""
        val_node = node.find("value")
        text = (val_node.text if val_node is not None else node.text) or ""
        return text.strip()

    transactions = []
    tx_tags = ["nonDerivativeTransaction", "derivativeTransaction"]

    for tx_tag in tx_tags:
        for tx in root.findall(".//" + tx_tag):
            code     = tx_text(tx, "transactionCode")
            shares   = tx_text(tx, "transactionShares")
            price    = tx_text(tx, "transactionPricePerShare")
            acq_disp = tx_text(tx, "transactionAcquiredDisposedCode")
            tx_date  = tx_text(tx, "transactionDate")
            security = tx_text(tx, "securityTitle") or "shares"
            shares_after = tx_text(tx, "sharesOwnedFollowingTransaction")

            total_value = ""
            try:
                total_value = str(float(shares) * float(price))
            except Exception:
                pass

            verb = TRANSACTION_CODES.get(code, "transacted")

            transactions.append({
                "code":              code,
                "verb":              verb,
                "security":          security,
                "shares":            shares,
                "price":             price,
                "total_value":       total_value,
                "acquired_disposed": acq_disp,
                "date":              tx_date,
                "shares_after":      shares_after,
                "type":              "derivative" if tx_tag == "derivativeTransaction" else "non-derivative",
            })

    if not transactions:
        return None  # Skip filings with no transactions

    # ── Plain English summary ──
    summaries = []
    for tx in transactions:
        shares_fmt = format_shares(tx["shares"])
        price_fmt  = f" at {format_dollars(tx['price'])} per share" if tx["price"] else ""
        total_fmt  = f" (total: {format_dollars(tx['total_value'])})" if tx["total_value"] else ""
        direction  = "📈 BUY" if tx["acquired_disposed"] == "A" else "📉 SELL"

        summary = (
            f"{direction} | {owner_name} ({role_str}) "
            f"{tx['verb']} {shares_fmt} {tx['security']} "
            f"of {company_name} ({ticker})"
            f"{price_fmt}{total_fmt} on {tx['date']}"
        )
        summaries.append(summary)

    return {
        "id":             meta["id"],
        "filed_at":       meta["filed_at"],
        "company":        company_name,
        "ticker":         ticker,
        "owner":          owner_name,
        "role":           role_str,
        "transactions":   transactions,
        "summaries":      summaries,
        "source_url":     meta["filing_url"],
        "fetched_at":     datetime.now(timezone.utc).isoformat(),
    }


# ── Main Loop ─────────────────────────────────────────────────────────────────

def run_pipeline():
    print("\n" + "═" * 60)
    print("  EVENFIELD — Phase 1 Data Pipeline")
    print("  Monitoring SEC EDGAR Form 4 Insider Filings")
    print("═" * 60 + "\n")

    # Load previously seen filing IDs so we don't re-process
    seen = load_json_file(SEEN_FILE)
    all_filings = load_json_file(OUTPUT_FILE) if Path(OUTPUT_FILE).exists() else []
    if isinstance(all_filings, dict):
        all_filings = []

    cycle = 0

    while True:
        # ── Runtime guard ──────────────────────────────────────────────────────
        elapsed = time.time() - START_TIME
        if elapsed > MAX_RUNTIME:
            print(f"\nMax runtime reached ({MAX_RUNTIME // 60} min) — exiting cleanly.")
            print(f"Processed {len(all_filings)} total filing(s) across {cycle} cycle(s).")
            break

        cycle += 1
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[Cycle {cycle}] {now}")

        entries = get_recent_form4_entries()

        # ── EDGAR unreachable ──────────────────────────────────────────────────
        if entries is None:
            print("EDGAR unreachable from this runner — will retry on next scheduled run")
            save_json_file(OUTPUT_FILE, all_filings)
            save_json_file(SEEN_FILE, seen)
            sys.exit(0)

        new_count = 0

        for entry in entries:
            # ── Per-entry runtime check ────────────────────────────────────────
            if time.time() - START_TIME > MAX_RUNTIME:
                print("Max runtime reached mid-cycle — saving and exiting cleanly.")
                break
            filing_id = entry["id"]

            # Skip already processed filings
            if filing_id in seen:
                continue

            seen[filing_id] = True
            print(f"  → New filing: {entry['title'][:60]}")

            # Get the filing index page to find the XML
            xml_url = get_form4_xml_url(entry["filing_url"])
            if not xml_url:
                print("    [Could not find XML — skipping]")
                time.sleep(0.5)
                continue

            # Fetch and parse the Form 4 XML
            xml_text = fetch_url(xml_url)
            if not xml_text:
                time.sleep(0.5)
                continue

            filing = parse_form4_xml(xml_text, entry)
            if not filing:
                print("    [No transactions found — skipping]")
                time.sleep(0.5)
                continue

            # Print plain English summaries to console
            for summary in filing["summaries"]:
                print(f"    {summary}")

            all_filings.append(filing)
            new_count += 1

            # SEC rate limit: ~8 req/sec max, we stay well under
            time.sleep(0.75)

        # Save progress after each cycle
        save_json_file(OUTPUT_FILE, all_filings)
        save_json_file(SEEN_FILE, seen)

        if new_count:
            print(f"  ✓ {new_count} new filing(s) saved to {OUTPUT_FILE}")
        else:
            print(f"  ✓ No new filings this cycle")

        print(f"  Waiting {POLL_INTERVAL_SECONDS}s before next check...\n")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    try:
        run_pipeline()
    except KeyboardInterrupt:
        print("\n\nPipeline stopped. Data saved.")
