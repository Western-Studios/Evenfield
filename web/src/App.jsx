import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase, authEnabled } from './lib/supabase'
import { SummaryChartsSection, AnalyticsView, DEFAULT_ANALYTICS_FILTERS, DrillDownModal } from './Charts'

// ── Icons ──────────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="16" height="1.6" rx="0.8" fill="currentColor"/>
      <rect x="2" y="9.2" width="16" height="1.6" rx="0.8" fill="currentColor"/>
      <rect x="2" y="13.9" width="16" height="1.6" rx="0.8" fill="currentColor"/>
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
function ExternalLinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
      style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 3 }}>
      <path d="M1 9L9 1M9 1H3.5M9 1V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function LockIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1.5" y="5.5" width="9" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3.5 5.5V3.5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}
function StarIcon({ filled }) {
  return filled ? (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1L9.4 5.5H14L10.5 8.5L11.9 13L7.5 10.3L3.1 13L4.5 8.5L1 5.5H5.6L7.5 1Z"
        fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1L9.4 5.5H14L10.5 8.5L11.9 13L7.5 10.3L3.1 13L4.5 8.5L1 5.5H5.6L7.5 1Z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M6.5 5.5v4M6.5 3.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="11" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="3" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="11" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4.7 6.1L9.3 3.9M4.7 7.9L9.3 10.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="1"   y="6.5" width="2.5" height="5.5" rx="0.5" fill="currentColor" opacity="0.55"/>
      <rect x="5.2" y="3.5" width="2.5" height="8.5" rx="0.5" fill="currentColor" opacity="0.75"/>
      <rect x="9.5" y="1"   width="2.5" height="11"  rx="0.5" fill="currentColor"/>
    </svg>
  )
}
function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M2.9 13.1l1.4-1.4M11.7 4.3l1.4-1.4"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function TrendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 12L5 7L8 10L11 5L15 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 5h3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function signalColor(score) {
  if (score >= 8) return 'badge-red'
  if (score >= 5) return 'badge-yellow'
  return 'badge-grey'
}
function signalLabel(score) {
  if (score >= 8) return 'HIGH SIGNAL'
  if (score >= 5) return 'MODERATE'
  return 'ROUTINE'
}
function flagColor(flag) {
  if (flag.includes('purchase') || flag.includes('buy')) return 'pill-green'
  if (flag.includes('sale') || flag.includes('sell')) return 'pill-red'
  if (flag.includes('late') || flag.includes('conflict')) return 'pill-orange'
  if (flag.includes('award') || flag.includes('withholding') || flag.includes('derivative')) return 'pill-grey'
  return 'pill-blue'
}
function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatAmount(v) {
  const n = parseFloat(v)
  if (isNaN(n)) return String(v)
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}
function partyColor(party) {
  const p = (party || '').toLowerCase()
  if (p.includes('dem') || p === 'd') return 'party-dem'
  if (p.includes('rep') || p === 'r') return 'party-rep'
  return 'party-ind'
}
function partyLetter(party) {
  const p = (party || '').toLowerCase()
  if (p.includes('dem') || p === 'd') return 'D'
  if (p.includes('rep') || p === 'r') return 'R'
  return 'I'
}
function initials(email) {
  if (!email) return '?'
  return email[0].toUpperCase()
}
function timeAgo(date) {
  if (!date) return null
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
function friendlyAuthError(err) {
  const msg = (err?.message || '').toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) return 'Incorrect email or password.'
  if (msg.includes('email not confirmed')) return 'Please confirm your email address first.'
  if (msg.includes('user already registered') || msg.includes('already been registered')) return 'An account with this email already exists.'
  if (msg.includes('password should be at least') || msg.includes('password is too short')) return 'Password must be at least 6 characters.'
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) return 'Please enter a valid email address.'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts — please wait a moment and try again.'
  if (msg.includes('network') || msg.includes('fetch')) return 'Connection error — please check your internet and try again.'
  return err?.message || 'Something went wrong. Please try again.'
}

const DEFAULT_SETTINGS = {
  defaultTab:   'insider',
  defaultSort:  'newest',
  cardsPerPage: 50,
  compactMode:  false,
  theme:        'dark',
  alertThreshold: 7,
  hideRoutine:  false,
  defaultScoreMin: 1,
}

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('ef_settings') || '{}') } }
  catch { return { ...DEFAULT_SETTINGS } }
}
function saveSettings(s) {
  try { localStorage.setItem('ef_settings', JSON.stringify(s)) } catch {}
}

const DEFAULT_PANEL = {
  companies: [],
  persons: [],
  roles: [],
  direction: 'all',
  scoreMin: 1,
  scoreMax: 10,
}

const ROLE_OPTIONS = ['CEO', 'CFO', 'COO', 'Director', '10% Owner', 'Other Officer']

function matchRole(filingRole, selectedRoles) {
  if (!selectedRoles.length) return true
  const r = (filingRole || '').toLowerCase()
  return selectedRoles.some(role => {
    const rl = role.toLowerCase()
    if (rl === 'ceo')         return r.includes('ceo') || r.includes('chief executive')
    if (rl === 'cfo')         return r.includes('cfo') || r.includes('chief financial')
    if (rl === 'coo')         return r.includes('coo') || r.includes('chief operating')
    if (rl === 'director')    return r.includes('director')
    if (rl === '10% owner')   return r.includes('10%') || r.includes('owner')
    if (rl === 'other officer') return r.includes('officer') && !r.includes('chief')
    return false
  })
}

function sortFilings(items, sortOrder) {
  const arr = [...items]
  switch (sortOrder) {
    case 'newest':   return arr.sort((a, b) => new Date(b.filed_at || b.trade_date || b.date || 0) - new Date(a.filed_at || a.trade_date || a.date || 0))
    case 'signal':   return arr.sort((a, b) => (b.signal_score || 0) - (a.signal_score || 0))
    case 'amount':   return arr.sort((a, b) => (b.amount || 0) - (a.amount || 0))
    case 'disclosed': return arr.sort((a, b) => new Date(b.disclosure_date || b.filed_at || 0) - new Date(a.disclosure_date || a.filed_at || 0))
    default:         return arr
  }
}

function applySearch(items, q) {
  if (!q || q.length < 2) return items
  const ql = q.toLowerCase()
  return items.filter(f => {
    const fields = [f.ticker, f.company, f.owner, f.politician, f.plain_english, f.recipient, f.agency]
    return fields.some(v => v && v.toLowerCase().includes(ql))
  })
}

function applyPanelFilters(items, pf, type) {
  let result = items
  if (pf.companies.length) {
    result = result.filter(f => pf.companies.some(c => {
      const cl = c.toLowerCase()
      return (f.ticker || '').toLowerCase() === cl
        || (f.company || '').toLowerCase().includes(cl)
        || (f.recipient || '').toLowerCase().includes(cl)
    }))
  }
  if (pf.persons.length) {
    result = result.filter(f => pf.persons.some(p => {
      const pl = p.toLowerCase()
      return (f.owner || '').toLowerCase().includes(pl)
        || (f.politician || '').toLowerCase().includes(pl)
    }))
  }
  if (pf.roles.length && type === 'insider') {
    result = result.filter(f => matchRole(f.role, pf.roles))
  }
  if (pf.direction !== 'all') {
    result = result.filter(f =>
      pf.direction === 'buy' ? f.acquired_disposed === 'A' : f.acquired_disposed === 'D'
    )
  }
  if (pf.scoreMin > 1 || pf.scoreMax < 10) {
    result = result.filter(f => {
      const s = f.signal_score || 0
      return s >= pf.scoreMin && s <= pf.scoreMax
    })
  }
  return result
}

function countActivePanelFilters(pf) {
  let n = 0
  n += pf.companies.length
  n += pf.persons.length
  if (pf.roles.length) n++
  if (pf.direction !== 'all') n++
  if (pf.scoreMin > 1 || pf.scoreMax < 10) n++
  return n
}

// ── Watchlist hook ─────────────────────────────────────────────────────────────

