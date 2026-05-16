"""
Evenfield - Phase 1 Data Pipeline
Pulls Form 4 insider trading filings from SEC EDGAR
No API key required - all public data
"""

import argparse
import gzip
import json
import socket
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.error

# ── CLI args — parsed at module level so they're available everywhere ─────────
parser = argparse.ArgumentParser()
parser.add_argument("--once", action="store_true",
                    help="Run one cycle and exit (for GitHub Actions)")
args = parser.parse_args()

# ── Unbuffered output — GitHub Actions shows logs in real time ────────────────
sys.stdout.reconfigure(line_buffering=True)

# ── Hard socket timeout — catches hangs that urllib's timeout misses ──────────
socket.setdefaulttimeout(10)

# ── Runtime guard (CI / GitHub Actions) ──────────────────────────────────────
START_TIME = time.time()
MAX_RUNTIME = 20 * 60  # 20 minutes — exit cleanly before GHA 30-min timeout

# ── Configuration ────────────────────────────────────────────────────────────

POLL_INTERVAL_SECONDS = 120          # Check for new filings every 2 minutes
OUTPUT_FILE = "evenfield_filings.json"
SEEN_FILE = "seen_filings.json"      # Tracks filings we've already processed

# Browser-like User-Agent — SEC/EDGAR may block plain bot strings from CI IPs
UA = "Mozilla/5.0 (compatible; Evenfield/1.0; +https://evenfield.app; contact@evenfield.app)"

# HTML index pages — accept text/html so EDGAR doesn't serve the XSLT-rendered XML
HEADERS = {
    "User-Agent":      UA,
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
}

# JSON API (EFTS search endpoint)
JSON_HEADERS = {
    "User-Agent":      UA,
    "Accept":          "application/json,*/*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
}

# Form 4 XML documents
XML_HEADERS = {
    "User-Agent":      UA,
    "Accept":          "text/xml,application/xml,*/*;q=0.9",
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

def fetch_url(url, headers=None):
    """Fetch a URL, return text or None on failure."""
    h = headers or HEADERS
    print(f"  Fetching: {url[:80]}...", flush=True)
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read()
            if raw[:2] == b'\x1f\x8b':
                raw = gzip.decompress(raw)
            result = raw.decode("utf-8", errors="replace")
            print(f"  Response received: {len(result)} chars", flush=True)
            return result
    except urllib.error.HTTPError as e:
        print(f"  [HTTP {e.code}] {url}", flush=True)
        return None
    except Exception as e:
        print(f"  [Error fetching URL] {type(e).__name__}: {e}", flush=True)
        return None


def fetch_url_with_retry(url, headers=None, max_retries=3):
    """Fetch a URL, retrying up to max_retries times with a 2s delay."""
    for attempt in range(max_retries):
        print(f"  Attempt {attempt + 1}/{max_retries}: {url[:80]}...", flush=True)
        result = fetch_url(url, headers=headers)
        if result:
            return result
        if attempt < max_retries - 1:
            print(f"  Retry {attempt + 1}/{max_retries - 1} in 2s...", flush=True)
            time.sleep(2)
    print(f"  All {max_retries} attempts failed for: {url[:80]}", flush=True)
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
    from datetime import date, timedelta
    today = date.today()
    start = (today - timedelta(days=5)).isoformat()
    end   = today.isoformat()
    # Request entity_id (issuer CIK) explicitly — the accession number prefix
    # is the SUBMITTER CIK (often a filing agent), not the issuer's CIK.
    url = (
        f"{EFTS_BASE}&startdt={start}&enddt={end}"
        "&hits.hits._source=file_date,entity_name,entity_id,period_of_report"
    )

    print(f"  Checking EFTS API for Form 4 filings ({start} → {end})...", flush=True)
    text = fetch_url_with_retry(url, headers=JSON_HEADERS)
    if not text:
        return None  # None = unreachable (caller handles graceful exit)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  [JSON parse error] {e}", flush=True)
        return []

    hits = data.get("hits", {}).get("hits", [])
    total = data.get("hits", {}).get("total", {}).get("value", len(hits))
    print(f"  Found {total} filing(s) between {start} and {end} ({len(hits)} returned)", flush=True)

    entries = []
    for hit in hits:
        accession_dashed = hit.get("_id", "").strip()
        if not accession_dashed:
            continue

        source = hit.get("_source", {})

        # Prefer entity_id from EFTS (_source) — this is the issuer's CIK.
        # Fall back to first segment of accession number (submitter CIK).
        entity_id = str(source.get("entity_id", "")).strip().lstrip("0")
        if entity_id:
            cik = entity_id
        else:
            parts = accession_dashed.split("-")
            try:
                cik = str(int(parts[0]))  # strip leading zeros
            except (ValueError, IndexError):
                print(f"  [Skipping — cannot derive CIK from {accession_dashed}]", flush=True)
                continue

        accession_no_dash = accession_dashed.replace("-", "")
        filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dash}-index.htm"

        print(f"  → {accession_dashed}  CIK={cik}  {source.get('entity_name','?')}", flush=True)

        entries.append({
            "id":         accession_dashed,
            "filing_url": filing_url,
            "title":      source.get("entity_name", "Unknown"),
            "filed_at":   source.get("file_date", end),
        })

    return entries


