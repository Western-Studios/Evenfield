"""
Evenfield - Phase 2 Enrichment Layer
Calls Claude to generate plain-English summaries and signal scores.
Handles both insider (Form 4) and congressional STOCK Act filings.

Usage:
  python enrichment.py              # process both
  python enrichment.py insider      # only Form 4 filings
  python enrichment.py congressional # only congressional trades
"""

import io
import json
import os
import sys
import time
from pathlib import Path

import anthropic

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Startup diagnostics ───────────────────────────────────────────────────────
print(f"Working directory: {os.getcwd()}", flush=True)
print(f"Files present: {os.listdir('.')}", flush=True)

# ── Configuration ─────────────────────────────────────────────────────────────

INSIDER_INPUT    = "evenfield_filings.json"
INSIDER_OUTPUT   = "evenfield_enriched.json"
CONGRESS_INPUT   = "congressional_filings.json"
CONGRESS_OUTPUT  = "congressional_enriched.json"

MODEL = "claude-sonnet-4-6"

# ── Schemas ────────────────────────────────────────────────────────────────────

ENRICHMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "plain_english":  {"type": "string",  "description": "2-3 sentence plain English story for a casual investor, no jargon"},
        "signal_score":   {"type": "integer", "description": "1-10 significance rating (10 = very significant)"},
        "signal_reason":  {"type": "string",  "description": "One sentence explaining the score"},
        "flags":          {"type": "array",   "items": {"type": "string"}, "description": "Patterns detected"},
    },
    "required": ["plain_english", "signal_score", "signal_reason", "flags"],
    "additionalProperties": False,
}

# ── System prompts ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT_INSIDER = """\
You are a financial analyst who explains SEC insider trading filings to everyday investors.
Analyze the Form 4 filing data provided and return a JSON assessment.

Return ONLY a valid JSON object — no markdown fences, no preamble, no text outside the JSON.

Signal score 1-10 guidelines:
  1-3  Low: routine stock awards ($0 price), tax withholding (F code), tiny amounts
  4-6  Moderate: scheduled 10b5-1 sales, options exercises, small open-market trades
  7-8  High: significant open-market buys or sells, large dollar value, multiple insiders
  9-10 Very high: massive CEO open-market purchase, cluster buying, unusual size vs holdings

Flags to consider (use exact strings when applicable):
  "open-market purchase"         — acquired shares with real cash (high conviction signal)
  "open-market sale"             — sold shares on the open market
  "stock award"                  — $0-price grant, compensation not conviction
  "tax withholding"              — F code, routine, low signal
  "options exercise"             — M or X code
  "large relative to holdings"   — transaction is big compared to shares_after
  "near earnings"                — if filing date is within ~4 weeks of a typical earnings window
  "cluster buying"               — multiple insiders buying the same stock
  "congressional trade"          — if the filer is a member of Congress
  "10b5-1 plan"                  — pre-scheduled, lowers conviction signal
  "derivative transaction"       — phantom shares, RSUs, options rather than common stock
"""

SYSTEM_PROMPT_CONGRESSIONAL = """\
You are a political accountability journalist explaining congressional stock trades to voters.
Analyze this STOCK Act trade disclosure and return a JSON assessment.

Return ONLY a valid JSON object — no markdown fences, no preamble, no text outside the JSON.

This is a congressional stock trade disclosure. Consider:
- The politician's committee assignments and whether they overlap with the traded company's sector
- Disclosure timing: STOCK Act requires reporting within 45 days; late disclosure is a red flag
- Trade size relative to a politician's reported salary (~$174K/year for members of Congress)
- Whether the trade timing aligns with relevant legislation, budget votes, or government contracts
- Pattern signals: buying into a company their committee oversees raises conflict-of-interest concerns

Write for a voter and everyday investor who wants to understand what their representative is
doing with their money. Be factual, not inflammatory — but don't soften genuine red flags.

Signal score 1-10 guidelines:
  1-3  Low: small amount (<$15K), no committee overlap, timely disclosure, unrelated sector
  4-6  Moderate: medium amount ($15K-$100K), minor committee overlap, or slight delay
  7-8  High: large amount (>$100K), committee overlap, or significant late disclosure (>45 days)
  9-10 Very high: major conflict of interest, extremely late disclosure, timing suspicious near legislation

