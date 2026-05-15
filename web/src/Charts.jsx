import { useState, useMemo, useRef, useEffect } from 'react'
import {
  BarChart, Bar, Cell,
  AreaChart, Area,
  PieChart, Pie,
  ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

// ── Color palette ──────────────────────────────────────────────────────────────

const C = {
  green:  '#22c55e',
  red:    '#ef4444',
  blue:   '#60a5fa',
  amber:  '#f59e0b',
  purple: '#a78bfa',
  slate:  '#64748b',
  teal:   '#2dd4bf',
  navy:   '#111827',
}

const TOOLTIP = {
  contentStyle: {
    background: '#0f1828',
    border: '1px solid #1e293b',
    borderRadius: 8,
    fontSize: 11,
    color: '#e2e8f0',
    padding: '8px 12px',
  },
  labelStyle: { color: '#94a3b8', marginBottom: 2, fontSize: 11 },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
  itemStyle: { color: '#e2e8f0', fontSize: 11 },
}
const TICK = { fill: '#64748b', fontSize: 10 }
const GRID = { strokeDasharray: '3 3', stroke: '#1e293b', vertical: false }

// ── Helpers ────────────────────────────────────────────────────────────────────

function signalFill(score) {
  if (score >= 8) return C.red
  if (score >= 5) return C.amber
  if (score >= 3) return '#94a3b8'
  return C.slate
}
function avgSignalFill(avg) {
  if (avg >= 7) return C.red
  if (avg >= 5) return C.amber
  return C.slate
}
function fmtMoney(v) {
  if (!v) return '$0'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toLocaleString()}`
}
function dateKey(iso)  { return iso ? iso.slice(0, 10) : null }
function weekKey(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  const diff = (d.getDay() + 6) % 7   // Monday = 0
  const mon = new Date(d)
  mon.setDate(d.getDate() - diff)
  return mon.toISOString().slice(0, 10)
}
function monthKey(iso) { return iso ? iso.slice(0, 7) : null }
function fmtMD(s) {
  try { return new Date(s + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  catch { return s }
}
function fmtMon(s) {
  try { return new Date(s + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }
  catch { return s }
}
function partyKey(party) {
  const p = (party || '').toLowerCase()
  if (p.includes('dem') || p === 'd') return 'Democrat'
  if (p.includes('rep') || p === 'r') return 'Republican'
  return 'Independent'
}

// ── Analytics Filter Defaults (exported) ──────────────────────────────────────

export const DEFAULT_ANALYTICS_FILTERS = {
  dateRange: '30D',
  sources:   ['insider', 'congress', 'contracts'],
  party:     'all',
  minSignal: 1,
  tickers:   [],
}

function isDefaultAnalyticsFilters(f) {
  return f.dateRange === '30D' && f.sources.length === 3 &&
    f.party === 'all' && f.minSignal === 1 && f.tickers.length === 0
}

function cutoffDate(range) {
  if (range === 'All') return null
  const days = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }[range] || 30
  return new Date(Date.now() - days * 864e5)
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function ChartCard({ title, children, height = 180 }) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">{title}</div>
      <div style={{ height, width: '100%' }}>{children}</div>
    </div>
  )
}

function StatCard({ title, value, sub, color }) {
  return (
    <div className="chart-card chart-stat-card">
      <div className="chart-card-title">{title}</div>
      <div className="chart-stat-value" style={{ color: color || '#fff' }}>{value}</div>
      {sub && <div className="chart-stat-sub">{sub}</div>}
    </div>
  )
}

function ChartEmpty({ text = 'Not enough data' }) {
  return <div className="chart-empty">{text}</div>
}

function DonutCenter({ value, label }) {
  return (
    <div className="donut-center">
      <span className="donut-center-num">{value}</span>
      <span className="donut-center-label">{label}</span>
    </div>
  )
}

// ── A1: Signal distribution ────────────────────────────────────────────────────

function SignalDistributionChart({ filings }) {
  const data = useMemo(() => {
    const counts = {}
    for (let i = 1; i <= 10; i++) counts[i] = 0
    filings.forEach(f => { if (f.signal_score >= 1 && f.signal_score <= 10) counts[f.signal_score]++ })
    return Array.from({ length: 10 }, (_, i) => ({
      score: i + 1,
      count: counts[i + 1],
      fill:  signalFill(i + 1),
    }))
  }, [filings])

  if (!filings.length) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="score" tick={TICK} />
        <YAxis tick={TICK} allowDecimals={false} />
        <Tooltip {...TOOLTIP} formatter={v => [v, 'Filings']} labelFormatter={l => `Score ${l}`} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── A2 / C1: Buy‑sell donut / Party donut ─────────────────────────────────────

function DonutChart({ data, centerValue, centerLabel, height = 160 }) {
  if (!data.some(d => d.value > 0)) return <ChartEmpty />
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="72%"
            dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
            {data.map((e, i) => <Cell key={i} fill={e.color} />)}
          </Pie>
          <Tooltip {...TOOLTIP} formatter={(v, name) => [v, name]} />
        </PieChart>
      </ResponsiveContainer>
      <DonutCenter value={centerValue} label={centerLabel} />
    </div>
  )
}

function BuySellDonut({ filings }) {
  const { data, total } = useMemo(() => {
    let buys = 0, sells = 0, other = 0
    filings.forEach(f => {
      if (f.acquired_disposed === 'A') buys++
      else if (f.acquired_disposed === 'D') sells++
      else other++
    })
    const data = [
      { name: 'Buys',  value: buys,  color: C.green },
      { name: 'Sells', value: sells, color: C.red   },
    ]
    if (other) data.push({ name: 'Other', value: other, color: C.slate })
    return { data, total: filings.length }
  }, [filings])
  return <DonutChart data={data} centerValue={total} centerLabel="total" />
}

function PartyDonut({ filings }) {
  const { data, total } = useMemo(() => {
    let dem = 0, rep = 0, ind = 0
    filings.forEach(f => {
      const p = partyKey(f.party)
      if (p === 'Democrat') dem++
      else if (p === 'Republican') rep++
      else ind++
    })
    return {
      data: [
        { name: 'Democrat',    value: dem, color: '#60a5fa' },
        { name: 'Republican',  value: rep, color: '#f87171' },
        { name: 'Independent', value: ind, color: C.slate   },
      ].filter(d => d.value > 0),
      total: filings.length,
    }
  }, [filings])
  return <DonutChart data={data} centerValue={total} centerLabel="trades" />
}

// ── A3: Top tickers ────────────────────────────────────────────────────────────

function TopTickersChart({ filings }) {
  const data = useMemo(() => {
    const map = {}
    filings.forEach(f => {
      if (!f.ticker) return
      if (!map[f.ticker]) map[f.ticker] = { name: f.ticker, count: 0, scoreSum: 0 }
      map[f.ticker].count++
      map[f.ticker].scoreSum += f.signal_score || 0
    })
    return Object.values(map)
      .map(t => ({ ...t, avg: t.count ? t.scoreSum / t.count : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [filings])

  if (!data.length) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={TICK} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={TICK} width={38} />
        <Tooltip {...TOOLTIP} formatter={v => [v, 'Filings']} />
        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
          {data.map((e, i) => <Cell key={i} fill={avgSignalFill(e.avg)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── A4: Volume over time ───────────────────────────────────────────────────────

function VolumeOverTimeChart({ filings }) {
  const data = useMemo(() => {
    const cutoff = Date.now() - 30 * 864e5
    const map = {}
    filings.forEach(f => {
      if (!f.filed_at || !f.amount) return
      const d = new Date(f.filed_at)
      if (isNaN(d) || d.getTime() < cutoff) return
      const k = dateKey(f.filed_at)
      map[k] = (map[k] || 0) + f.amount
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date: fmtMD(date), value }))
  }, [filings])

  if (data.length < 2) return <ChartEmpty text="No volume data available" />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.blue} stopOpacity={0.3} />
            <stop offset="95%" stopColor={C.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" tick={TICK} interval="preserveStartEnd" />
        <YAxis tick={TICK} tickFormatter={fmtMoney} />
        <Tooltip {...TOOLTIP} formatter={v => [fmtMoney(v), 'Volume']} />
        <Area type="monotone" dataKey="value" stroke={C.blue} fill="url(#blueGrad)"
          strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── C2: Direction by party ─────────────────────────────────────────────────────

function DirectionByPartyChart({ filings }) {
  const data = useMemo(() => {
    const m = { Democrat: { buys: 0, sells: 0 }, Republican: { buys: 0, sells: 0 }, Independent: { buys: 0, sells: 0 } }
    filings.forEach(f => {
      const p = partyKey(f.party)
      if (f.acquired_disposed === 'A') m[p].buys++
      else if (f.acquired_disposed === 'D') m[p].sells++
    })
    return Object.entries(m)
      .filter(([, v]) => v.buys + v.sells > 0)
      .map(([party, v]) => ({ party: party.slice(0, 3), ...v }))
  }, [filings])

  if (!data.length) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="party" tick={TICK} />
        <YAxis tick={TICK} allowDecimals={false} />
        <Tooltip {...TOOLTIP} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 4 }} />
        <Bar dataKey="buys"  name="Buys"  fill={C.green} radius={[3, 3, 0, 0]} />
        <Bar dataKey="sells" name="Sells" fill={C.red}   radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── C3: Most active politicians ────────────────────────────────────────────────

function MostActivePoliticiansChart({ filings }) {
  const data = useMemo(() => {
    const map = {}
    filings.forEach(f => {
      if (!f.politician) return
      map[f.politician] = (map[f.politician] || 0) + 1
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([full, count]) => ({
        name:     full.split(' ').slice(-1)[0],
        fullName: full,
        count,
      }))
  }, [filings])

  if (!data.length) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={TICK} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={TICK} width={52} />
        <Tooltip {...TOOLTIP}
          formatter={v => [v, 'Trades']}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''} />
        <Bar dataKey="count" fill={C.purple} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── C4: Late disclosure stat ───────────────────────────────────────────────────

function LateDisclosureStat({ filings }) {
  const { pct, late, total } = useMemo(() => {
    const late  = filings.filter(f => (f.days_to_disclosure ?? 0) > 30).length
    const total = filings.length
    return { pct: total > 0 ? Math.round((late / total) * 100) : 0, late, total }
  }, [filings])

  const color = pct >= 40 ? C.red : pct >= 20 ? C.amber : C.green
  return (
    <StatCard
      title="Disclosure compliance"
      value={`${pct}%`}
      sub={`${late} of ${total} trades disclosed late (>30 days)`}
      color={color}
    />
  )
}

// ── T1: Top agencies ───────────────────────────────────────────────────────────

function TopAgenciesChart({ contracts }) {
  const data = useMemo(() => {
    const map = {}
    contracts.forEach(c => {
      if (!c.agency) return
      map[c.agency] = (map[c.agency] || 0) + (c.amount || 0)
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([full, value]) => ({
        name:     full.length > 22 ? full.slice(0, 20) + '…' : full,
        fullName: full,
        value,
      }))
  }, [contracts])

  if (!data.length) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={TICK} tickFormatter={fmtMoney} />
        <YAxis type="category" dataKey="name" tick={TICK} width={82} />
        <Tooltip {...TOOLTIP}
          formatter={v => [fmtMoney(v), 'Total']}
          labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''} />
        <Bar dataKey="value" fill={C.teal} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── T2: Contract volume over time ─────────────────────────────────────────────

function ContractVolumeChart({ contracts }) {
  const data = useMemo(() => {
    const map = {}
    contracts.forEach(c => {
      if (!c.date || !c.amount) return
      const k = monthKey(c.date)
      if (!k) return
      map[k] = (map[k] || 0) + c.amount
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, value]) => ({ month: fmtMon(m), value }))
  }, [contracts])

  if (data.length < 2) return <ChartEmpty text="No time-series data" />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.teal} stopOpacity={0.3} />
            <stop offset="95%" stopColor={C.teal} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="month" tick={TICK} interval="preserveStartEnd" />
        <YAxis tick={TICK} tickFormatter={fmtMoney} />
        <Tooltip {...TOOLTIP} formatter={v => [fmtMoney(v), 'Value']} />
        <Area type="monotone" dataKey="value" stroke={C.teal} fill="url(#tealGrad)"
          strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── T3: Insider crossover stat ────────────────────────────────────────────────

function InsiderCrossoverStat({ contracts }) {
  const { count, total } = useMemo(() => ({
    count: contracts.filter(c => c.insider_tickers?.length > 0).length,
    total: contracts.length,
  }), [contracts])
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <StatCard
      title="Insider crossover"
      value={count}
      sub={`${pct}% of contracts overlap with insider-traded companies`}
      color={C.green}
    />
  )
}

// ── T4: Top recipients ────────────────────────────────────────────────────────

function TopRecipientsChart({ contracts }) {
  const data = useMemo(() => {
    const map = {}
    contracts.forEach(c => {
      if (!c.recipient) return
      map[c.recipient] = (map[c.recipient] || 0) + (c.amount || 0)
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([full, value]) => ({
        name:     full.length > 22 ? full.slice(0, 20) + '…' : full,
        fullName: full,
        value,
      }))
  }, [contracts])

  if (!data.length) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={TICK} tickFormatter={fmtMoney} />
        <YAxis type="category" dataKey="name" tick={TICK} width={82} />
        <Tooltip {...TOOLTIP}
          formatter={v => [fmtMoney(v), 'Total']}
          labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''} />
        <Bar dataKey="value" fill={C.blue} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Summary grids ─────────────────────────────────────────────────────────────

function InsiderSummaryCharts({ filings }) {
  return (
    <div className="summary-chart-grid">
      <ChartCard title="Signal distribution"><SignalDistributionChart filings={filings} /></ChartCard>
      <ChartCard title="Buy / sell ratio" height={160}><BuySellDonut filings={filings} /></ChartCard>
      <ChartCard title="Most active tickers"><TopTickersChart filings={filings} /></ChartCard>
      <ChartCard title="Transaction volume"><VolumeOverTimeChart filings={filings} /></ChartCard>
    </div>
  )
}

function CongressSummaryCharts({ filings }) {
  return (
    <div className="summary-chart-grid">
      <ChartCard title="Trades by party" height={160}><PartyDonut filings={filings} /></ChartCard>
      <ChartCard title="Direction by party"><DirectionByPartyChart filings={filings} /></ChartCard>
      <ChartCard title="Most active members"><MostActivePoliticiansChart filings={filings} /></ChartCard>
      <LateDisclosureStat filings={filings} />
    </div>
  )
}

function ContractsSummaryCharts({ contracts }) {
  return (
    <div className="summary-chart-grid">
      <ChartCard title="Top awarding agencies"><TopAgenciesChart contracts={contracts} /></ChartCard>
      <ChartCard title="Contract activity"><ContractVolumeChart contracts={contracts} /></ChartCard>
      <InsiderCrossoverStat contracts={contracts} />
      <ChartCard title="Top contract recipients"><TopRecipientsChart contracts={contracts} /></ChartCard>
    </div>
  )
}

// ── Mini Multi-Select (for analytics filter bar) ──────────────────────────────

function MiniMultiSelect({ placeholder, options, selected, onAdd, onRemove }) {
  const [inputVal, setInputVal] = useState('')
  const [open, setOpen]         = useState(false)
  const wrapRef = useRef(null)

  const sugg = useMemo(() =>
    options.filter(o => o.toLowerCase().includes(inputVal.toLowerCase()) && !selected.includes(o)).slice(0, 8),
    [options, inputVal, selected]
  )

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="afb-ms" ref={wrapRef}>
      <div className="afb-ms-field" onClick={() => setOpen(true)}>
        {selected.map(s => (
          <span key={s} className="afb-ms-pill">{s}
            <button type="button" className="afb-ms-pill-x"
              onClick={e => { e.stopPropagation(); onRemove(s) }}>×</button>
          </span>
        ))}
        <input className="afb-ms-input" value={inputVal}
          onChange={e => { setInputVal(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
        />
      </div>
      {open && sugg.length > 0 && (
        <div className="afb-ms-dropdown">
          {sugg.map(o => (
            <div key={o} className="afb-ms-option"
              onMouseDown={e => { e.preventDefault(); onAdd(o); setInputVal(''); setOpen(false) }}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Analytics Filter Bar ───────────────────────────────────────────────────────

function AnalyticsFilterBar({ filters, onChange, allTickers }) {
  const nonDefault = !isDefaultAnalyticsFilters(filters)

  const setF = (key, val) => {
    const next = { ...filters, [key]: val }
    onChange(next)
    try { localStorage.setItem('evenfield_analytics_filters', JSON.stringify(next)) } catch {}
  }

  const toggleSource = src => {
    const srcs = filters.sources.includes(src)
      ? filters.sources.filter(s => s !== src)
      : [...filters.sources, src]
    if (srcs.length === 0) return // require ≥1
    setF('sources', srcs)
  }

  const partyOpts = [
    { key: 'all',         label: 'All'  },
    { key: 'Democrat',    label: 'Dem'  },
    { key: 'Republican',  label: 'Rep'  },
    { key: 'Independent', label: 'Ind'  },
  ]

  return (
    <div className="analytics-filter-bar">
      {/* Date range */}
      <div className="afb-group">
        <span className="afb-label">Period</span>
        <div className="afb-segs">
          {['7D', '30D', '90D', '1Y', 'All'].map(r => (
            <button key={r} className={`afb-seg ${filters.dateRange === r ? 'active' : ''}`}
              onClick={() => setF('dateRange', r)}>{r}</button>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div className="afb-group">
        <span className="afb-label">Sources</span>
        <div className="afb-checks">
          {[['insider', 'Insider'], ['congress', 'Congress'], ['contracts', 'Contracts']].map(([k, label]) => (
            <label key={k} className="afb-check">
              <input type="checkbox" checked={filters.sources.includes(k)} onChange={() => toggleSource(k)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Party */}
      <div className="afb-group">
        <span className="afb-label">Party</span>
        <div className="afb-segs">
          {partyOpts.map(({ key, label }) => (
            <button key={key} className={`afb-seg ${filters.party === key ? 'active' : ''}`}
              onClick={() => setF('party', key)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Min signal */}
      <div className="afb-group">
        <span className="afb-label">Min signal: <strong>{filters.minSignal}</strong></span>
        <input type="range" min="1" max="10" value={filters.minSignal} className="afb-range"
          onChange={e => setF('minSignal', parseInt(e.target.value))} />
      </div>

      {/* Tickers */}
      {allTickers.length > 0 && (
        <div className="afb-group afb-group-grow">
          <span className="afb-label">Tickers</span>
          <MiniMultiSelect
            placeholder="Filter by ticker…"
            options={allTickers}
            selected={filters.tickers}
            onAdd={v => setF('tickers', [...filters.tickers, v])}
            onRemove={v => setF('tickers', filters.tickers.filter(t => t !== v))}
          />
        </div>
      )}

      {/* Reset */}
      {nonDefault && (
        <button className="afb-reset" onClick={() => {
          onChange({ ...DEFAULT_ANALYTICS_FILTERS })
          try { localStorage.removeItem('evenfield_analytics_filters') } catch {}
        }}>Reset</button>
      )}
    </div>
  )
}

// ── Toggle icon ───────────────────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="7.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="1" y="7.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

// ── SummaryChartsSection (exported) ──────────────────────────────────────────

export function SummaryChartsSection({ activeTab, insiderFilings, congressFilings, contracts }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('ef_charts_open') === '1' } catch { return false }
  })

  const toggle = () => setOpen(o => {
    const next = !o
    try { localStorage.setItem('ef_charts_open', next ? '1' : '0') } catch {}
    return next
  })

  const empty = (activeTab === 'insider' && !insiderFilings.length)
    || (activeTab === 'congress' && !congressFilings.length)
    || (activeTab === 'contracts' && !contracts.length)

  return (
    <div className="summary-charts-section">
      <button className={`summary-chart-toggle ${open ? 'active' : ''}`} onClick={toggle}>
        <GridIcon />
        {open ? 'Hide summary' : 'Show summary'}
      </button>
      {open && !empty && (
        <div className="summary-chart-body">
          {activeTab === 'insider'   && <InsiderSummaryCharts   filings={insiderFilings}  />}
          {activeTab === 'congress'  && <CongressSummaryCharts  filings={congressFilings} />}
          {activeTab === 'contracts' && <ContractsSummaryCharts contracts={contracts}     />}
        </div>
      )}
      {open && empty && <div className="chart-empty" style={{ paddingBottom: 16 }}>No data loaded yet</div>}
    </div>
  )
}

// ── AnalyticsView (exported) ──────────────────────────────────────────────────

export function AnalyticsView({ insiderFilings, congressFilings, contracts, analyticsFilters, onAnalyticsFiltersChange }) {
  // Apply analytics filters to produce filtered data for charts
  const cutoff = useMemo(() => cutoffDate(analyticsFilters.dateRange), [analyticsFilters.dateRange])

  const filtI = useMemo(() => {
    if (!analyticsFilters.sources.includes('insider')) return []
    let r = insiderFilings
    if (cutoff) r = r.filter(f => f.filed_at && new Date(f.filed_at) >= cutoff)
    if (analyticsFilters.minSignal > 1) r = r.filter(f => (f.signal_score || 0) >= analyticsFilters.minSignal)
    if (analyticsFilters.tickers.length) r = r.filter(f => analyticsFilters.tickers.includes(f.ticker))
    return r
  }, [insiderFilings, cutoff, analyticsFilters])

  const filtC = useMemo(() => {
    if (!analyticsFilters.sources.includes('congress')) return []
    let r = congressFilings
    if (cutoff) r = r.filter(f => { const d = f.trade_date || f.filed_at; return d && new Date(d) >= cutoff })
    if (analyticsFilters.party !== 'all') r = r.filter(f => partyKey(f.party) === analyticsFilters.party)
    if (analyticsFilters.minSignal > 1) r = r.filter(f => (f.signal_score || 0) >= analyticsFilters.minSignal)
    if (analyticsFilters.tickers.length) r = r.filter(f => analyticsFilters.tickers.includes(f.ticker))
    return r
  }, [congressFilings, cutoff, analyticsFilters])

  const filtCo = useMemo(() => {
    if (!analyticsFilters.sources.includes('contracts')) return []
    let r = contracts
    if (cutoff) r = r.filter(c => c.date && new Date(c.date) >= cutoff)
    return r
  }, [contracts, cutoff, analyticsFilters])

  const allTickers = useMemo(() => {
    const s = new Set()
    insiderFilings.forEach(f => f.ticker && s.add(f.ticker))
    congressFilings.forEach(f => f.ticker && s.add(f.ticker))
    return [...s].sort()
  }, [insiderFilings, congressFilings])

  // Overview stats (uses filtered data)
  const stats = useMemo(() => {
    const today     = new Date().toISOString().slice(0, 10)
    const thisMonth = new Date().toISOString().slice(0, 7)
    const all       = [...filtI, ...filtC]
    const highToday = all.filter(f =>
      (f.signal_score || 0) >= 7 &&
      (f.filed_at || f.trade_date || '').slice(0, 10) === today
    ).length
    const totalVol = filtI.reduce((s, f) => s + (f.amount || 0), 0)
    const congMonth = filtC.filter(f =>
      (f.trade_date || f.filed_at || '').slice(0, 7) === thisMonth
    ).length
    return {
      total: filtI.length + filtC.length + filtCo.length,
      highToday,
      totalVol,
      congMonth,
    }
  }, [filtI, filtC, filtCo])

  // Signal over time (all filtered filings, by date)
  const signalOverTime = useMemo(() => {
    const map = {}
    ;[...filtI, ...filtC].forEach(f => {
      const k = dateKey(f.filed_at || f.trade_date)
      if (!k) return
      if (!map[k]) map[k] = { date: k, scoreSum: 0, count: 0 }
      map[k].scoreSum += f.signal_score || 0
      map[k].count++
    })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ date: fmtMD(d.date), avgSignal: +(d.scoreSum / d.count).toFixed(1), count: d.count }))
  }, [filtI, filtC])

  // By week
  const insiderByWeek = useMemo(() => {
    const map = {}
    filtI.forEach(f => { const k = weekKey(f.filed_at); if (k) map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([w, count]) => ({ week: fmtMD(w), count }))
  }, [filtI])

  const congressByWeek = useMemo(() => {
    const map = {}
    filtC.forEach(f => { const k = weekKey(f.trade_date || f.filed_at); if (k) map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([w, count]) => ({ week: fmtMD(w), count }))
  }, [filtC])

  // Top bought / sold
  const { topBought, topSold } = useMemo(() => {
    const buys = {}, sells = {}
    filtI.forEach(f => {
      if (!f.ticker) return
      if (f.acquired_disposed === 'A') buys[f.ticker]  = (buys[f.ticker]  || 0) + 1
      if (f.acquired_disposed === 'D') sells[f.ticker] = (sells[f.ticker] || 0) + 1
    })
    return {
      topBought: Object.entries(buys).sort(([,a],[,b]) => b-a).slice(0,10).map(([name,count]) => ({name,count})),
      topSold:   Object.entries(sells).sort(([,a],[,b]) => b-a).slice(0,10).map(([name,count]) => ({name,count})),
    }
  }, [filtI])

  // Congress by party over time
  const congPartyTime = useMemo(() => {
    const map = {}
    filtC.forEach(f => {
      const m = monthKey(f.trade_date || f.filed_at)
      if (!m) return
      if (!map[m]) map[m] = { month: m, demBuy: 0, demSell: 0, repBuy: 0, repSell: 0 }
      const p   = partyKey(f.party)
      const buy = f.acquired_disposed === 'A'
      if (p === 'Democrat')   { if (buy) map[m].demBuy++;  else map[m].demSell++ }
      if (p === 'Republican') { if (buy) map[m].repBuy++;  else map[m].repSell++ }
    })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-8)
      .map(m => ({ ...m, month: fmtMon(m.month) }))
  }, [filtC])

  // Contract leaders (top 15 by total, colored by insider activity)
  const contractLeaders = useMemo(() => {
    const map = {}
    filtCo.forEach(c => {
      if (!c.recipient) return
      if (!map[c.recipient]) map[c.recipient] = { name: c.recipient, value: 0, hasInsider: false }
      map[c.recipient].value += c.amount || 0
      if (c.insider_tickers?.length) map[c.recipient].hasInsider = true
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 15)
      .map(r => ({ ...r, name: r.name.length > 26 ? r.name.slice(0, 24) + '…' : r.name }))
  }, [filtCo])

  // Data freshness — uses raw unfiltered counts (about pipeline, not filters)
  const freshness = useMemo(() => {
    const maxFetched = arr => {
      const dates = arr.map(f => f.fetched_at).filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d))
      return dates.length ? new Date(Math.max(...dates)) : null
    }
    return {
      insider:   { date: maxFetched(insiderFilings),  count: insiderFilings.length },
      congress:  { date: maxFetched(congressFilings), count: congressFilings.length },
      contracts: { date: maxFetched(contracts),       count: contracts.length },
    }
  }, [insiderFilings, congressFilings, contracts])

  function statusOf(date) {
    if (!date) return { label: 'No data', cls: 'fresh-stale' }
    const h = (Date.now() - date.getTime()) / 3_600_000
    if (h < 4)  return { label: 'Healthy', cls: 'fresh-ok' }
    if (h < 24) return { label: 'Warning', cls: 'fresh-warn' }
    return { label: 'Stale', cls: 'fresh-stale' }
  }
  function ageOf(date) {
    if (!date) return '—'
    const h = Math.floor((Date.now() - date.getTime()) / 3_600_000)
    if (h < 1) return 'Just now'
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const freshnessRows = [
    { key: 'insider',   label: 'Insider Trades (SEC EDGAR)',         ...freshness.insider },
    { key: 'congress',  label: 'Congress (STOCK Act)',               ...freshness.congress },
    { key: 'contracts', label: 'Federal Contracts (USASpending.gov)',...freshness.contracts },
  ]

  return (
    <div className="analytics-view">

      {/* ── Analytics Filter Bar ────────────────────────────── */}
      <AnalyticsFilterBar
        filters={analyticsFilters}
        onChange={onAnalyticsFiltersChange}
        allTickers={allTickers}
      />

      {/* ── Section 1: Overview ─────────────────────────────── */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">Overview</h2>
        <div className="analytics-metrics-row">
          <div className="analytics-metric">
            <div className="analytics-metric-label">Total filings tracked</div>
            <div className="analytics-metric-value">{stats.total.toLocaleString()}</div>
            <div className="analytics-metric-sub">All sources combined</div>
          </div>
          <div className="analytics-metric">
            <div className="analytics-metric-label">High signal today</div>
            <div className="analytics-metric-value" style={{ color: C.red }}>{stats.highToday}</div>
            <div className="analytics-metric-sub">Score ≥ 7 filed today</div>
          </div>
          <div className="analytics-metric">
            <div className="analytics-metric-label">Insider trade volume</div>
            <div className="analytics-metric-value" style={{ color: C.blue }}>{fmtMoney(stats.totalVol)}</div>
            <div className="analytics-metric-sub">Total disclosed transactions</div>
          </div>
          <div className="analytics-metric">
            <div className="analytics-metric-label">Congressional this month</div>
            <div className="analytics-metric-value" style={{ color: C.purple }}>{stats.congMonth}</div>
            <div className="analytics-metric-sub">Trades filed this month</div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Signal over time ─────────────────────── */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">Signal activity over time</h2>
        <div className="analytics-chart-full">
          {signalOverTime.length < 3 ? <ChartEmpty text="Not enough data for timeline" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={signalOverTime} margin={{ top: 8, right: 36, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="sigGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.amber} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.amber} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="date" tick={TICK} interval="preserveStartEnd" />
                <YAxis yAxisId="sig" tick={TICK} domain={[0, 10]}
                  label={{ value: 'Avg Score', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 9, dx: 12 }} />
                <YAxis yAxisId="cnt" orientation="right" tick={TICK}
                  label={{ value: 'Count', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 9, dx: -8 }} />
                <Tooltip {...TOOLTIP} />
                <Area yAxisId="sig" type="monotone" dataKey="avgSignal" name="Avg Signal"
                  stroke={C.amber} fill="url(#sigGrad)" strokeWidth={2} dot={false} />
                <Line yAxisId="cnt" type="monotone" dataKey="count" name="Filings"
                  stroke={C.blue} strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Section 3: Insider vs Congress by week ───────────── */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">Insider vs congressional activity</h2>
        <div className="analytics-chart-pair">
          <div className="analytics-chart-half">
            <div className="analytics-chart-subtitle">Insider trades per week</div>
            <div className="analytics-chart-inner">
              {insiderByWeek.length < 2 ? <ChartEmpty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insiderByWeek} margin={{ top: 4, right: 4, left: -24, bottom: 20 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="week" tick={TICK} angle={-35} textAnchor="end" interval="preserveStartEnd" />
                    <YAxis tick={TICK} allowDecimals={false} />
                    <Tooltip {...TOOLTIP} formatter={v => [v, 'Filings']} />
                    <Bar dataKey="count" name="Filings" fill={C.blue} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="analytics-chart-half">
            <div className="analytics-chart-subtitle">Congressional trades per week</div>
            <div className="analytics-chart-inner">
              {congressByWeek.length < 2 ? <ChartEmpty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={congressByWeek} margin={{ top: 4, right: 4, left: -24, bottom: 20 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="week" tick={TICK} angle={-35} textAnchor="end" interval="preserveStartEnd" />
                    <YAxis tick={TICK} allowDecimals={false} />
                    <Tooltip {...TOOLTIP} formatter={v => [v, 'Filings']} />
                    <Bar dataKey="count" name="Trades" fill={C.purple} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Top movers ────────────────────────────── */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">Top movers — insider trades</h2>
        <div className="analytics-chart-pair">
          <div className="analytics-chart-half">
            <div className="analytics-chart-subtitle">Most bought tickers</div>
            <div className="analytics-chart-inner">
              {!topBought.length ? <ChartEmpty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topBought} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={TICK} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={TICK} width={38} />
                    <Tooltip {...TOOLTIP} formatter={v => [v, 'Buys']} />
                    <Bar dataKey="count" fill={C.green} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="analytics-chart-half">
            <div className="analytics-chart-subtitle">Most sold tickers</div>
            <div className="analytics-chart-inner">
              {!topSold.length ? <ChartEmpty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSold} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={TICK} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={TICK} width={38} />
                    <Tooltip {...TOOLTIP} formatter={v => [v, 'Sells']} />
                    <Bar dataKey="count" fill={C.red} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 5: Congress by party over time ───────────── */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">Congressional trading by party over time</h2>
        <div className="analytics-chart-full">
          {congPartyTime.length < 2 ? <ChartEmpty text="Not enough historical data" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={congPartyTime} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" tick={TICK} />
                <YAxis tick={TICK} allowDecimals={false} />
                <Tooltip {...TOOLTIP} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 6 }} />
                <Bar dataKey="demBuy"  name="Dem Buys"  fill="#60a5fa" radius={[2,2,0,0]} />
                <Bar dataKey="demSell" name="Dem Sells" fill="#3b82f6" radius={[2,2,0,0]} />
                <Bar dataKey="repBuy"  name="Rep Buys"  fill="#f87171" radius={[2,2,0,0]} />
                <Bar dataKey="repSell" name="Rep Sells" fill="#dc2626" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Section 6: Contract leaders ─────────────────────── */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">Federal contract leaders</h2>
        <p className="analytics-section-sub">
          <span className="insider-accent-dot" /> Green bars = companies with recent insider trading activity
        </p>
        <div className="analytics-chart-full" style={{ height: 340 }}>
          {!contractLeaders.length ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contractLeaders} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={TICK} tickFormatter={fmtMoney} />
                <YAxis type="category" dataKey="name" tick={TICK} width={116} />
                <Tooltip {...TOOLTIP}
                  formatter={v => [fmtMoney(v), 'Contract total']} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {contractLeaders.map((e, i) => (
                    <Cell key={i} fill={e.hasInsider ? C.green : C.slate} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Section 7: Data freshness ────────────────────────── */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">Data freshness</h2>
        <div className="freshness-panel">
          {freshnessRows.map(src => {
            const { label: statusLabel, cls } = statusOf(src.date)
            return (
              <div key={src.key} className="freshness-row">
                <span className="freshness-source">{src.label}</span>
                <div className="freshness-meta">
                  <span className={`freshness-badge ${cls}`}>{statusLabel}</span>
                  <span className="freshness-age">{ageOf(src.date)}</span>
                  <span className="freshness-count">{src.count.toLocaleString()} records</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ── Sector keyword matching ────────────────────────────────────────────────────

function getSector(ticker, desc) {
  const text = `${ticker || ''} ${desc || ''}`.toLowerCase()
  if (/tech|software|semi|chip|data|cloud|cyber|digital|ai |compute/.test(text)) return 'Technology'
  if (/pharma|drug|bio|health|medical|hospital|genomic|therapeut/.test(text))    return 'Healthcare'
  if (/bank|financ|capital|invest|fund|credit|insurance|brokerage/.test(text))   return 'Finance'
  if (/energy|oil|gas|coal|renew|solar|wind|electric|utility/.test(text))        return 'Energy'
  if (/defense|weapon|militar|aerospace|lockheed|boeing|raytheon/.test(text))    return 'Defense'
  if (/real estate|reit|property/.test(text))                                    return 'Real Estate'
  if (/retail|consumer|food|beverage|restau|grocery/.test(text))                 return 'Consumer'
  if (/transport|airline|ship|freight|logistic/.test(text))                      return 'Transport'
  return 'Other'
}

// ── Insider Drill-Down Charts ─────────────────────────────────────────────────

function InsiderDrillCharts({ filing, allInsider }) {
  const related = useMemo(() =>
    allInsider.filter(f => f.ticker === filing.ticker)
  , [allInsider, filing.ticker])

  const weeklyData = useMemo(() => {
    const map = {}
    related.forEach(f => {
      const k = weekKey(f.filed_at)
      if (!k) return
      if (!map[k]) map[k] = { week: fmtMD(k), buys: 0, sells: 0 }
      if (f.acquired_disposed === 'A') map[k].buys  += (f.amount || 1000)
      else                             map[k].sells += (f.amount || 1000)
    })
    return Object.values(map).sort((a, b) => a.week.localeCompare(b.week)).slice(-16)
  }, [related])

  const insiderBar = useMemo(() => {
    const map = {}
    related.forEach(f => {
      if (!f.owner) return
      if (!map[f.owner]) map[f.owner] = { name: f.owner.split(' ').slice(-1)[0], full: f.owner, buys: 0, sells: 0 }
      if (f.acquired_disposed === 'A') map[f.owner].buys++
      else map[f.owner].sells++
    })
    return Object.values(map).sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells)).slice(0, 8)
  }, [related])

  const stats = useMemo(() => {
    let buyVol = 0, sellVol = 0
    const insiders = new Set()
    related.forEach(f => {
      insiders.add(f.owner)
      if (f.acquired_disposed === 'A') buyVol  += f.amount || 0
      else                             sellVol += f.amount || 0
    })
    const avgSig = related.length
      ? (related.reduce((s, f) => s + (f.signal_score || 0), 0) / related.length).toFixed(1) : '—'
    return { total: related.length, buyVol, sellVol, insiders: insiders.size, avgSig }
  }, [related])

  return (
    <>
      <div className="drill-charts-pair">
        <div className="drill-chart-half">
          <div className="drill-chart-subtitle">Trade activity — {filing.ticker}</div>
          <div className="drill-chart-inner">
            {weeklyData.length < 2 ? <ChartEmpty text="No historical data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -24, bottom: 20 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="week" tick={TICK} angle={-30} textAnchor="end" interval="preserveStartEnd" />
                  <YAxis tick={TICK} tickFormatter={fmtMoney} />
                  <Tooltip {...TOOLTIP} formatter={v => [fmtMoney(v), '']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 4 }} />
                  <Bar dataKey="buys"  name="Buys"  fill={C.green} radius={[3,3,0,0]} />
                  <Bar dataKey="sells" name="Sells" fill={C.red}   radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="drill-chart-half">
          <div className="drill-chart-subtitle">Insiders trading {filing.ticker}</div>
          <div className="drill-chart-inner">
            {!insiderBar.length ? <ChartEmpty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insiderBar} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={TICK} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={TICK} width={52} />
                  <Tooltip {...TOOLTIP}
                    labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''}
                    formatter={(v, n) => [v, n]} />
                  <Bar dataKey="buys"  name="Buys"  fill={C.green} radius={[0,3,3,0]} />
                  <Bar dataKey="sells" name="Sells" fill={C.red}   radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      <div className="drill-stats-row">
        <div className="drill-stat"><span className="drill-stat-val">{stats.total}</span><span className="drill-stat-label">Total trades</span></div>
        <div className="drill-stat"><span className="drill-stat-val" style={{color:C.green}}>{fmtMoney(stats.buyVol)}</span><span className="drill-stat-label">Buy volume</span></div>
        <div className="drill-stat"><span className="drill-stat-val" style={{color:C.red}}>{fmtMoney(stats.sellVol)}</span><span className="drill-stat-label">Sell volume</span></div>
        <div className="drill-stat"><span className="drill-stat-val">{stats.insiders}</span><span className="drill-stat-label">Unique insiders</span></div>
        <div className="drill-stat"><span className="drill-stat-val">{stats.avgSig}</span><span className="drill-stat-label">Avg signal</span></div>
      </div>
    </>
  )
}

// ── Congress Drill-Down Charts ────────────────────────────────────────────────

function CongressDrillCharts({ filing, allCongress }) {
  const related = useMemo(() =>
    allCongress.filter(f => f.politician === filing.politician)
  , [allCongress, filing.politician])

  const monthlyData = useMemo(() => {
    const map = {}
    related.forEach(f => {
      const k = monthKey(f.trade_date || f.filed_at)
      if (!k) return
      if (!map[k]) map[k] = { month: fmtMon(k), buys: 0, sells: 0 }
      if (f.acquired_disposed === 'A') map[k].buys++
      else map[k].sells++
    })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [related])

  const sectorData = useMemo(() => {
    const map = {}
    related.forEach(f => {
      const s = getSector(f.ticker, f.plain_english)
      map[s] = (map[s] || 0) + 1
    })
    const palette = [C.blue, C.purple, C.green, C.amber, C.red, C.teal, '#94a3b8', '#f97316']
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }))
  }, [related])

  const stats = useMemo(() => {
    const buys  = related.filter(f => f.acquired_disposed === 'A').length
    const sells = related.filter(f => f.acquired_disposed === 'D').length
    const late  = related.filter(f => (f.days_to_disclosure || 0) > 30).length
    const tickers = {}
    related.forEach(f => { if (f.ticker) tickers[f.ticker] = (tickers[f.ticker] || 0) + 1 })
    const top = Object.entries(tickers).sort(([, a], [, b]) => b - a)[0]
    return { total: related.length, buys, sells, late, topTicker: top ? top[0] : '—' }
  }, [related])

  return (
    <>
      <div className="drill-charts-pair">
        <div className="drill-chart-half">
          <div className="drill-chart-subtitle">Trades by month</div>
          <div className="drill-chart-inner">
            {monthlyData.length < 2 ? <ChartEmpty text="No historical data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -24, bottom: 20 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="month" tick={TICK} angle={-30} textAnchor="end" interval="preserveStartEnd" />
                  <YAxis tick={TICK} allowDecimals={false} />
                  <Tooltip {...TOOLTIP} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 4 }} />
                  <Bar dataKey="buys"  name="Buys"  fill={C.green} radius={[3,3,0,0]} />
                  <Bar dataKey="sells" name="Sells" fill={C.red}   radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="drill-chart-half">
          <div className="drill-chart-subtitle">Sectors traded</div>
          <div className="drill-chart-inner">
            <DonutChart data={sectorData} centerValue={stats.total} centerLabel="trades" />
          </div>
        </div>
      </div>
      <div className="drill-stats-row">
        <div className="drill-stat"><span className="drill-stat-val">{stats.total}</span><span className="drill-stat-label">Total trades</span></div>
        <div className="drill-stat"><span className="drill-stat-val" style={{color:C.green}}>{stats.buys}</span><span className="drill-stat-label">Buys</span></div>
        <div className="drill-stat"><span className="drill-stat-val" style={{color:C.red}}>{stats.sells}</span><span className="drill-stat-label">Sells</span></div>
        <div className="drill-stat"><span className="drill-stat-val">{stats.topTicker}</span><span className="drill-stat-label">Top ticker</span></div>
        <div className="drill-stat"><span className="drill-stat-val" style={{color:stats.late>0?C.amber:'#94a3b8'}}>{stats.late}</span><span className="drill-stat-label">Late disclosures</span></div>
      </div>
    </>
  )
}

// ── Contract Drill-Down Charts ────────────────────────────────────────────────

function ContractDrillCharts({ contract, allContracts }) {
  const related = useMemo(() =>
    allContracts.filter(c => c.recipient === contract.recipient)
  , [allContracts, contract.recipient])

  const monthlyData = useMemo(() => {
    const map = {}
    related.forEach(c => {
      const k = monthKey(c.date)
      if (!k) return
      map[k] = (map[k] || 0) + (c.amount || 0)
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, value]) => ({ month: fmtMon(m), value }))
      .slice(-12)
  }, [related])

  const agencyData = useMemo(() => {
    const map = {}
    related.forEach(c => {
      if (!c.agency) return
      map[c.agency] = (map[c.agency] || 0) + (c.amount || 0)
    })
    const palette = [C.teal, C.blue, C.purple, C.amber, C.green, '#94a3b8']
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([name, value], i) => ({
        name:  name.length > 28 ? name.slice(0, 26) + '…' : name,
        value,
        color: palette[i % palette.length],
      }))
  }, [related])

  const stats = useMemo(() => {
    const total = related.reduce((s, c) => s + (c.amount || 0), 0)
    const agencies = {}
    related.forEach(c => { if (c.agency) agencies[c.agency] = (agencies[c.agency] || 0) + (c.amount || 0) })
    const top = Object.entries(agencies).sort(([, a], [, b]) => b - a)[0]
    const hasInsider = related.some(c => c.insider_tickers?.length > 0)
    return { total, count: related.length, topAgency: top ? top[0] : '—', hasInsider }
  }, [related])

  return (
    <>
      <div className="drill-charts-pair">
        <div className="drill-chart-half">
          <div className="drill-chart-subtitle">Contract value by month</div>
          <div className="drill-chart-inner">
            {monthlyData.length < 2 ? <ChartEmpty text="No historical data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -8, bottom: 20 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="month" tick={TICK} angle={-30} textAnchor="end" interval="preserveStartEnd" />
                  <YAxis tick={TICK} tickFormatter={fmtMoney} />
                  <Tooltip {...TOOLTIP} formatter={v => [fmtMoney(v), 'Value']} />
                  <Bar dataKey="value" fill={C.teal} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="drill-chart-half">
          <div className="drill-chart-subtitle">Awarding agencies</div>
          <div className="drill-chart-inner">
            <DonutChart data={agencyData} centerValue={stats.count} centerLabel="contracts" />
          </div>
        </div>
      </div>
      <div className="drill-stats-row">
        <div className="drill-stat"><span className="drill-stat-val">{fmtMoney(stats.total)}</span><span className="drill-stat-label">Total value</span></div>
        <div className="drill-stat"><span className="drill-stat-val">{stats.count}</span><span className="drill-stat-label">Contracts</span></div>
        <div className="drill-stat" style={{flex:2}}>
          <span className="drill-stat-val" style={{fontSize:11}}>
            {stats.topAgency.length > 24 ? stats.topAgency.slice(0, 22) + '…' : stats.topAgency}
          </span>
          <span className="drill-stat-label">Top agency</span>
        </div>
        <div className="drill-stat">
          <span className="drill-stat-val" style={{color: stats.hasInsider ? C.green : '#94a3b8'}}>
            {stats.hasInsider ? '⚡ Active' : 'None'}
          </span>
          <span className="drill-stat-label">Insider activity</span>
        </div>
      </div>
    </>
  )
}

// ── Drill-Down Modal (exported) ───────────────────────────────────────────────

export function DrillDownModal({ type, filing, contract, insiderFilings, congressFilings, contracts, onClose, onViewAll }) {
  const item = type === 'contracts' ? contract : filing

  const title = type === 'insider'
    ? `${item.ticker} — ${item.company || ''}`
    : type === 'congress'
    ? item.politician || '?'
    : item.recipient || '?'

  const subtitle = type === 'insider'
    ? `${item.owner || ''} · ${item.role || 'Insider'}`
    : type === 'congress'
    ? `${item.party ? `(${item.party})` : ''} ${item.chamber || ''}`.trim()
    : item.agency || ''

  const viewAllLabel = type === 'insider'
    ? `View all ${item.ticker} trades`
    : type === 'congress'
    ? `View all trades by ${(item.politician || '').split(' ').slice(-1)[0]}`
    : `View all ${(item.recipient || '').slice(0, 24)} contracts`

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal drill-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="drill-modal-type">
              {type === 'insider' ? '🏦 Insider Trade' : type === 'congress' ? '🏛️ Congressional Trade' : '📋 Federal Contract'}
            </div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <div className="drill-modal-sub">{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="drill-modal-body">
          {type === 'insider'   && <InsiderDrillCharts  filing={item}   allInsider={insiderFilings} />}
          {type === 'congress'  && <CongressDrillCharts filing={item}   allCongress={congressFilings} />}
          {type === 'contracts' && <ContractDrillCharts contract={item} allContracts={contracts} />}
        </div>
        <div className="drill-modal-footer">
          <button className="drill-view-all-btn" onClick={() => onViewAll(type, item)}>
            {viewAllLabel}
          </button>
          <button className="drill-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