# ── Form 4 XML Parsing ────────────────────────────────────────────────────────

def get_form4_xml_url(index_url):
    """
    Given a filing index URL, find the actual Form 4 XML document URL.
    Strategy:
      1. Try constructing the XML URL directly from the accession number
         (most Form 4s follow this pattern).
      2. Fall back to parsing the HTML index page for an XML link.
    """
    # ── Strategy 1: direct URL construction ───────────────────────────────────
    # index_url: .../edgar/data/{CIK}/{ACCESSION_NO_DASH}-index.htm
    # XML lives at: .../edgar/data/{CIK}/{ACCESSION_NO_DASH}.xml
    if index_url.endswith("-index.htm"):
        direct_xml = index_url[:-len("-index.htm")] + ".xml"
        print(f"  Trying direct XML URL: {direct_xml[:80]}", flush=True)
        result = fetch_url(direct_xml, headers=XML_HEADERS)
        if result and "<ownershipDocument" in result:
            print("  Direct XML URL worked.", flush=True)
            return direct_xml

    # ── Strategy 2: parse the HTML index page ─────────────────────────────────
    print(f"  Falling back to HTML index parse: {index_url[:80]}", flush=True)
    html = fetch_url_with_retry(index_url, headers=HEADERS)
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
        print(f"  Found {len(candidates)} XML candidate(s) in index page.", flush=True)
        return "https://www.sec.gov" + candidates[0]

    # Log first 500 chars of the index page so we can see what EDGAR returned
    print(f"  [No XML found in index page] First 300 chars: {html[:300]!r}", flush=True)
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
    if args.once:
        print("  Mode: single-run (--once)")
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

        new_count = skipped_seen = no_xml = no_tx = fetch_err = 0

        print(f"  Processing {len(entries)} entries...", flush=True)

        for entry in entries:
            # ── Per-entry runtime check ────────────────────────────────────────
            if time.time() - START_TIME > MAX_RUNTIME:
                print("Max runtime reached mid-cycle — saving and exiting cleanly.", flush=True)
                break
            filing_id = entry["id"]

            # Skip already successfully processed filings
            if filing_id in seen:
                skipped_seen += 1
                continue

            print(f"  → {entry['title'][:55]}  [{filing_id}]", flush=True)

            # Get the filing index page to find the XML
            xml_url = get_form4_xml_url(entry["filing_url"])
            if not xml_url:
                print("    [Could not find XML URL — skipping]", flush=True)
                no_xml += 1
                time.sleep(0.5)
                continue

            # Fetch and parse the Form 4 XML
            xml_text = fetch_url(xml_url, headers=XML_HEADERS)
            if not xml_text:
                print("    [Could not fetch XML — skipping]", flush=True)
                fetch_err += 1
                time.sleep(0.5)
                continue

            filing = parse_form4_xml(xml_text, entry)
            if not filing:
                print("    [No transactions in XML — skipping]", flush=True)
                no_tx += 1
                time.sleep(0.5)
                continue

            # Only mark seen AFTER a successful parse so failures are retried next cycle
            seen[filing_id] = True

            for summary in filing["summaries"]:
                print(f"    {summary}", flush=True)

            all_filings.append(filing)
            new_count += 1

            # SEC rate limit: ~8 req/sec max, we stay well under
            time.sleep(0.75)

        # Save progress after each cycle
        save_json_file(OUTPUT_FILE, all_filings)
        if not args.once:
            # Only persist seen_filings.json in loop mode — CI starts fresh each run
            save_json_file(SEEN_FILE, seen)

        print(
            f"  ✓ Cycle summary: {new_count} saved | {skipped_seen} already-seen | "
            f"{no_xml} no-xml | {no_tx} no-tx | {fetch_err} fetch-err",
            flush=True,
        )

        if args.once:
            print("  --once flag set — exiting after one cycle.")
            break

        print(f"  Waiting {POLL_INTERVAL_SECONDS}s before next check...\n")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        run_pipeline()
    except KeyboardInterrupt:
        print("\n\nPipeline stopped. Data saved.")