function useWatchlist(user) {
  const [watchlist, setWatchlist] = useState([])
  useEffect(() => {
    if (user && supabase) {
      supabase.from('watchlist').select('ticker').then(({ data }) => {
        const fromDB = (data || []).map(r => r.ticker)
        let local = []
        try { local = JSON.parse(localStorage.getItem('ef_watchlist') || '[]') } catch {}
        const toAdd = local.filter(t => !fromDB.includes(t))
        if (toAdd.length > 0) {
          supabase.from('watchlist').insert(toAdd.map(ticker => ({ user_id: user.id, ticker }))).then(() => {})
          localStorage.removeItem('ef_watchlist')
        }
        setWatchlist([...new Set([...fromDB, ...local])])
      })
    } else {
      try { setWatchlist(JSON.parse(localStorage.getItem('ef_watchlist') || '[]')) }
      catch { setWatchlist([]) }
    }
  }, [user])

  const toggle = async (ticker) => {
    const inList = watchlist.includes(ticker)
    if (user && supabase) {
      setWatchlist(prev => inList ? prev.filter(t => t !== ticker) : [...prev, ticker])
      if (inList) await supabase.from('watchlist').delete().eq('user_id', user.id).eq('ticker', ticker)
      else await supabase.from('watchlist').insert({ user_id: user.id, ticker })
    } else {
      setWatchlist(prev => {
        const next = inList ? prev.filter(t => t !== ticker) : [...prev, ticker]
        try { localStorage.setItem('ef_watchlist', JSON.stringify(next)) } catch {}
        return next
      })
    }
  }
  return [watchlist, toggle]
}

// ── Score Pips ─────────────────────────────────────────────────────────────────

function ScorePips({ score }) {
  const cls = score >= 8 ? 'pip-red' : score >= 5 ? 'pip-yellow' : 'pip-grey'
  return (
    <div className="score-bar">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className={`score-pip ${i < score ? cls : 'pip-empty'}`} />
      ))}
    </div>
  )
}

// ── Score Tooltip Wrapper ──────────────────────────────────────────────────────

function ScoreBlock({ score }) {
  return (
    <div className="score-block">
      <div className="score-tooltip-wrap">
        <div className={`score-badge ${signalColor(score)}`}>
          <span className="score-number">{score}</span>
          <span className="score-denom">/10</span>
          <span className="score-info-icon"><InfoIcon /></span>
        </div>
        <div className="score-tooltip" role="tooltip">
          <strong>Signal Score</strong><br/>
          Rates how significant this filing is.<br/>
          10 = major signal (large trade, senior executive, unusual timing).<br/>
          1 = routine (standard compensation award, small position).
        </div>
      </div>
      <div className="score-label">{signalLabel(score)}</div>
      <ScorePips score={score} />
    </div>
  )
}

// ── Watch Button ───────────────────────────────────────────────────────────────

function WatchButton({ ticker, watchlist, onToggle }) {
  if (!ticker) return null
  const watched = watchlist.includes(ticker)
  return (
    <button className={`watch-btn ${watched ? 'watched' : ''}`}
      onClick={e => { e.stopPropagation(); onToggle(ticker) }}
      title={watched ? `Unwatch ${ticker}` : `Watch ${ticker}`}
      aria-label={watched ? `Unwatch ${ticker}` : `Watch ${ticker}`}>
      <StarIcon filled={watched} />
    </button>
  )
}

// ── Share Button ───────────────────────────────────────────────────────────────