Flags to consider (use exact strings):
  "open-market purchase"   — bought stock with personal money
  "open-market sale"       — sold stock on open market
  "late-disclosure"        — reported more than 30 days after trade
  "committee-conflict"     — traded in company related to their committee assignments
  "large-amount"           — transaction ≥ $100,000
  "congressional-trade"    — always include this
  "near-legislation"       — trade timing raises potential access-to-information concerns
"""

# ── Prompt builders ────────────────────────────────────────────────────────────

def build_insider_prompt(filing: dict) -> str:
    lines = [
        f"Company:  {filing.get('company', 'Unknown')} ({filing.get('ticker', '?')})",
        f"Insider:  {filing.get('owner', 'Unknown')} — {filing.get('role', 'Insider')}",
        f"Filed:    {filing.get('filed_at', 'Unknown')}",
        "",
        "Transactions:",
    ]
    for tx in filing.get("transactions", []):
        direction = "ACQUIRED" if tx.get("acquired_disposed") == "A" else "DISPOSED"
        price     = tx.get("price", "")
        price_str = f" at ${float(price):,.2f}/share" if price and float(price) > 0 else " (no cash price)"
        total     = tx.get("total_value", "")
        total_str = f" | total ~${float(total):,.0f}" if total and float(total) > 0 else ""
        after     = tx.get("shares_after", "")
        after_str = f" | {float(after):,.0f} shares owned after" if after else ""
        lines.append(
            f"  [{tx.get('type','?')}] {direction}: {tx.get('verb','transacted')} "
            f"{tx.get('shares','?')} {tx.get('security','shares')}"
            f"{price_str}{total_str} on {tx.get('date','?')}{after_str}"
        )
    return "\n".join(lines)


def build_congressional_prompt(filing: dict) -> str:
    direction = "PURCHASED" if filing.get("acquired_disposed") == "A" else "SOLD"
    committees = ", ".join(filing.get("committees") or []) or "Not disclosed"
    days = filing.get("days_to_disclosure")
    days_str = f"{days} days" if days is not None else "unknown"
    late = " ⚠️ LATE" if days is not None and days > 30 else ""

    lines = [
        f"Politician:   {filing.get('politician', 'Unknown')}",
        f"Party:        {filing.get('party', 'Unknown')}",
        f"Chamber:      {filing.get('chamber', 'Unknown')}",
        f"Committees:   {committees}",
        "",
        f"Trade:        {direction} {filing.get('ticker', '?')} ({filing.get('company', '?')})",
        f"Amount range: {filing.get('amount_range', 'Unknown')}",
        f"Trade date:   {filing.get('trade_date', 'Unknown')}",
        f"Disclosed:    {filing.get('disclosure_date', 'Unknown')} ({days_str} after trade{late})",
        "",
        f"Existing flags: {', '.join(filing.get('flags', []))}",
    ]
    return "\n".join(lines)


# ── API call ───────────────────────────────────────────────────────────────────

def enrich_filing(client: anthropic.Anthropic, filing: dict, mode: str) -> dict | None:
    if mode == "congressional":
        prompt      = build_congressional_prompt(filing)
        system      = SYSTEM_PROMPT_CONGRESSIONAL
        user_msg    = "Analyze this congressional STOCK Act trade disclosure and return your JSON assessment:\n\n" + prompt
    else:
        prompt      = build_insider_prompt(filing)
        system      = SYSTEM_PROMPT_INSIDER
        user_msg    = "Analyze this Form 4 insider trading filing and return your JSON assessment:\n\n" + prompt

    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=system,
        output_config={
            "format": {
                "type":   "json_schema",
                "schema": ENRICHMENT_SCHEMA,
            }
        },
        messages=[{"role": "user", "content": user_msg}],
    )
    text = next((b.text for b in response.content if b.type == "text"), None)
    return json.loads(text) if text else None


# ── Per-mode runner ────────────────────────────────────────────────────────────

def run_mode(client: anthropic.Anthropic, mode: str) -> None:
    input_file  = INSIDER_INPUT  if mode == "insider" else CONGRESS_INPUT
    output_file = INSIDER_OUTPUT if mode == "insider" else CONGRESS_OUTPUT
    label       = "Form 4 Insider" if mode == "insider" else "Congressional"

    filings = []
    try:
        filings = json.loads(Path(input_file).read_text(encoding="utf-8"))
    except Exception:
        print(f"  {input_file} not found — skipping {label} enrichment.")
        return

    if not filings:
        print(f"  No filings in {input_file}.")
        return

    enriched: list[dict] = []
    try:
        enriched = json.loads(Path(output_file).read_text(encoding="utf-8"))
    except Exception:
        pass

    seen_ids: set[str] = {e["id"] for e in enriched if "id" in e}
    pending = [f for f in filings if f.get("id") not in seen_ids]

    print(f"\n  ── {label} ({input_file})")
    print(f"     {len(filings)} total | {len(seen_ids)} done | {len(pending)} to process\n")

    if not pending:
        print("     All enriched — nothing to do.")
        return

    processed = errors = 0

    for i, filing in enumerate(pending, 1):
        ticker = filing.get("ticker", "?")
        name   = filing.get("politician") or filing.get("owner") or "Unknown"
        print(f"  [{i:02d}/{len(pending):02d}] {ticker:6}  {name}")

        try:
            enrichment = enrich_filing(client, filing, mode)
        except anthropic.RateLimitError:
            print("  ⚠ Rate limited — waiting 60s…")
            time.sleep(60)
            errors += 1
            continue
        except (anthropic.APIError, json.JSONDecodeError) as e:
            print(f"  ✗ {type(e).__name__}: {e}")
            errors += 1
            continue

        if not enrichment:
            print("  ✗ Empty response — skipping")
            errors += 1
            continue

        score  = enrichment.get("signal_score", 0)
        filled = "█" * score + "░" * (10 - score) if isinstance(score, int) else ""
        flags  = enrichment.get("flags", [])

        print(f"     Signal {score:2d}/10  {filled}")
        print(f"     {enrichment.get('plain_english', '')[:120]}")
        if flags:
            print(f"     Flags: {', '.join(flags)}")
        print()

        record = {
            "id":           filing["id"],
            "source_type":  filing.get("source_type", "insider"),
            "ticker":       ticker,
            "company":      filing.get("company", ""),
            "owner":        filing.get("owner", ""),
            "politician":   filing.get("politician", ""),
            "party":        filing.get("party", ""),
            "chamber":      filing.get("chamber", ""),
            "role":         filing.get("role", "Insider"),
            "filed_at":     filing.get("filed_at"),
            "trade_date":   filing.get("trade_date", ""),
            "disclosure_date": filing.get("disclosure_date", ""),
            "days_to_disclosure": filing.get("days_to_disclosure"),
            "amount_range": filing.get("amount_range", ""),
            "acquired_disposed": filing.get("acquired_disposed", ""),
            "transactions": filing.get("transactions", []),
            "source_url":   filing.get("source_url"),
            **enrichment,
        }
        enriched.append(record)
        seen_ids.add(filing["id"])

        Path(output_file).write_text(json.dumps(enriched, indent=2, default=str), encoding="utf-8")
        processed += 1

        if i < len(pending):
            time.sleep(0.4)

    print(f"  {'─' * 50}")
    print(f"  {label}: {processed} enriched, {errors} errors → {output_file}")


# ── Main ───────────────────────────────────────────────────────────────────────

def run_enrichment(modes: list[str]) -> None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable not set.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    print(f"\n{'═' * 62}")
    print("  EVENFIELD — Enrichment Layer")
    print(f"  Model: {MODEL}  |  Modes: {', '.join(modes)}")
    print(f"{'═' * 62}")

    for mode in modes:
        run_mode(client, mode)

    print(f"\n{'═' * 62}")
    print("  Enrichment complete.\n")


if __name__ == "__main__":
    arg = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    if arg == "insider":
        run_enrichment(["insider"])
    elif arg == "congressional":
        run_enrichment(["congressional"])
    else:
        run_enrichment(["insider", "congressional"])