function ShareButton({ filingId }) {
  const [copied, setCopied] = useState(false)
  const handleShare = useCallback((e) => {
    e.stopPropagation()
    const url = `${window.location.origin}${window.location.pathname}?filing=${filingId}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } else {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.focus(); ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [filingId])

  return (
    <div className="share-wrap">
      <button className="share-btn" onClick={handleShare} title="Copy link to this filing" aria-label="Share filing">
        <ShareIcon />
      </button>
      {copied && <span className="share-toast">Link copied!</span>}
    </div>
  )
}

// ── Multi-Select ───────────────────────────────────────────────────────────────

function MultiSelect({ placeholder, options, selected, onAdd, onRemove, renderOption }) {
  const [inputVal, setInputVal] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef()

  const suggestions = useMemo(() =>
    options.filter(opt => {
      const label = typeof opt === 'string' ? opt : opt.label
      return label.toLowerCase().includes(inputVal.toLowerCase()) && !selected.includes(typeof opt === 'string' ? opt : opt.value)
    }).slice(0, 10)
  , [options, inputVal, selected])

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="multi-select" ref={wrapRef}>
      <div className="multi-select-field" onClick={() => setOpen(true)}>
        {selected.map(s => (
          <span key={s} className="multi-select-pill">
            {s}
            <button type="button" className="multi-select-pill-x" onClick={e => { e.stopPropagation(); onRemove(s) }}>×</button>
          </span>
        ))}
        <input
          className="multi-select-input"
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="multi-select-dropdown">
          {suggestions.map(opt => {
            const value = typeof opt === 'string' ? opt : opt.value
            const label = typeof opt === 'string' ? opt : opt.label
            return (
              <div key={value} className="multi-select-option"
                onMouseDown={e => { e.preventDefault(); onAdd(value); setInputVal(''); setOpen(false) }}>
                {renderOption ? renderOption(opt) : label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Insider Filing Card ────────────────────────────────────────────────────────

function FilingCard({ filing, watchlist, onToggleWatch, highlighted, onDrillDown }) {
  const { id, ticker, company, owner, role, plain_english, signal_reason, signal_score, flags, filed_at, source_url } = filing
  const cardRef = useRef()
  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlighted])

  return (
    <article id={id} ref={cardRef}
      className={`card ${signal_score >= 8 ? 'card-high' : ''} ${highlighted ? 'card-highlighted' : ''}`}>
      <div className="card-top">
        <div className="card-header">
          <div className="ticker-row">
            <span className="ticker">{ticker}</span>
            <span className="company-name">{company}</span>
            <WatchButton ticker={ticker} watchlist={watchlist} onToggle={onToggleWatch} />
          </div>
          <div className="insider-row">
            <span className="owner">{owner}</span>
            {role && <span className="role">{role}</span>}
          </div>
        </div>
        <div className="card-top-right">
          <button className="chart-drill-btn" title="View charts for this filing"
            aria-label="View charts" onClick={e => { e.stopPropagation(); onDrillDown('insider', filing) }}>
            <ChartIcon />
          </button>
          <ShareButton filingId={id} />
          <ScoreBlock score={signal_score} />
        </div>
      </div>
      <p className="story">{plain_english}</p>
      {signal_reason && (
        <p className="reason"><span className="reason-label">Why this score: </span>{signal_reason}</p>
      )}
      <div className="card-footer">
        <div className="flags">
          {flags?.map(flag => <span key={flag} className={`pill ${flagColor(flag)}`}>{flag}</span>)}
        </div>
        <div className="footer-right">
          <time className="filed-date" dateTime={filed_at}>Filed {formatDate(filed_at)}</time>
          {source_url && (
            <a href={source_url} target="_blank" rel="noopener noreferrer" className="source-link">
              SEC Filing <ExternalLinkIcon />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

// ── Congressional Card ─────────────────────────────────────────────────────────

function CongressCard({ filing, watchlist, onToggleWatch, highlighted, onDrillDown }) {
  const {
    id, politician, party, chamber, ticker, company, acquired_disposed,
    amount_range, trade_date, days_to_disclosure,
    plain_english, signal_reason, signal_score, flags, source_url,
  } = filing
  const isBuy       = acquired_disposed === 'A'
  const isLate      = days_to_disclosure != null && days_to_disclosure > 30
  const hasConflict = flags?.includes('committee-conflict')
  const scored      = typeof signal_score === 'number'
  const cardRef     = useRef()

  useEffect(() => {
    if (highlighted && cardRef.current) cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted])

  return (
    <article id={id} ref={cardRef}
      className={`card congress-card ${signal_score >= 8 ? 'card-high' : ''} ${highlighted ? 'card-highlighted' : ''}`}>
      <div className="card-top">
        <div className="card-header">
          <div className="congress-meta-row">
            <span className={`party-badge ${partyColor(party)}`}>{partyLetter(party)}</span>
            {chamber && <span className="chamber-badge">{chamber}</span>}
            {isLate     && <span className="flag-badge flag-late">⚠ Late Disclosure</span>}
            {hasConflict && <span className="flag-badge flag-conflict">⚠ Committee Conflict</span>}
          </div>
          <div className="ticker-row" style={{ marginTop: 6 }}>
            <span className="politician-name">{politician}</span>
            <WatchButton ticker={ticker} watchlist={watchlist} onToggle={onToggleWatch} />
          </div>
          <div className="insider-row">
            {ticker && <span className="ticker-sm">{ticker}</span>}
            {company && ticker && company !== ticker && <span className="company-name">{company}</span>}
            <span className={`direction-badge ${isBuy ? 'dir-buy' : 'dir-sell'}`}>
              {isBuy ? '▲ BUY' : '▼ SELL'}
            </span>
            {amount_range && <span className="amount-range">{amount_range}</span>}
          </div>
        </div>
        <div className="card-top-right">
          <button className="chart-drill-btn" title="View charts for this filing"
            aria-label="View charts" onClick={e => { e.stopPropagation(); onDrillDown('congress', filing) }}>
            <ChartIcon />
          </button>
          <ShareButton filingId={id} />
          {scored && <ScoreBlock score={signal_score} />}
        </div>
      </div>
      {plain_english && <p className="story">{plain_english}</p>}
      {signal_reason && (
        <p className="reason"><span className="reason-label">Why this score: </span>{signal_reason}</p>
      )}
      <div className="card-footer">
        <div className="flags">
          {flags?.filter(f => !['congressional-trade','open-market purchase','open-market sale'].includes(f))
            .map(flag => <span key={flag} className={`pill ${flagColor(flag)}`}>{flag}</span>)}
        </div>
        <div className="footer-right">
          <div className="disclosure-dates">
            {trade_date && <span className="filed-date">Traded {formatDate(trade_date)}</span>}
            {days_to_disclosure != null && (
              <span className={`disclosure-lag ${isLate ? 'lag-late' : ''}`}>
                Disclosed {days_to_disclosure}d later
              </span>
            )}
          </div>
          {source_url && (
            <a href={source_url} target="_blank" rel="noopener noreferrer" className="source-link">
              Disclosure <ExternalLinkIcon />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

// ── Contract Card ──────────────────────────────────────────────────────────────

function ContractCard({ contract, highlighted, onDrillDown }) {
  const { id, recipient, amount_fmt, agency, date, description, insider_tickers } = contract
  const hasInsider = insider_tickers && insider_tickers.length > 0
  const cardRef = useRef()
  useEffect(() => {
    if (highlighted && cardRef.current) cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted])

  return (
    <article id={id} ref={cardRef}
      className={`card contract-card ${hasInsider ? 'card-insider-cross' : ''} ${highlighted ? 'card-highlighted' : ''}`}>
      <div className="card-top">
        <div className="card-header" style={{ flex: 1 }}>
          <div className="ticker-row">
            <span className="contract-company">{recipient}</span>
            {hasInsider && (
              <span className="insider-cross-badge">📈 Insider: {insider_tickers.join(', ')}</span>
            )}
          </div>
          <div className="insider-row">
            <span className="role">{agency}</span>
            {date && <span className="filed-date" style={{ marginLeft: 8 }}>{formatDate(date)}</span>}
          </div>
        </div>
        <div className="card-top-right">
          <button className="chart-drill-btn" title="View charts for this contract"
            aria-label="View charts" onClick={e => { e.stopPropagation(); onDrillDown('contracts', contract) }}>
            <ChartIcon />
          </button>
          <ShareButton filingId={id} />
          <div className="contract-amount-block">
            <span className="contract-amount">{amount_fmt || formatAmount(contract.amount)}</span>
            <span className="score-label">CONTRACT</span>
          </div>
        </div>
      </div>
      {description && <p className="contract-desc">{description}</p>}
    </article>
  )
}

// ── Search Bar ─────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange, totalCount }) {
  const inputRef = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onChange('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onChange])

  const active = value.length >= 2
  return (
    <div className={`search-bar ${active ? 'search-bar-active' : ''}`}>
      <span className="search-icon"><SearchIcon /></span>
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        placeholder="Search by ticker, company, or name… (press / to focus)"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Search filings"
      />
      {active && (
        <span className="search-count">{totalCount} result{totalCount !== 1 ? 's' : ''}</span>
      )}
      {value && (
        <button className="search-clear" onClick={() => { onChange(''); inputRef.current?.focus() }} aria-label="Clear search">
          <XIcon />
        </button>
      )}
      {!value && <span className="search-shortcut">/</span>}
    </div>
  )
}

// ── Filter Panel ───────────────────────────────────────────────────────────────

function FilterPanel({ open, panelFilters, setPanelFilters, activeTab,
    companyOptions, personOptions, congressPartyMap }) {
  if (!open) return null

  const pf = panelFilters
  const set = (key, val) => setPanelFilters(prev => ({ ...prev, [key]: val }))

  const showDirection = activeTab === 'insider' || activeTab === 'congress'
  const showRoles     = activeTab === 'insider'
  const showPerson    = activeTab !== 'contracts'

  return (
    <div className="filter-panel">
      <div className="filter-panel-grid">

        {/* Company / Ticker */}
        <div className="filter-panel-section">
          <div className="filter-panel-label">
            {activeTab === 'contracts' ? 'Recipient Company' : 'Company / Ticker'}
          </div>
          <MultiSelect
            placeholder={activeTab === 'contracts' ? 'Filter by company…' : 'Ticker or company…'}
            options={companyOptions}
            selected={pf.companies}
            onAdd={v => set('companies', [...pf.companies, v])}
            onRemove={v => set('companies', pf.companies.filter(c => c !== v))}
          />
        </div>

        {/* Person */}
        {showPerson && (
          <div className="filter-panel-section">
            <div className="filter-panel-label">
              {activeTab === 'congress' ? 'Politician' : 'Insider Name'}
            </div>
            <MultiSelect
              placeholder="Search by name…"
              options={personOptions}
              selected={pf.persons}
              onAdd={v => set('persons', [...pf.persons, v])}
              onRemove={v => set('persons', pf.persons.filter(p => p !== v))}
              renderOption={activeTab === 'congress' ? (opt) => {
                const party = congressPartyMap[opt] || 'I'
                return (
                  <span className="ms-option-person">
                    <span className={`party-badge ${partyColor(party)}`} style={{ width: 18, height: 18, fontSize: 10 }}>{partyLetter(party)}</span>
                    {opt}
                  </span>
                )
              } : null}
            />
          </div>
        )}

        {/* Role (Insider only) */}
        {showRoles && (
          <div className="filter-panel-section">
            <div className="filter-panel-label">Role</div>
            <div className="role-checkboxes">
              {ROLE_OPTIONS.map(role => (
                <label key={role} className="role-checkbox-item">
                  <input type="checkbox"
                    checked={pf.roles.includes(role)}
                    onChange={e => {
                      if (e.target.checked) set('roles', [...pf.roles, role])
                      else set('roles', pf.roles.filter(r => r !== role))
                    }}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Direction */}
        {showDirection && (
          <div className="filter-panel-section">
            <div className="filter-panel-label">Direction</div>
            <div className="direction-toggle">
              {[['all', 'All'], ['buy', 'Buys only'], ['sell', 'Sells only']].map(([val, label]) => (
                <button key={val} type="button"
                  className={`direction-btn ${pf.direction === val ? 'active' : ''}`}
                  onClick={() => set('direction', val)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Signal Score Range */}
        <div className="filter-panel-section">
          <div className="filter-panel-label">
            Signal Score
            <span className="score-range-label">
              {pf.scoreMin === 1 && pf.scoreMax === 10 ? 'Any' : `${pf.scoreMin}–${pf.scoreMax}`}
            </span>
          </div>
          <div className="score-range">
            <div className="score-range-row">
              <span className="score-range-endpoint">Min: {pf.scoreMin}</span>
              <input type="range" min="1" max="10" value={pf.scoreMin}
                className="score-range-input"
                onChange={e => {
                  const v = parseInt(e.target.value)
                  set('scoreMin', Math.min(v, pf.scoreMax))
                }}
              />
            </div>
            <div className="score-range-row">
              <span className="score-range-endpoint">Max: {pf.scoreMax}</span>
              <input type="range" min="1" max="10" value={pf.scoreMax}
                className="score-range-input"
                onChange={e => {
                  const v = parseInt(e.target.value)
                  set('scoreMax', Math.max(v, pf.scoreMin))
                }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Active Filter Pills ────────────────────────────────────────────────────────

function ActiveFilterPills({ panelFilters, setPanelFilters, searchQuery, setSearchQuery }) {
  const pf = panelFilters
  const set = (key, val) => setPanelFilters(prev => ({ ...prev, [key]: val }))
  const pills = []

  if (searchQuery.length >= 2) {
    pills.push({ key: '__search', label: `"${searchQuery}"`, onRemove: () => setSearchQuery('') })
  }
  pf.companies.forEach(c => pills.push({ key: `c:${c}`, label: c, onRemove: () => set('companies', pf.companies.filter(x => x !== c)) }))
  pf.persons.forEach(p => pills.push({ key: `p:${p}`, label: p, onRemove: () => set('persons', pf.persons.filter(x => x !== p)) }))
  if (pf.roles.length) pills.push({ key: 'roles', label: pf.roles.join(', '), onRemove: () => set('roles', []) })
  if (pf.direction !== 'all') pills.push({ key: 'dir', label: pf.direction === 'buy' ? 'Buys only' : 'Sells only', onRemove: () => set('direction', 'all') })
  if (pf.scoreMin > 1 || pf.scoreMax < 10) pills.push({ key: 'score', label: `Score: ${pf.scoreMin}–${pf.scoreMax}`, onRemove: () => { set('scoreMin', 1); set('scoreMax', 10) } })

  if (!pills.length) return null

  const clearAll = () => {
    setPanelFilters({ ...DEFAULT_PANEL })
    setSearchQuery('')
  }

  return (
    <div className="active-pills">
      {pills.map(pill => (
        <span key={pill.key} className="active-pill">
          {pill.label}
          <button className="active-pill-x" onClick={pill.onRemove} aria-label={`Remove ${pill.label} filter`}>×</button>
        </span>
      ))}
      <button className="clear-all-link" onClick={clearAll}>Clear all</button>
    </div>
  )
}

// ── Sort Dropdown ──────────────────────────────────────────────────────────────

function SortDropdown({ value, onChange }) {
  return (
    <div className="sort-wrap">
      <select className="sort-select" value={value}
        onChange={e => { onChange(e.target.value); try { localStorage.setItem('ef_sort', e.target.value) } catch {} }}>
        <option value="newest">Newest first</option>
        <option value="signal">Highest signal</option>
        <option value="amount">Largest amount</option>
        <option value="disclosed">Recently disclosed</option>
      </select>
    </div>
  )
}

// ── Results Count ──────────────────────────────────────────────────────────────

function ResultsCount({ shown, total, activeTab }) {
  const label = activeTab === 'contracts' ? 'contract' : 'filing'
  if (shown === total) return (
    <div className="results-count">{total} {label}{total !== 1 ? 's' : ''}</div>
  )
  return (
    <div className="results-count">Showing <strong>{shown}</strong> of {total} {label}{total !== 1 ? 's' : ''}</div>
  )
}

// ── Hero Section ───────────────────────────────────────────────────────────────

function HeroSection({ onSignUp }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('ef_hero_dismissed') === '1' } catch { return false }
  })
  if (dismissed) return null
  return (
    <div className="hero-section">
      <button className="hero-dismiss" onClick={() => {
        try { localStorage.setItem('ef_hero_dismissed', '1') } catch {}
        setDismissed(true)
      }} aria-label="Dismiss">×</button>
      <h1 className="hero-headline">See what insiders and politicians are buying before the news breaks.</h1>
      <p className="hero-sub">
        Evenfield tracks SEC insider filings, congressional trades, and federal contracts — translated into plain English. Free.
      </p>
      <div className="hero-stats">
        <div className="hero-stat"><strong>2,400+</strong><span>filings tracked</span></div>
        <div className="hero-stat"><strong>3</strong><span>live data sources</span></div>
        <div className="hero-stat"><strong>Free</strong><span>always</span></div>
      </div>
      <button className="hero-cta" onClick={onSignUp}>Create free account</button>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────────

function Header({ onMenuClick, lastUpdated }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  const ago    = lastUpdated ? timeAgo(lastUpdated) : null
  const ageMs  = lastUpdated ? (Date.now() - lastUpdated.getTime()) : 0
  const ageCls = ageMs > 86_400_000 ? 'last-updated-red' : ageMs > 14_400_000 ? 'last-updated-amber' : ''

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="header-left">
          <button className="hamburger" onClick={onMenuClick} aria-label="Open menu"><HamburgerIcon /></button>
          <div className="brand">
            <span className="brand-name">Evenfield</span>
            <span className="brand-tagline">The market, explained.</span>
          </div>
        </div>
        <div className="header-meta">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-label">LIVE</span>
          {ago && <span className={`last-updated ${ageCls}`}>· Updated {ago}</span>}
        </div>
      </div>
    </header>
  )
}

// ── Top Tab Bar ────────────────────────────────────────────────────────────────

function TopTabBar({ activeTab, setActiveTab, counts, analyticsFiltered }) {
  const tabs = [
    { key: 'insider',   label: 'Insider Trades',   count: counts.insider },
    { key: 'congress',  label: 'Congress',          count: counts.congress },
    { key: 'contracts', label: 'Federal Contracts', count: counts.contracts },
    { key: 'analytics', label: '📊 Analytics',     count: 0, badge: analyticsFiltered },
  ]
  return (
    <div className="top-tab-bar">
      <div className="top-tab-inner">
        {tabs.map(t => (
          <button key={t.key} className={`top-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}>
            {t.label}
            {t.count > 0 && <span className="top-tab-count">{t.count}</span>}
            {t.badge && <span className="top-tab-badge" title="Filters active">●</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────

function FilterBar({ filter, setFilter, watchlistCount }) {
  const tabs = [
    { key: 'all',       label: 'All' },
    { key: 'high',      label: 'High Signal' },
    { key: 'buy',       label: 'Buys' },
    { key: 'sell',      label: 'Sells' },
    { key: 'watchlist', label: 'Watchlist' },
  ]
  return (
    <div className="filter-tabs">
      {tabs.map(t => (
        <button key={t.key} className={`filter-tab ${filter === t.key ? 'active' : ''}`}
          onClick={() => setFilter(t.key)}>
          {t.label}
          {t.key === 'watchlist' && watchlistCount > 0 && (
            <span className="watch-count-badge">{watchlistCount}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Pricing Section ────────────────────────────────────────────────────────────

function PricingSection() {
  const [open, setOpen] = useState(false)
  return (
    <div className="sidebar-pricing">
      <button className="sidebar-pricing-toggle" onClick={() => setOpen(o => !o)}>
        <span>Pricing</span>
        <span className={`pricing-chevron ${open ? 'open' : ''}`}><ChevronDownIcon /></span>
      </button>
      {open && (
        <div className="plan-cards">

          <div className="plan-card plan-current">
            <div className="plan-header-row">
              <div className="plan-name">Free</div>
              <span className="plan-current-badge">Current</span>
            </div>
            <div className="plan-price">$0 <span>/ forever</span></div>
            <ul className="plan-features">
              <li>✓ Full feed — all 3 data sources</li>
              <li>✓ Filters, search & signal scores</li>
              <li>✓ Plain English explanations</li>
              <li>✓ Watchlist (this device only)</li>
            </ul>
          </div>

          <div className="plan-card">
            <div className="plan-header-row">
              <div className="plan-name">Pro</div>
              <div className="plan-price">$9 <span>/ mo</span></div>
            </div>
            <ul className="plan-features">
              <li>✓ Everything in Free</li>
              <li>✓ Real-time email alerts</li>
              <li>✓ Watchlist synced across all devices</li>
              <li>✓ Saved filter presets</li>
              <li>✓ Date range & amount filters</li>
            </ul>
            <button className="plan-upgrade-btn" disabled>Coming soon</button>
          </div>

          <div className="plan-card">
            <div className="plan-header-row">
              <div className="plan-name">Power</div>
              <div className="plan-price">$29 <span>/ mo</span></div>
            </div>
            <ul className="plan-features">
              <li>✓ Everything in Pro</li>
              <li>✓ API access to enriched data</li>
              <li>✓ Bulk CSV export</li>
              <li>✓ Custom webhooks</li>
              <li>✓ Priority support</li>
            </ul>
            <button className="plan-upgrade-btn" disabled>Coming soon</button>
          </div>

        </div>
      )}
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({ open, onClose, onSignIn, onAbout, onTerms, onPrivacy,
    onSettings, onDataSources, user, onSignOut, onGoWatchlist,
    allFilings, watchlist }) {
  const [proTooltip, setProTooltip] = useState(null)
  const handleLocked = (item) => { setProTooltip(item); setTimeout(() => setProTooltip(null), 2500) }

  // Top 3 trending: highest signal from today, or overall top 3
  const trending = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todayItems = allFilings.filter(f => {
      const d = (f.filed_at || f.trade_date || f.date || '').slice(0, 10)
      return d === today && typeof f.signal_score === 'number'
    })
    const pool = todayItems.length >= 3 ? todayItems : allFilings.filter(f => typeof f.signal_score === 'number')
    return [...pool].sort((a, b) => (b.signal_score || 0) - (a.signal_score || 0)).slice(0, 3)
  }, [allFilings])

  const [showTrending, setShowTrending] = useState(false)

  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Navigation menu">

        <div className="sidebar-header">
          <span className="sidebar-title">Menu</span>
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu"><XIcon /></button>
        </div>

        {/* User */}
        <div className="sidebar-user">
          <div className={`user-avatar ${user ? 'user-avatar-authed' : ''}`}>
            {user ? <span className="user-initial">{initials(user.email)}</span> : (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="11" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 28c0-6.075 4.925-11 11-11s11 4.925 11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          <div className="user-info">
            <span className="user-name">{user ? user.email : 'Guest'}</span>
            <span className="user-sub">{user ? 'Free plan' : 'Not signed in'}</span>
          </div>
          {user
            ? <button className="signout-btn" onClick={() => { onSignOut(); onClose() }}>Sign Out</button>
            : <button className="signin-btn" onClick={() => { onSignIn(); onClose() }}>Sign In</button>
          }
        </div>

        {proTooltip && (
          <div className="pro-tooltip"><LockIcon /> Available soon — stay tuned</div>
        )}

        {/* Section 1: Navigate */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigate</div>

          <button className="nav-item nav-item-active" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 7L8 2L14 7V14H10V10H6V14H2V7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            Home
          </button>

          <button className="nav-item"
            onClick={() => { onGoWatchlist(); onClose() }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L9.8 5.5H14L10.6 8.3L11.9 12.5L8 10.1L4.1 12.5L5.4 8.3L2 5.5H6.2L8 1.5Z"
                stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            Watchlist
            {user && <span className="watchlist-sync-dot" title="Synced across devices" />}
          </button>
          <div className="watchlist-device-msg">
            {user
              ? <><span className="watchlist-sync-indicator" />{' '}Watchlist synced across your devices</>
              : <>Watching <strong>{watchlist.length}</strong> ticker{watchlist.length !== 1 ? 's' : ''} on this device.{' '}
                  <button className="watchlist-upgrade-link" onClick={() => { onSignIn(); onClose() }}>
                    Sign in
                  </button>{' '}to sync across all your devices.</>
            }
          </div>

          <button className={`nav-item ${!user ? 'nav-item-locked' : ''}`}
            onClick={() => handleLocked('alerts')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a4 4 0 0 1 4 4v3.5l1.5 1.5H2.5L4 9.5V6a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 13a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Alerts
            {user ? <span className="coming-soon-tag">Soon</span> : <span className="lock-badge"><LockIcon /></span>}
          </button>

          <button className="nav-item" onClick={() => setShowTrending(o => !o)}>
            <TrendingIcon />
            Trending
            <span className="coming-soon-tag" style={{ background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e' }}>
              {trending.length}
            </span>
          </button>

          {showTrending && trending.length > 0 && (
            <div className="trending-items">
              {trending.map((f, i) => (
                <div key={f.id || i} className="trending-item">
                  <span className="trending-rank">#{i + 1}</span>
                  <div className="trending-info">
                    <span className="trending-ticker">{f.ticker || f.politician?.split(' ').pop() || '—'}</span>
                    <span className="trending-desc">{(f.plain_english || '').slice(0, 60)}{f.plain_english?.length > 60 ? '…' : ''}</span>
                  </div>
                  <span className={`score-badge ${signalColor(f.signal_score)}`} style={{ fontSize: 11, padding: '2px 6px', minWidth: 'auto', gap: 1 }}>
                    {f.signal_score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Section 2: Pricing */}
        <PricingSection />

        {/* Section 3: Account */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Account</div>

          <button className="nav-item" onClick={() => { onSettings(); onClose() }}>
            <SettingsIcon />
            Settings
          </button>

          {user ? (
            <button className="nav-item nav-item-locked" onClick={() => handleLocked('billing')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="4" width="12" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2 7.5h12" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Billing
              <span className="lock-badge"><LockIcon /></span>
            </button>
          ) : (
            <button className="nav-item" onClick={() => { onSignIn(); onClose() }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3l4 4-4 4M14 7H6M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sign In
            </button>
          )}
        </nav>

        {/* Section 4: Info */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Info</div>
          <button className="nav-item" onClick={() => { onAbout(); onClose() }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8 7.5v4M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            About Evenfield
          </button>
          <button className="nav-item" onClick={() => { onDataSources(); onClose() }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <ellipse cx="8" cy="5" rx="5" ry="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 5v3c0 1.1 2.24 2 5 2s5-.9 5-2V5M3 8v3c0 1.1 2.24 2 5 2s5-.9 5-2V8" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Data Sources
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="version-tag">Evenfield Beta · v0.4</span>
          <div className="sidebar-legal">
            <button className="sidebar-legal-link" onClick={() => { onTerms(); onClose() }}>Terms</button>
            <span className="sidebar-legal-sep">·</span>
            <button className="sidebar-legal-link" onClick={() => { onPrivacy(); onClose() }}>Privacy</button>
          </div>
        </div>

      </aside>
    </>
  )
}

// ── Settings Modal ─────────────────────────────────────────────────────────────

function SettingsModal({ onClose, settings, setSettings, user }) {
  const set = (key, val) => {
    setSettings(prev => {
      const next = { ...prev, [key]: val }
      saveSettings(next)
      return next
    })
  }

  useEffect(() => {
    const body = document.documentElement
    if (settings.theme === 'light') body.setAttribute('data-theme', 'light')
    else if (settings.theme === 'dark') body.removeAttribute('data-theme')
    else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (!prefersDark) body.setAttribute('data-theme', 'light')
      else body.removeAttribute('data-theme')
    }
  }, [settings.theme])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-settings" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-brand">Evenfield</div>
            <h2 className="modal-title">Settings</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        <div className="settings-body">
          {/* Display */}
          <div className="settings-section">
            <div className="settings-section-title">Display</div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Default tab on load</span>
                <span className="setting-desc">Which tab shows first when you open Evenfield</span>
              </div>
              <select className="setting-select" value={settings.defaultTab}
                onChange={e => set('defaultTab', e.target.value)}>
                <option value="insider">Insider Trades</option>
                <option value="congress">Congress</option>
                <option value="contracts">Federal Contracts</option>
              </select>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Default sort</span>
                <span className="setting-desc">How filings are ordered by default</span>
              </div>
              <select className="setting-select" value={settings.defaultSort}
                onChange={e => set('defaultSort', e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="signal">Highest signal</option>
                <option value="amount">Largest amount</option>
                <option value="disclosed">Recently disclosed</option>
              </select>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Cards per page</span>
                <span className="setting-desc">Limits rendering for performance</span>
              </div>
              <select className="setting-select" value={settings.cardsPerPage}
                onChange={e => set('cardsPerPage', e.target.value === 'all' ? 'all' : parseInt(e.target.value))}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Compact mode</span>
                <span className="setting-desc">Reduces card padding for higher density</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.compactMode}
                  onChange={e => set('compactMode', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          {/* Appearance */}
          <div className="settings-section">
            <div className="settings-section-title">Appearance</div>
            <div className="setting-row">
              <div className="setting-label">
                <span>Theme</span>
              </div>
              <div className="theme-buttons">
                {[['dark', 'Dark'], ['light', 'Light'], ['system', 'System']].map(([val, label]) => (
                  <button key={val} type="button"
                    className={`theme-btn ${settings.theme === val ? 'active' : ''}`}
                    onClick={() => set('theme', val)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="settings-section">
            <div className="settings-section-title">Alerts</div>
            {user ? (
              <div className="setting-row">
                <div className="setting-label">
                  <span>Alert threshold</span>
                  <span className="setting-desc">Only notify for filings with score ≥ {settings.alertThreshold}</span>
                </div>
                <div className="setting-slider-wrap">
                  <input type="range" min="1" max="10" value={settings.alertThreshold}
                    className="score-range-input" style={{ width: 100 }}
                    onChange={e => set('alertThreshold', parseInt(e.target.value))} />
                  <span className="setting-slider-val">{settings.alertThreshold}/10</span>
                </div>
              </div>
            ) : (
              <div className="setting-row setting-row-cta">
                <p className="setting-cta-text">Create a free account to enable email alerts for high-signal filings.</p>
              </div>
            )}
          </div>

          {/* Data */}
          <div className="settings-section">
            <div className="settings-section-title">Data</div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Hide routine filings</span>
                <span className="setting-desc">Hides filings with signal score 1–2</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.hideRoutine}
                  onChange={e => set('hideRoutine', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>Default minimum score</span>
                <span className="setting-desc">Starting score filter when you open the app</span>
              </div>
              <div className="setting-slider-wrap">
                <input type="range" min="1" max="10" value={settings.defaultScoreMin}
                  className="score-range-input" style={{ width: 100 }}
                  onChange={e => set('defaultScoreMin', parseInt(e.target.value))} />
                <span className="setting-slider-val">{settings.defaultScoreMin}/10</span>
              </div>
            </div>
          </div>
        </div>

        <p className="settings-footnote">Settings are saved automatically to this browser.</p>
      </div>
    </div>
  )
}

// ── Data Sources Modal ─────────────────────────────────────────────────────────

function DataSourcesModal({ onClose }) {
  const sources = [
    {
      name: 'SEC EDGAR — Form 4',
      desc: 'Insider trading disclosures filed by directors, officers, and 10%+ shareholders of public companies. Required within 2 business days of a trade.',
      url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=4&dateb=&owner=include&count=40',
      label: 'Visit SEC EDGAR',
      color: '#60a5fa',
    },
    {
      name: 'STOCK Act — Congressional Disclosures',
      desc: 'Stock trades by members of Congress and their spouses. Required within 45 days of a transaction under the Stop Trading on Congressional Knowledge Act (2012).',
      url: 'https://efts.house.gov/LATEST/search-index?q=%22periodic+transaction%22',
      label: 'Visit House Disclosures',
      color: '#a78bfa',
    },
    {
      name: 'USASpending.gov — Federal Contracts',
      desc: 'Federal contract awards from government agencies. All awards above $10,000 are reported to USASpending.gov within 30 days of award.',
      url: 'https://www.usaspending.gov/search',
      label: 'Visit USASpending.gov',
      color: '#34d399',
    },
  ]
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-about" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Data Sources</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>
        <div className="datasources-list">
          {sources.map(s => (
            <div key={s.name} className="datasource-item">
              <div className="datasource-dot" style={{ background: s.color }} />
              <div className="datasource-body">
                <div className="datasource-name">{s.name}</div>
                <p className="datasource-desc">{s.desc}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="datasource-link">
                  {s.label} <ExternalLinkIcon />
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="modal-footnote" style={{ marginTop: 16 }}>
          Signal scores and plain-English summaries are generated by AI and are for informational purposes only.
          Not financial advice.
        </p>
      </div>
    </div>
  )
}

// ── Sign In Modal ──────────────────────────────────────────────────────────────

function SignInModal({ onClose }) {
  const [mode, setMode]                 = useState('signin')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPw] = useState('')
  const [loading, setLoading]           = useState(false)
  const [message, setMessage]           = useState('')
  const [isError, setIsError]           = useState(false)

  const switchMode = (m) => { setMode(m); setMessage(''); setPassword(''); setConfirmPw('') }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!authEnabled || !supabase) {
      setMessage('Auth not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to web/.env.local')
      setIsError(true); return
    }
    setLoading(true); setMessage('')
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMessage('Reset link sent — check your inbox.'); setIsError(false)
      } else if (mode === 'signup') {
        if (password !== confirmPassword) { setMessage('Passwords do not match.'); setIsError(true); setLoading(false); return }
        if (password.length < 6) { setMessage('Password must be at least 6 characters.'); setIsError(true); setLoading(false); return }
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Account created! Check your email to confirm, then sign in.'); setIsError(false)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      }
    } catch (err) { setMessage(friendlyAuthError(err)); setIsError(true) }
    finally { setLoading(false) }
  }

  const titles    = { signin: 'Welcome back', signup: 'Create account', forgot: 'Reset password' }
  const btnLabels = { signin: loading ? 'Signing in…' : 'Sign In →', signup: loading ? 'Creating account…' : 'Create Account →', forgot: loading ? 'Sending reset link…' : 'Send Reset Link →' }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><div className="modal-brand">Evenfield</div><h2 className="modal-title">{titles[mode]}</h2></div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>
        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="auth-email">Email address</label>
            <input id="auth-email" type="email" className="field-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          {mode !== 'forgot' && (
            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="auth-password">Password</label>
                {mode === 'signin' && (
                  <button type="button" className="forgot-link" onClick={() => switchMode('forgot')}>Forgot password?</button>
                )}
              </div>
              <input id="auth-password" type="password" className="field-input" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
            </div>
          )}
          {mode === 'signup' && (
            <div className="field-group">
              <label className="field-label" htmlFor="auth-confirm">Confirm password</label>
              <input id="auth-confirm" type="password" className="field-input" placeholder="••••••••"
                value={confirmPassword} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" required />
            </div>
          )}
          {message && <p className={`auth-message ${isError ? 'auth-error' : 'auth-success'}`}>{message}</p>}
          <button type="submit" className="submit-btn" disabled={loading}>{btnLabels[mode]}</button>
        </form>
        <div className="mode-toggle-group">
          {mode === 'forgot' ? (
            <button className="mode-toggle" onClick={() => switchMode('signin')}>← Back to sign in</button>
          ) : mode === 'signin' ? (
            <button className="mode-toggle" onClick={() => switchMode('signup')}>Don't have an account? <strong>Sign up free</strong></button>
          ) : (
            <button className="mode-toggle" onClick={() => switchMode('signin')}>Already have an account? <strong>Sign in</strong></button>
          )}
        </div>
        <p className="modal-footnote">By continuing you agree to our Terms of Service and Privacy Policy.</p>
      </div>
    </div>
  )
}

// ── About Modal ────────────────────────────────────────────────────────────────

function AboutModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-about" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">About Evenfield</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>
        <p className="about-tagline">The market, explained.</p>
        <div className="about-body">
          <p>Evenfield monitors real-time SEC Form 4 insider trading filings and congressional STOCK Act disclosures — translated into plain English for everyday investors and voters.</p>
          <p>When a CEO buys $5 million of their own stock, or a senator trades into a company their committee oversees, that information is public record. Evenfield surfaces it, scores it, and explains what it means.</p>
          <p>Our mission is financial transparency for everyone. Markets and democracy work better when information flows freely.</p>
        </div>
        <div className="about-stats">
          <div className="about-stat"><span className="stat-num">Form 4</span><span className="stat-label">SEC filing type</span></div>
          <div className="about-stat"><span className="stat-num">STOCK Act</span><span className="stat-label">Congress trades</span></div>
          <div className="about-stat"><span className="stat-num">Free</span><span className="stat-label">Always</span></div>
        </div>
      </div>
    </div>
  )
}

// ── Terms Modal ────────────────────────────────────────────────────────────────

function TermsModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-legal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Terms of Service</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>
        <div className="modal-scroll-body">
          <p className="legal-updated">Last updated: May 2026</p>
          <h3 className="legal-heading">1. No Financial Advice</h3>
          <p>Evenfield is an informational platform only. Nothing on Evenfield constitutes financial, investment, legal, or tax advice. You should not make investment decisions based solely on information provided by Evenfield. Always consult a qualified financial advisor.</p>
          <h3 className="legal-heading">2. Data Sources</h3>
          <p>Data is sourced from public records including SEC EDGAR, STOCK Act congressional disclosures, and USASpending.gov. This data is provided as-is with no representations about completeness, accuracy, or timeliness.</p>
          <h3 className="legal-heading">3. No Liability</h3>
          <p>Evenfield and its operators shall not be liable for any investment decisions made based on information available on the platform.</p>
          <h3 className="legal-heading">4. User Accounts</h3>
          <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to use the platform only for lawful purposes.</p>
          <h3 className="legal-heading">5. Termination</h3>
          <p>We reserve the right to suspend or terminate accounts at our discretion. You may delete your account at any time by contacting support@evenfield.app.</p>
          <h3 className="legal-heading">6. Changes</h3>
          <p>We may update these terms. Continued use after changes constitutes acceptance.</p>
          <h3 className="legal-heading">7. Contact</h3>
          <p>Questions? Contact us at support@evenfield.app.</p>
        </div>
      </div>
    </div>
  )
}

// ── Privacy Modal ──────────────────────────────────────────────────────────────

function PrivacyModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-legal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Privacy Policy</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>
        <div className="modal-scroll-body">
          <p className="legal-updated">Last updated: May 2026</p>
          <h3 className="legal-heading">1. What We Collect</h3>
          <ul className="legal-list">
            <li><strong>Email address</strong> — used only for authentication and optional alerts.</li>
            <li><strong>Watchlist</strong> — stored in localStorage or our secure database when signed in.</li>
            <li><strong>Settings</strong> — stored locally in your browser only.</li>
          </ul>
          <h3 className="legal-heading">2. How We Use Your Data</h3>
          <p>Your email is used only to authenticate your account and send alert emails you opted into. We do not sell or share your data with third parties for marketing purposes.</p>
          <h3 className="legal-heading">3. Data Processors</h3>
          <p>We use <strong>Supabase</strong> for authentication and database storage, and <strong>Resend</strong> for email delivery. Both are GDPR-compliant.</p>
          <h3 className="legal-heading">4. Your Rights</h3>
          <p>You have the right to access, correct, or delete your personal data. Contact privacy@evenfield.app within 30 days.</p>
          <h3 className="legal-heading">5. Cookies</h3>
          <p>We do not use third-party tracking cookies. Authentication state is stored in browser localStorage as required for the platform to function.</p>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ error, loading, label }) {
  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading {label}…</span></div>
  if (error)   return <div className="state-msg error"><span>{error}</span></div>
  return <div className="state-msg">No results match the current filters.</div>
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  // Settings
  const [settings, setSettings] = useState(loadSettings)
  useEffect(() => {
    const body = document.documentElement
    if (settings.theme === 'light') body.setAttribute('data-theme', 'light')
    else if (settings.theme === 'dark') body.removeAttribute('data-theme')
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (!prefersDark) body.setAttribute('data-theme', 'light')
      else body.removeAttribute('data-theme')
    }
  }, [settings.theme])

  // Auth
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const [watchlist, toggleWatch] = useWatchlist(user)

  // Tab + quick filter
  const [activeTab, setActiveTab] = useState(() => settings.defaultTab || 'insider')
  const [filter, setFilter]       = useState('all')

  // Search + panel filters
  const [searchQuery,     setSearchQuery]     = useState('')
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [panelFilters,    setPanelFilters]     = useState(() => ({
    ...DEFAULT_PANEL,
    scoreMin: settings.defaultScoreMin || 1,
  }))

  // Sort
  const [sortOrder, setSortOrder] = useState(() => {
    try { return localStorage.getItem('ef_sort') || settings.defaultSort || 'newest' }
    catch { return settings.defaultSort || 'newest' }
  })

  // Data
  const [insiderFilings,  setInsiderFilings]  = useState([])
  const [congressFilings, setCongressFilings] = useState([])
  const [contracts,       setContracts]       = useState([])
  const [loadingMap, setLoadingMap] = useState({ insider: true, congress: true, contracts: true })
  const [errorMap,   setErrorMap]   = useState({})

  useEffect(() => {
    // Try Supabase Storage first (production), fall back to /public/ (local dev)
    const STORAGE = import.meta.env.VITE_SUPABASE_STORAGE_URL?.replace(/\/$/, '') || ''

    const fetchWithFallback = async (filename) => {
      if (STORAGE) {
        try {
          const r = await fetch(`${STORAGE}/${filename}`)
          if (r.ok) return r.json()
        } catch {}
      }
      const r = await fetch(`/${filename}`)
      if (!r.ok) throw new Error(`Run the pipeline for this data first (HTTP ${r.status})`)
      return r.json()
    }

    const load = (filename, setter, key, transform = x => x) =>
      fetchWithFallback(filename)
        .then(data => { setter(transform(data)); setLoadingMap(m => ({...m, [key]: false})) })
        .catch(e  => { setErrorMap(m => ({...m, [key]: e.message})); setLoadingMap(m => ({...m, [key]: false})) })

    load('evenfield_enriched.json',     setInsiderFilings,  'insider',   arr => [...arr].sort((a, b) => new Date(b.filed_at) - new Date(a.filed_at)))
    load('congressional_enriched.json', setCongressFilings, 'congress',  arr => [...arr].sort((a, b) => new Date(b.filed_at) - new Date(a.filed_at)))
    load('lobbying_data.json',          setContracts,       'contracts', arr => [...arr].sort((a, b) => (b.amount || 0) - (a.amount || 0)))
  }, [])

  // Analytics filter state
  const [analyticsFilters, setAnalyticsFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('evenfield_analytics_filters')
      return saved ? { ...DEFAULT_ANALYTICS_FILTERS, ...JSON.parse(saved) } : { ...DEFAULT_ANALYTICS_FILTERS }
    } catch { return { ...DEFAULT_ANALYTICS_FILTERS } }
  })

  const analyticsFiltered =
    analyticsFilters.dateRange !== '30D' ||
    analyticsFilters.sources.length !== 3 ||
    analyticsFilters.party !== 'all' ||
    analyticsFilters.minSignal > 1 ||
    analyticsFilters.tickers.length > 0

  // Drill-down modal state
  const [drillDown, setDrillDown] = useState(null) // { type, item }

  const handleDrillDown = useCallback((type, item) => setDrillDown({ type, item }), [])

  const handleViewAll = useCallback((type, item) => {
    setDrillDown(null)
    if (type === 'insider') {
      setActiveTab('insider')
      setPanelFilters(prev => ({ ...prev, companies: item.ticker ? [item.ticker] : prev.companies }))
    } else if (type === 'congress') {
      setActiveTab('congress')
      setPanelFilters(prev => ({ ...prev, persons: item.politician ? [item.politician] : prev.persons }))
    } else if (type === 'contracts') {
      setActiveTab('contracts')
      setPanelFilters(prev => ({ ...prev, companies: item.recipient ? [item.recipient] : prev.companies }))
    }
  }, [])

  // Modal states
  const [sidebarOpen,     setSidebarOpen]     = useState(false)
  const [showSignIn,      setShowSignIn]      = useState(false)
  const [showAbout,       setShowAbout]       = useState(false)
  const [showTerms,       setShowTerms]       = useState(false)
  const [showPrivacy,     setShowPrivacy]     = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)
  const [showDataSources, setShowDataSources] = useState(false)

  // URL param: ?filing=id
  const [highlightedId, setHighlightedId] = useState(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('filing')
    if (id) setHighlightedId(id)
  }, [])

  // After data loads, switch tab to find highlighted filing
  useEffect(() => {
    if (!highlightedId) return
    if (insiderFilings.find(f => f.id === highlightedId)) setActiveTab('insider')
    else if (congressFilings.find(f => f.id === highlightedId)) setActiveTab('congress')
    else if (contracts.find(f => f.id === highlightedId)) setActiveTab('contracts')
  }, [highlightedId, insiderFilings, congressFilings, contracts])

  // Last updated
  const lastUpdated = useMemo(() => {
    const dates = [
      ...insiderFilings.map(f => f.fetched_at),
      ...congressFilings.map(f => f.fetched_at),
      ...contracts.map(c => c.fetched_at),
    ].filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d.getTime()))
    if (!dates.length) return null
    return new Date(Math.max(...dates.map(d => d.getTime())))
  }, [insiderFilings, congressFilings, contracts])

  // All filings for trending
  const allFilings = useMemo(() => [...insiderFilings, ...congressFilings], [insiderFilings, congressFilings])

  // Autocomplete options
  const companyOptions = useMemo(() => {
    if (activeTab === 'insider')   return [...new Set(insiderFilings.map(f => f.ticker).filter(Boolean))].sort()
    if (activeTab === 'congress')  return [...new Set(congressFilings.map(f => f.ticker).filter(Boolean))].sort()
    return [...new Set(contracts.map(f => f.recipient).filter(Boolean))].sort()
  }, [activeTab, insiderFilings, congressFilings, contracts])

  const personOptions = useMemo(() => {
    if (activeTab === 'insider')  return [...new Set(insiderFilings.map(f => f.owner).filter(Boolean))].sort()
    if (activeTab === 'congress') return [...new Set(congressFilings.map(f => f.politician).filter(Boolean))].sort()
    return []
  }, [activeTab, insiderFilings, congressFilings])

  const congressPartyMap = useMemo(() => {
    const m = {}
    congressFilings.forEach(f => { if (f.politician && f.party) m[f.politician] = f.party })
    return m
  }, [congressFilings])

  // Processing pipeline: quick filter → search → panel filters → hide routine → sort → paginate
  const process = useCallback((items, type) => {
    // 1. Quick filter
    let result = items.filter(f => {
      if (filter === 'high')      return f.signal_score >= 8
      if (filter === 'buy')       return f.acquired_disposed === 'A'
      if (filter === 'sell')      return f.acquired_disposed === 'D'
      if (filter === 'watchlist') return type === 'contracts'
        ? f.insider_tickers?.some(t => watchlist.includes(t))
        : watchlist.includes(f.ticker)
      return true
    })
    // 2. Search
    result = applySearch(result, searchQuery)
    // 3. Panel filters
    result = applyPanelFilters(result, panelFilters, type)
    // 4. Hide routine
    if (settings.hideRoutine) result = result.filter(f => (f.signal_score || 0) > 2)
    // 5. Sort
    result = sortFilings(result, sortOrder)
    // 6. Paginate
    if (settings.cardsPerPage !== 'all') result = result.slice(0, settings.cardsPerPage)
    return result
  }, [filter, searchQuery, panelFilters, settings, sortOrder, watchlist])

  const filteredInsider   = useMemo(() => process(insiderFilings,  'insider'),   [process, insiderFilings])
  const filteredCongress  = useMemo(() => process(congressFilings, 'congress'),  [process, congressFilings])
  const filteredContracts = useMemo(() => process(contracts,       'contracts'), [process, contracts])

  const currentFiltered = activeTab === 'insider' ? filteredInsider
    : activeTab === 'congress' ? filteredCongress : filteredContracts
  const currentTotal    = activeTab === 'insider' ? insiderFilings.length
    : activeTab === 'congress' ? congressFilings.length : contracts.length

  const counts = {
    insider:   insiderFilings.length,
    congress:  congressFilings.length,
    contracts: contracts.length,
  }

  const activePanelCount = countActivePanelFilters(panelFilters)
  const hasActiveFilters = activePanelCount > 0 || searchQuery.length >= 2

  const handleSignOut     = () => supabase?.auth.signOut()
  const handleGoWatchlist = () => { setActiveTab('insider'); setFilter('watchlist') }

  // Search count for currently active tab (before paginate)
  const searchTotalCount = useMemo(() => {
    let items = activeTab === 'insider' ? insiderFilings : activeTab === 'congress' ? congressFilings : contracts
    return applySearch(applyPanelFilters(items.filter(f => {
      if (filter === 'high') return f.signal_score >= 8
      if (filter === 'buy') return f.acquired_disposed === 'A'
      if (filter === 'sell') return f.acquired_disposed === 'D'
      if (filter === 'watchlist') return watchlist.includes(f.ticker)
      return true
    }), panelFilters, activeTab), searchQuery).length
  }, [activeTab, insiderFilings, congressFilings, contracts, filter, watchlist, panelFilters, searchQuery])

  return (
    <div className={`app ${settings.compactMode ? 'compact-mode' : ''}`}>
      <Header onMenuClick={() => setSidebarOpen(true)} lastUpdated={lastUpdated} />

      <TopTabBar activeTab={activeTab} setActiveTab={t => { setActiveTab(t); setFilter('all') }} counts={counts} analyticsFiltered={analyticsFiltered} />

      {/* Sticky search + filter area — hidden on analytics tab */}
      <div className="filter-sticky" style={activeTab === 'analytics' ? { display: 'none' } : undefined}>
        {/* Search bar */}
        <div className="search-bar-wrap">
          <SearchBar value={searchQuery} onChange={setSearchQuery} totalCount={searchTotalCount} />
        </div>

        {/* Filter row: quick tabs + filter toggle + sort */}
        <div className="filter-bar">
          <div className="filter-bar-inner">
            <FilterBar filter={filter} setFilter={setFilter} watchlistCount={watchlist.length} />
            <div className="filter-bar-right">
              <button
                className={`filter-panel-toggle ${filterPanelOpen ? 'active' : ''}`}
                onClick={() => setFilterPanelOpen(o => !o)}>
                <FilterIcon />
                Filters
                {activePanelCount > 0 && <span className="filter-panel-badge">{activePanelCount}</span>}
              </button>
              <SortDropdown value={sortOrder} onChange={setSortOrder} />
            </div>
          </div>
        </div>

        {/* Collapsible filter panel */}
        <FilterPanel
          open={filterPanelOpen}
          panelFilters={panelFilters}
          setPanelFilters={setPanelFilters}
          activeTab={activeTab}
          companyOptions={companyOptions}
          personOptions={personOptions}
          congressPartyMap={congressPartyMap}
        />

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="active-pills-wrap">
            <ActiveFilterPills
              panelFilters={panelFilters}
              setPanelFilters={setPanelFilters}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>
        )}
      </div>

      <main className="main">
        {/* Analytics tab — full dashboard view */}
        {activeTab === 'analytics' && (
          <AnalyticsView
            insiderFilings={insiderFilings}
            congressFilings={congressFilings}
            contracts={contracts}
            analyticsFilters={analyticsFilters}
            onAnalyticsFiltersChange={setAnalyticsFilters}
          />
        )}

        {activeTab !== 'analytics' && (
        <>
        {!user && <HeroSection onSignUp={() => setShowSignIn(true)} />}

        <ResultsCount shown={currentFiltered.length} total={currentTotal} activeTab={activeTab} />

        <SummaryChartsSection
          activeTab={activeTab}
          insiderFilings={insiderFilings}
          congressFilings={congressFilings}
          contracts={contracts}
        />

        {activeTab === 'insider' && (
          loadingMap.insider || errorMap.insider
            ? <EmptyState loading={loadingMap.insider} error={errorMap.insider} label="insider filings" />
            : <div className="feed">
                {filteredInsider.length === 0
                  ? <div className="state-msg">No filings match this filter.</div>
                  : filteredInsider.map(f => (
                      <FilingCard key={f.id} filing={f} watchlist={watchlist} onToggleWatch={toggleWatch}
                        highlighted={highlightedId === f.id} onDrillDown={handleDrillDown} />
                    ))
                }
              </div>
        )}

        {activeTab === 'congress' && (
          loadingMap.congress || errorMap.congress
            ? <EmptyState loading={loadingMap.congress} error={errorMap.congress} label="congressional trades" />
            : <div className="feed">
                {filteredCongress.length === 0
                  ? <div className="state-msg">No filings match this filter.</div>
                  : filteredCongress.map(f => (
                      <CongressCard key={f.id} filing={f} watchlist={watchlist} onToggleWatch={toggleWatch}
                        highlighted={highlightedId === f.id} onDrillDown={handleDrillDown} />
                    ))
                }
              </div>
        )}

        {activeTab === 'contracts' && (
          loadingMap.contracts || errorMap.contracts
            ? <EmptyState loading={loadingMap.contracts} error={errorMap.contracts} label="federal contracts" />
            : <div className="feed">
                {filteredContracts.length === 0
                  ? <div className="state-msg">No contracts match this filter.</div>
                  : filteredContracts.map(c => (
                      <ContractCard key={c.id} contract={c} highlighted={highlightedId === c.id} onDrillDown={handleDrillDown} />
                    ))
                }
              </div>
        )}
        </>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p>Evenfield is for informational purposes only and does not constitute financial advice.
            Data sourced from SEC EDGAR, STOCK Act disclosures, and USASpending.gov.</p>
          <div className="footer-links">
            <button className="footer-link" onClick={() => setShowTerms(true)}>Terms of Service</button>
            <span className="footer-sep">·</span>
            <button className="footer-link" onClick={() => setShowPrivacy(true)}>Privacy Policy</button>
          </div>
        </div>
      </footer>

      <Sidebar
        open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        onSignIn={() => setShowSignIn(true)} onAbout={() => setShowAbout(true)}
        onTerms={() => setShowTerms(true)} onPrivacy={() => setShowPrivacy(true)}
        onSettings={() => setShowSettings(true)} onDataSources={() => setShowDataSources(true)}
        user={user} onSignOut={handleSignOut} onGoWatchlist={handleGoWatchlist}
        allFilings={allFilings} watchlist={watchlist}
      />

      {drillDown && (
        <DrillDownModal
          type={drillDown.type}
          filing={drillDown.type !== 'contracts' ? drillDown.item : undefined}
          contract={drillDown.type === 'contracts' ? drillDown.item : undefined}
          insiderFilings={insiderFilings}
          congressFilings={congressFilings}
          contracts={contracts}
          onClose={() => setDrillDown(null)}
          onViewAll={handleViewAll}
        />
      )}
      {showSignIn      && <SignInModal      onClose={() => setShowSignIn(false)} />}
      {showAbout       && <AboutModal       onClose={() => setShowAbout(false)} />}
      {showTerms       && <TermsModal       onClose={() => setShowTerms(false)} />}
      {showPrivacy     && <PrivacyModal     onClose={() => setShowPrivacy(false)} />}
      {showSettings    && <SettingsModal    onClose={() => setShowSettings(false)} settings={settings} setSettings={setSettings} user={user} />}
      {showDataSources && <DataSourcesModal onClose={() => setShowDataSources(false)} />}
    </div>
  )
}
