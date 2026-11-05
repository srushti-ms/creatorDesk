import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowRight, BadgeIndianRupee, Bell, BriefcaseBusiness, CalendarClock, Check,
  ChevronDown, CircleAlert, Clock3, Command, FileCheck2, Filter, HeartHandshake,
  LayoutDashboard, LoaderCircle, Menu, Plus, RefreshCw, Search, ShieldCheck, Sparkles,
  Users, X, Pencil, Trash2, ExternalLink,
} from 'lucide-react'
import { api, API_BASE } from './api'

const NAV = [
  ['overview', 'Overview', LayoutDashboard], ['radar', 'Rights Radar', Activity],
  ['brands', 'Brands', HeartHandshake], ['collaborations', 'Collaborations', BriefcaseBusiness],
  ['rights', 'Usage rights', FileCheck2], ['exclusivity', 'Exclusivity', ShieldCheck],
]
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const date = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const shortDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No expiry'
const label = (value = '') => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const indiaToday = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10)
const daysUntil = (value) => Math.round((Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) - Date.parse(`${indiaToday()}T00:00:00Z`)) / 86400000)

export default function App() {
  const [page, setPage] = useState('overview'), [mobileNav, setMobileNav] = useState(false)
  const [health, setHealth] = useState('checking'), [refreshKey, setRefreshKey] = useState(0)
  const [dialog, setDialog] = useState(null), [search, setSearch] = useState(''), [toast, setToast] = useState(''), [focusRecord, setFocusRecord] = useState(null)
  const refresh = () => setRefreshKey((x) => x + 1)
  const navigate = (next) => { setPage(next); setMobileNav(false); setFocusRecord(null) }
  const openRecord = (result) => { setSearch(result.filter); setFocusRecord({ page: result.page, id: String(result.id) }); setPage(result.page); setMobileNav(false) }
  const notify = (text) => { setToast(text); window.setTimeout(() => setToast(''), 3000) }
  useEffect(() => { let live = true; api.health().then(() => live && setHealth('online')).catch(() => live && setHealth('offline')); return () => { live = false } }, [refreshKey])
  useEffect(() => { const listener = (event) => navigate(event.detail); window.addEventListener('creator-navigate', listener); return () => window.removeEventListener('creator-navigate', listener) }, [])
  const add = (kind, record = null) => setDialog({ kind, record })
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Command size={19} /></div><div><strong>CreatorDesk</strong><span>Creator business, in control</span></div><button className="icon-button mobile-close" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="nav-group"><div className="nav-caption">Workspace</div>{NAV.slice(0, 2).map(([id, name, Icon]) => <NavButton key={id} id={id} name={name} Icon={Icon} active={page === id} onClick={() => navigate(id)} />)}</div>
      <div className="nav-group"><div className="nav-caption">Manage</div>{NAV.slice(2).map(([id, name, Icon]) => <NavButton key={id} id={id} name={name} Icon={Icon} active={page === id} onClick={() => navigate(id)} />)}</div>
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumbs"><span>CreatorDesk</span><span className="crumb-divider">/</span><strong>{NAV.find(([id]) => id === page)?.[1]}</strong></div></div><div className="topbar-actions"><GlobalSearch value={search} onChange={setSearch} onSelect={openRecord} /><div className={`connection ${health}`}><span className="connection-dot" />{health === 'checking' ? 'Connecting' : health === 'online' ? 'All systems normal' : 'API unavailable'}</div><Notifications refreshKey={refreshKey} onSelect={openRecord} /></div></header>
      <div className="page-wrap">
        {page === 'overview' && <Overview refreshKey={refreshKey} navigate={navigate} add={add} search={search} />}
        {page === 'radar' && <Radar refreshKey={refreshKey} search={search} />}
        {page === 'brands' && <Brands refreshKey={refreshKey} search={search} focusId={focusRecord?.page === page ? focusRecord.id : null} add={() => add('brand')} navigate={navigate} />}
        {page === 'collaborations' && <Collaborations refreshKey={refreshKey} search={search} focusId={focusRecord?.page === page ? focusRecord.id : null} add={() => add('collaboration')} />}
        {page === 'rights' && <Rights refreshKey={refreshKey} search={search} focusId={focusRecord?.page === page ? focusRecord.id : null} add={() => add('right')} edit={(r) => add('right', r)} refresh={refresh} notify={notify} />}
        {page === 'exclusivity' && <Exclusivity refreshKey={refreshKey} search={search} focusId={focusRecord?.page === page ? focusRecord.id : null} add={() => add('exclusivity')} refresh={refresh} notify={notify} />}
      </div>
      <footer className="page-footer"><span>CreatorDesk <i>·</i> Your creator business, in control</span><span><b className="footer-status" />Connected to production API <a href={`${API_BASE}/api/health`} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a></span></footer>
    </main>
    {dialog && <FormDialog key={`${dialog.kind}-${dialog.record?.id || 'new'}`} {...dialog} close={() => setDialog(null)} done={(message) => { setDialog(null); notify(message); refresh() }} />}
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
  </div>
}

function GlobalSearch({ value, onChange, onSelect }) {
  const rootRef = useRef(null), inputRef = useRef(null)
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [results, setResults] = useState([]), [activeIndex, setActiveIndex] = useState(-1)
  useEffect(() => {
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const shortcut = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); inputRef.current?.focus(); setOpen(true) } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', shortcut)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', shortcut) }
  }, [])
  useEffect(() => {
    const query = value.trim().toLowerCase()
    setActiveIndex(-1)
    if (!open || !query) { setResults([]); setError(''); setLoading(false); return }
    setResults([])
    let live = true
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('')
      try {
        const [brands, collaborations, rights, exclusivity] = await Promise.all([api.brands(), api.collaborations(), api.rights(), api.exclusivity()])
        if (!live) return
        const collabById = Object.fromEntries(collaborations.map((item) => [item.id, item]))
        const match = (...parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(query)
        const found = [
          ...brands.filter((item) => match(item.name, item.contact_name, item.email, item.industry)).map((item) => ({ type: 'Brand', page: 'brands', filter: item.name, title: item.name, detail: [item.industry, item.contact_name].filter(Boolean).join(' · '), id: item.id })),
          ...collaborations.filter((item) => match(item.brand_name, item.campaign_name, item.status)).map((item) => ({ type: 'Collaboration', page: 'collaborations', filter: item.campaign_name, title: item.campaign_name, detail: `${item.brand_name || 'Brand'} · ${money(item.deal_amount)}`, id: item.id })),
          ...rights.map((item) => ({ ...item, collaboration: collabById[item.collaboration_id] })).filter((item) => match(item.content_title, item.platform, item.usage_type, item.collaboration?.brand_name, item.collaboration?.campaign_name)).map((item) => ({ type: 'Usage right', page: 'rights', filter: item.content_title, title: item.content_title, detail: [item.collaboration?.brand_name, item.collaboration?.campaign_name, item.platform].filter(Boolean).join(' · '), id: item.id })),
          ...exclusivity.map((item) => ({ ...item, collaboration: collabById[item.collaboration_id] })).filter((item) => match(item.category, item.notes, item.collaboration?.brand_name, item.collaboration?.campaign_name)).map((item) => ({ type: 'Exclusivity', page: 'exclusivity', filter: item.category, title: item.category, detail: [item.collaboration?.brand_name, item.collaboration?.campaign_name, item.end_date ? `Ends ${date(item.end_date)}` : 'No end date'].filter(Boolean).join(' · '), id: item.id })),
        ].slice(0, 10)
        setResults(found)
      } catch (requestError) { if (live) setError(requestError.message) }
      finally { if (live) setLoading(false) }
    }, 180)
    return () => { live = false; window.clearTimeout(timer) }
  }, [value, open])
  const choose = (result) => { onSelect(result); setActiveIndex(-1); setOpen(false); inputRef.current?.blur() }
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((i) => Math.min(results.length - 1, i + 1)); return }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); return }
    if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]) }
  }
  return <div className="global-search-wrap" ref={rootRef}>
    <label className="global-search"><Search size={16} /><input ref={inputRef} role="combobox" aria-expanded={open} aria-controls="global-search-results" aria-autocomplete="list" value={value} onFocus={() => setOpen(true)} onChange={(e) => { setActiveIndex(-1); onChange(e.target.value); setOpen(true) }} onKeyDown={handleKeyDown} placeholder="Search workspace" />{value ? <button className="search-clear" type="button" onClick={() => { setActiveIndex(-1); onChange(''); setOpen(true); inputRef.current?.focus() }} aria-label="Clear search"><X size={14} /></button> : <kbd>⌘ K</kbd>}</label>
    {open && value.trim() && <div className="search-popover" id="global-search-results" role="listbox">
      <div className="popover-heading"><span>SEARCH RESULTS</span>{!loading && !error && <span>{results.length} found</span>}</div>
      {loading ? <div className="popover-state"><LoaderCircle size={16} className="spin" />Searching your workspace…</div> : error ? <div className="popover-state popover-error"><CircleAlert size={15} />{error}</div> : results.length ? <div className="search-results">{results.map((result, index) => <button key={`${result.type}-${result.id}`} className={`search-result ${activeIndex === index ? 'selected' : ''}`} role="option" aria-selected={activeIndex === index} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(result)}><span className={`result-icon ${result.type.toLowerCase().replaceAll(' ', '-')}`}>{result.type === 'Brand' ? <HeartHandshake size={16} /> : result.type === 'Collaboration' ? <BriefcaseBusiness size={16} /> : result.type === 'Usage right' ? <FileCheck2 size={16} /> : <ShieldCheck size={16} />}</span><span className="result-copy"><strong>{result.title}</strong><small>{result.detail || result.type}</small></span><span className="result-type">{result.type}</span></button>)}</div> : <div className="popover-empty"><Search size={17} /><strong>No matching records</strong><span>Try a brand, campaign, platform, or category.</span></div>}
      <div className="popover-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>
    </div>}
  </div>
}

function Notifications({ refreshKey, onSelect }) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false), [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  useEffect(() => {
    let live = true; setLoading(true); setError('')
    api.radar().then((value) => { if (live) setData(value) }).catch((e) => { if (live) setError(e.message) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [refreshKey])
  useEffect(() => {
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  const notifications = useMemo(() => {
    if (!data) return []
    const rights = data.rights || [], output = []
    for (const right of rights) {
      if (right.status === 'EXPIRED') output.push({ key: `right-expired-${right.id}`, id: right.id, page: 'rights', filter: right.content_title, urgency: 'expired', urgencyLabel: 'Expired', title: 'Usage right expired', subject: right.content_title, detail: [right.brand_name, right.campaign_name, right.platform].filter(Boolean).join(' · '), dateLabel: `Expired ${date(right.expiry_date)}` })
      else if (right.status === 'EXPIRING' && right.days_remaining >= 0 && right.days_remaining <= 7) output.push({ key: `right-week-${right.id}`, id: right.id, page: 'rights', filter: right.content_title, urgency: 'urgent', urgencyLabel: right.days_remaining === 0 ? 'Due today' : `${right.days_remaining} days`, title: 'Usage right expiring soon', subject: right.content_title, detail: [right.brand_name, right.campaign_name, right.platform].filter(Boolean).join(' · '), dateLabel: `Expires ${date(right.expiry_date)}` })
      else if (right.status === 'EXPIRING' && right.days_remaining > 7 && right.days_remaining <= 30) output.push({ key: `right-month-${right.id}`, id: right.id, page: 'rights', filter: right.content_title, urgency: 'soon', urgencyLabel: `${right.days_remaining} days`, title: 'Usage right expiring', subject: right.content_title, detail: [right.brand_name, right.campaign_name, right.platform].filter(Boolean).join(' · '), dateLabel: `Expires ${date(right.expiry_date)}` })
    }
    for (const agreement of data.exclusivity?.records || []) if (agreement.ending_within_30_days) output.push({ key: `exclusivity-${agreement.id}`, id: agreement.id, page: 'exclusivity', filter: agreement.category, urgency: 'soon', urgencyLabel: `${agreement.days_remaining} days`, title: 'Exclusivity ending soon', subject: agreement.category, detail: [agreement.brand_name, agreement.campaign_name].filter(Boolean).join(' · '), dateLabel: `Ends ${date(agreement.end_date)}` })
    return output.sort((a, b) => ({ expired: 0, urgent: 1, soon: 2 }[a.urgency] - { expired: 0, urgent: 1, soon: 2 }[b.urgency]))
  }, [data])
  return <div className="notification-wrap" ref={rootRef}><button className="icon-button notification" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Bell size={18} />{notifications.length > 0 && <span className="notification-count">{notifications.length > 9 ? '9+' : notifications.length}</span>}</button>
    {open && <section className="notification-popover"><div className="notification-head"><div><strong>Notifications</strong><span>{notifications.length ? `${notifications.length} current alert${notifications.length === 1 ? '' : 's'}` : 'Rights and exclusivity updates'}</span></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={16} /></button></div>
      {loading ? <div className="popover-state"><LoaderCircle size={16} className="spin" />Checking Rights Radar…</div> : error ? <div className="popover-state popover-error"><CircleAlert size={15} />{error}</div> : notifications.length ? <div className="notification-list">{notifications.map((item) => <button className="notification-item" key={item.key} onClick={() => { onSelect(item); setOpen(false) }}><span className={`notification-indicator ${item.urgency}`} /><span className="notification-copy"><span className="notification-title-row"><strong>{item.title}</strong><em className={item.urgency}>{item.urgencyLabel}</em></span><b>{item.subject}</b><small>{item.detail}</small><span className="notification-date">{item.dateLabel}</span></span><ArrowRight size={14} className="notification-arrow" /></button>)}</div> : <div className="notification-empty"><div className="notification-empty-icon"><ShieldCheck size={20} /></div><strong>You’re all caught up</strong><span>No rights or exclusivity dates need attention.</span></div>}
      <div className="notification-foot"><span>Live from Rights Radar</span><button onClick={() => { setOpen(false); onSelect({ page: 'radar', filter: '' }) }}>Open Rights Radar <ArrowRight size={13} /></button></div>
    </section>}
  </div>
}

function NavButton({ id, name, Icon, active, onClick }) { return <button className={`nav-link ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18} /><span>{name}</span>{id === 'radar' && <i className="nav-dot" />}</button> }
function Heading({ eyebrow = 'YOUR CREATOR BUSINESS', title, subtitle, action, actionLabel = 'Add new', refresh, loading }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{refresh && <button className="button button-secondary icon-only-refresh" onClick={refresh} disabled={loading} aria-label="Refresh"><RefreshCw size={16} className={loading ? 'spin' : ''} /></button>}{action && <button className="button button-primary" onClick={action}><Plus size={16} />{actionLabel}</button>}</div></div> }
function useLoad(loader, key) { const [state, setState] = useState({ data: null, loading: true, error: '' }); const reload = useCallback(() => { setState((s) => ({ ...s, loading: true, error: '' })); loader().then((data) => setState({ data, loading: false, error: '' })).catch((e) => setState({ data: null, loading: false, error: e.message })) }, [loader]); useEffect(() => { reload() }, [reload, key]); return { ...state, reload } }
function Loading({ children = 'Loading your workspace' }) { return <div className="state-panel"><LoaderCircle size={22} className="spin" />{children}</div> }
function ErrorState({ error, retry }) { return <div className="state-panel error-state"><CircleAlert size={21} /><div><strong>We couldn’t load this data</strong><span>{error}</span></div><button className="button button-secondary small" onClick={retry}>Try again</button></div> }
function Empty({ icon: Icon = FileCheck2, title, text, action, actionLabel = 'Add record' }) { return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><p>{text}</p>{action && <button className="button button-secondary small" onClick={action}><Plus size={14} />{actionLabel}</button>}</div> }
function Metric({ label: name, value, note, icon: Icon, tone = '' }) { return <article className="metric-card"><div className="metric-top"><span>{name}</span><div className={`metric-icon ${tone}`}><Icon size={17} /></div></div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article> }
function Badge({ status = 'ACTIVE' }) { return <span className={`status-badge ${status.toLowerCase()}`}><i />{label(status)}</span> }
function SectionTitle({ title, action, onClick }) { return <div className="section-title"><h2>{title}</h2>{action && <button onClick={onClick}>{action}<ArrowRight size={14} /></button>}</div> }
function Table({ children, minWidth = '760px' }) { return <div className="table-scroll"><table style={{ minWidth }}>{children}</table></div> }
function EmptyPage({ loading, error, retry, children }) { return loading ? <Loading /> : error ? <ErrorState error={error} retry={retry} /> : children }

function Overview({ refreshKey, navigate, add, search }) {
  const loader = useCallback(async () => { const [radar, collaborations] = await Promise.all([api.radar(), api.collaborations()]); return { radar, collaborations } }, [])
  const { data, loading, error, reload } = useLoad(loader, refreshKey)
  if (loading || error) return <><Heading title="Overview" subtitle="A clear view of your creator business." refresh={reload} /><EmptyPage loading={loading} error={error} retry={reload} /></>
  const { radar, collaborations } = data, s = radar.summary || {}
  const attention = (radar.rights || []).filter((r) => ['EXPIRING', 'EXPIRED'].includes(r.status)).slice(0, 5)
  const recent = collaborations.filter((r) => `${r.brand_name} ${r.campaign_name}`.toLowerCase().includes(search.toLowerCase())).slice(0, 4)
  return <><Heading title="Overview" subtitle="A clear view of your creator business." refresh={reload} />
    <div className="welcome-strip"><div className="welcome-symbol"><Sparkles size={19} /></div><div><strong>Your content is an asset. Keep it protected.</strong><span>Here’s what needs your attention across active brand partnerships.</span></div><button onClick={() => navigate('radar')}>View Rights Radar <ArrowRight size={15} /></button></div>
    <div className="metrics-grid overview-metrics"><Metric label="Total usage rights" value={s.total_rights ?? 0} note="Across all campaigns" icon={FileCheck2} /><Metric label="Active rights" value={s.active_rights ?? 0} note="Currently authorized" icon={ShieldCheck} tone="green" /><Metric label="Expiring in 30 days" value={s.expiring_in_30_days ?? 0} note="Renewal conversations" icon={Clock3} tone="amber" /><Metric label="Renewal revenue due" value={money(s.renewal_revenue)} note="Potential fee in next 30 days" icon={BadgeIndianRupee} tone="blue" /><Metric label="Active exclusivity" value={radar.exclusivity?.active_count ?? 0} note="Category agreements" icon={Users} tone="rose" /></div>
    <div className="content-grid"><section className="panel"><SectionTitle title="Needs your attention" action="See all rights" onClick={() => navigate('radar')} />{attention.length ? <div className="attention-list">{attention.map((r) => <button className="attention-row" key={r.id} onClick={() => navigate('radar')}><div className={`attention-icon ${r.status.toLowerCase()}`}><CalendarClock size={17} /></div><div className="attention-main"><strong>{r.content_title}</strong><span>{r.brand_name} <i>·</i> {r.platform}</span></div><div className="attention-date"><strong>{r.status === 'EXPIRED' ? 'Expired' : `${r.days_remaining} days`}</strong><span>{shortDate(r.expiry_date)}</span></div></button>)}</div> : <Empty title="Nothing needs attention" text="No expiring or expired rights in your workspace." />}</section>
      <section className="panel opportunities-panel"><SectionTitle title="Renewal outlook" /><div className="opportunity-amount">{money(s.renewal_revenue)}</div><div className="opportunity-caption">Potential renewal fees within 30 days</div><div className="opportunity-divider" />{[['Expiring in 7 days', s.expiring_in_7_days, 'amber-dot'], ['Expiring in 15 days', s.expiring_in_15_days, 'violet-dot'], ['Expiring in 30 days', s.expiring_in_30_days, 'blue-dot']].map(([name, value, tone]) => <div className="opportunity-stat" key={name}><span><i className={`legend-dot ${tone}`} />{name}</span><strong>{value ?? 0}</strong></div>)}<button className="text-link" onClick={() => navigate('radar')}>Explore opportunities <ArrowRight size={14} /></button></section>
      <section className="panel"><SectionTitle title="Recent collaborations" action="View all" onClick={() => navigate('collaborations')} />{recent.length ? recent.map((r) => <div className="recent-row" key={r.id}><div className="recent-brand">{(r.brand_name || '?')[0]}</div><div className="recent-main"><strong>{r.campaign_name}</strong><span>{r.brand_name} <i>·</i> {date(r.start_date)}</span></div><span className="deal-amount">{money(r.deal_amount)}</span></div>) : <Empty title={search ? 'No matching campaigns' : 'No collaborations yet'} text="Add a brand campaign to see it here." action={() => add('collaboration')} actionLabel="Add collaboration" />}</section>
      <section className="panel quick-panel"><SectionTitle title="Quick actions" /><p>Keep your brand business up to date.</p>{[['brand', HeartHandshake, 'Add a brand', 'Save a new partner'], ['collaboration', BriefcaseBusiness, 'New collaboration', 'Track a campaign deal'], ['right', FileCheck2, 'Log usage rights', 'Set an expiry reminder']].map(([kind, Icon, name, sub]) => <button className="quick-action" key={kind} onClick={() => add(kind)}><span className="quick-icon"><Icon size={17} /></span><span><strong>{name}</strong><small>{sub}</small></span><ArrowRight size={15} /></button>)}</section></div>
    <div className="overview-date">Business date <strong>{date(radar.business_date)}</strong> <span>· Calculated by your Rights Radar</span></div></>
}

function Radar({ refreshKey, search }) {
  const loader = useCallback(() => api.radar(), [])
  const { data, loading, error, reload } = useLoad(loader, refreshKey)
  const [status, setStatus] = useState(''), [brand, setBrand] = useState(''), [platform, setPlatform] = useState(''), [type, setType] = useState(''), [sort, setSort] = useState('asc')
  if (loading || error) return <><Heading eyebrow="YOUR CONTENT, PROTECTED" title="Rights Radar" subtitle="Know what’s active, what’s expiring, and what’s worth renewing." refresh={reload} /><EmptyPage loading={loading} error={error} retry={reload} /></>
  const s = data.summary || {}, rights = data.rights || []
  const uniq = (field) => [...new Set(rights.map((r) => r[field]).filter(Boolean))].sort()
  const filtered = rights.filter((r) => (!status || status === r.status) && (!brand || brand === r.brand_name) && (!platform || platform === r.platform) && (!type || type === r.usage_type) && (`${r.brand_name} ${r.campaign_name} ${r.content_title}`.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => sort === 'asc' ? String(a.expiry_date || '9999').localeCompare(String(b.expiry_date || '9999')) : String(b.expiry_date || '').localeCompare(String(a.expiry_date || '')))
  return <><Heading eyebrow="YOUR CONTENT, PROTECTED" title="Rights Radar" subtitle="Know what’s active, what’s expiring, and what’s worth renewing." refresh={reload} />
    <div className="radar-intro"><div className="radar-intro-icon"><Activity size={20} /></div><div><strong>Your content rights at a glance</strong><span>Live status based on your business date, {date(data.business_date)}.</span></div><div className="radar-revenue"><span>Renewal revenue in 30 days</span><strong>{money(s.renewal_revenue)}</strong></div></div>
    <div className="metrics-grid radar-metrics"><Metric label="Total rights" value={s.total_rights ?? 0} note="All recorded permissions" icon={FileCheck2} /><Metric label="Active" value={s.active_rights ?? 0} note="Includes expiring rights" icon={ShieldCheck} tone="green" /><Metric label="Expired" value={s.expired_rights ?? 0} note="Permission window ended" icon={CircleAlert} tone="rose" /><Metric label="Upcoming" value={s.upcoming_rights ?? 0} note="Starts in the future" icon={Clock3} tone="blue" /></div>
    <div className="expiry-steps"><div className="expiry-label"><span>Expiring within</span><strong>Upcoming windows</strong></div>{[['7 days', s.expiring_in_7_days, 'amber'], ['15 days', s.expiring_in_15_days, 'violet'], ['30 days', s.expiring_in_30_days, 'blue']].map(([name, value, tone]) => <div className="expiry-step" key={name}><i className={`expiry-bullet ${tone}`} /><span>{name}</span><strong>{value ?? 0}</strong></div>)}<div className="expiry-separator" /><div className="expiry-step exclusivity-step"><ShieldCheck size={16} /><span>Active exclusivity</span><strong>{data.exclusivity?.active_count ?? 0}</strong></div></div>
    <section className="panel radar-table-panel"><div className="table-heading"><div><h2>Usage rights</h2><span>{filtered.length} records <i>·</i> sorted by expiry</span></div><button className="sort-button" onClick={() => setSort(sort === 'asc' ? 'desc' : 'asc')}>⇅ Expiry date</button></div>
      <div className="filter-bar"><label className="table-search"><Search size={15} /><input placeholder="Search brand or campaign" value={search} readOnly /></label><Select label="Status" value={status} onChange={setStatus} options={['ACTIVE', 'EXPIRING', 'EXPIRED', 'UPCOMING']} /><Select label="Brand" value={brand} onChange={setBrand} options={uniq('brand_name')} /><Select label="Platform" value={platform} onChange={setPlatform} options={uniq('platform')} /><Select label="Type" value={type} onChange={setType} options={['ORGANIC', 'PAID_AD', 'LICENSING', 'WHITELISTING']} /></div>
      {filtered.length ? <Table minWidth="1050px"><thead><tr>{['Brand / campaign', 'Content', 'Usage', 'Platform', 'Start date', 'Expiry', 'Remaining', 'Renewal fee', 'Status'].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map((r) => <tr key={r.id} className={r.status === 'EXPIRED' ? 'row-expired' : r.status === 'EXPIRING' ? 'row-expiring' : ''}><td><strong>{r.brand_name}</strong><small>{r.campaign_name}</small></td><td className="content-cell">{r.content_title}</td><td><span className={`type-pill ${r.usage_type.toLowerCase()}`}>{label(r.usage_type)}</span></td><td>{r.platform}</td><td>{shortDate(r.start_date)}</td><td>{shortDate(r.expiry_date)}</td><td>{r.days_remaining == null ? '—' : r.days_remaining < 0 ? `${Math.abs(r.days_remaining)} days ago` : r.days_remaining === 0 ? 'Today' : `${r.days_remaining} days`}</td><td className="fee-cell">{money(r.renewal_fee)}</td><td><Badge status={r.status} /></td></tr>)}</tbody></Table> : <Empty icon={Filter} title="No rights match these filters" text="Try clearing a filter or changing your search." />}</section>
    <section className="panel exclusivity-radar"><SectionTitle title="Active exclusivity agreements" action="Manage exclusivity" onClick={() => window.dispatchEvent(new CustomEvent('creator-navigate', { detail: 'exclusivity' }))} />{data.exclusivity?.records?.length ? data.exclusivity.records.map((r) => <div className="exclusivity-card" key={r.id}><div className="exclusivity-card-icon"><ShieldCheck size={17} /></div><div className="exclusivity-main"><strong>{r.category}</strong><span>{r.brand_name} <i>·</i> {r.campaign_name}</span></div><div><span className="exclusivity-dates">{date(r.start_date)} – {date(r.end_date)}</span><small>{r.days_remaining == null ? 'No end date' : `${r.days_remaining} days remaining`}</small></div><Badge status="ACTIVE" /></div>) : <div className="inline-empty">No active exclusivity agreements.</div>}</section>
    <div className="radar-footnote"><ShieldCheck size={15} />Rights statuses and remaining days are calculated by the CreatorDesk backend.</div></>
}
function Select({ label: name, value, onChange, options }) { return <label className="filter-select"><span>{name}</span><select value={value} onChange={(e) => onChange(e.target.value)}><option value="">All</option>{options.map((o) => <option key={o} value={o}>{label(o)}</option>)}</select><ChevronDown size={14} /></label> }

function Brands({ refreshKey, search, focusId, add, navigate }) {
  const loader = useCallback(() => api.brands(), [])
  const { data, loading, error, reload } = useLoad(loader, refreshKey)
  const rows = (data || []).filter((r) => `${r.name} ${r.contact_name} ${r.email} ${r.industry}`.toLowerCase().includes(search.toLowerCase()))
  return <><Heading title="Brands" subtitle="The partners behind your creator business." action={add} actionLabel="Add brand" refresh={reload} loading={loading} /><EmptyPage loading={loading} error={error} retry={reload}>{<section className="panel directory-panel"><div className="directory-heading"><div><h2>Your brand partners</h2><span>{rows.length} brands</span></div><span className="directory-hint"><Search size={14} />Search above to filter</span></div>{rows.length ? <div className="brand-grid">{rows.map((r) => <article className={`brand-card ${String(r.id) === focusId ? 'highlight-record' : ''}`} key={r.id}><div className="brand-card-top"><div className="brand-tile">{r.name.slice(0, 1).toUpperCase()}</div><span className="subtle-label">BRAND PARTNER</span></div><h3>{r.name}</h3><span className="industry-label">{r.industry || 'Industry not set'}</span><div className="brand-card-divider" /><div className="brand-detail"><span>Contact</span><strong>{r.contact_name || '—'}</strong></div><div className="brand-detail"><span>Email</span><strong>{r.email || '—'}</strong></div><button className="brand-card-link" onClick={() => navigate('collaborations')}>View collaborations <ArrowRight size={14} /></button></article>)}</div> : <Empty icon={HeartHandshake} title={search ? 'No matching brands' : 'Your partner list starts here'} text={search ? 'Try a different search.' : 'Add the brands you work with to connect campaigns and content rights.'} action={add} actionLabel="Add a brand" />}</section>}</EmptyPage></>
}

function Collaborations({ refreshKey, search, focusId, add }) {
  const loader = useCallback(async () => { const [collaborations, brands] = await Promise.all([api.collaborations(), api.brands()]); return { collaborations, brands } }, [])
  const { data, loading, error, reload } = useLoad(loader, refreshKey)
  const rows = (data?.collaborations || []).filter((r) => `${r.brand_name} ${r.campaign_name} ${r.status}`.toLowerCase().includes(search.toLowerCase()))
  return <><Heading title="Collaborations" subtitle="Every campaign, deal, and delivery in one place." action={add} actionLabel="Add collaboration" refresh={reload} loading={loading} /><EmptyPage loading={loading} error={error} retry={reload}>{<section className="panel directory-panel"><div className="directory-heading"><div><h2>Campaigns</h2><span>{rows.length} collaborations</span></div><span className="directory-hint"><BriefcaseBusiness size={14} />Linked to your brand partners</span></div>{rows.length ? <Table minWidth="760px"><thead><tr>{['Campaign', 'Brand', 'Deal amount', 'Timeline', 'Status', 'Created'].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className={String(r.id) === focusId ? 'highlight-record' : ''}><td><strong>{r.campaign_name}</strong><small>Campaign #{r.id}</small></td><td>{r.brand_name}</td><td className="fee-cell">{money(r.deal_amount)}</td><td>{shortDate(r.start_date)} – {shortDate(r.end_date)}</td><td><Badge status={r.status} /></td><td>{date(r.created_at)}</td></tr>)}</tbody></Table> : <Empty icon={BriefcaseBusiness} title="No collaborations found" text="Add a campaign and associate it with one of your brands." action={add} actionLabel="Add collaboration" />}</section>}</EmptyPage></>
}

function Rights({ refreshKey, search, focusId, add, edit, refresh, notify }) {
  const loader = useCallback(async () => { const [rights, collaborations] = await Promise.all([api.rights(), api.collaborations()]); return { rights, collaborations } }, [])
  const { data, loading, error, reload } = useLoad(loader, refreshKey)
  const [busy, setBusy] = useState(null)
  const collabs = Object.fromEntries((data?.collaborations || []).map((c) => [c.id, c]))
  const rows = (data?.rights || []).map((r) => ({ ...r, collaboration: collabs[r.collaboration_id] })).filter((r) => `${r.content_title} ${r.platform} ${r.usage_type} ${r.collaboration?.brand_name} ${r.collaboration?.campaign_name}`.toLowerCase().includes(search.toLowerCase()))
  const remove = async (id) => { if (!window.confirm('Delete this usage right? This cannot be undone.')) return; setBusy(id); try { await api.deleteRight(id); notify('Usage right deleted'); refresh() } catch (e) { notify(e.message) } finally { setBusy(null) } }
  return <><Heading title="Usage rights" subtitle="Track permissions granted for every piece of content." action={add} actionLabel="Add usage right" refresh={reload} loading={loading} /><EmptyPage loading={loading} error={error} retry={reload}>{<section className="panel directory-panel"><div className="directory-heading"><div><h2>All usage rights</h2><span>{rows.length} recorded permissions</span></div><span className="directory-hint"><FileCheck2 size={14} />Live status in Rights Radar</span></div>{rows.length ? <Table minWidth="1020px"><thead><tr>{['Content', 'Brand / campaign', 'Usage type', 'Platform', 'Start', 'Expiry', 'Renewal fee', 'Notes', 'Actions'].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className={String(r.id) === focusId ? 'highlight-record' : ''}><td><strong>{r.content_title}</strong><small>Right #{r.id}</small></td><td><strong>{r.collaboration?.brand_name || 'Brand unavailable'}</strong><small>{r.collaboration?.campaign_name || `Campaign #${r.collaboration_id}`}</small></td><td><span className={`type-pill ${r.usage_type.toLowerCase()}`}>{label(r.usage_type)}</span></td><td>{r.platform}</td><td>{shortDate(r.start_date)}</td><td>{shortDate(r.expiry_date)}</td><td className="fee-cell">{money(r.renewal_fee)}</td><td className="notes-cell">{r.notes || '—'}</td><td><div className="row-actions"><button className="icon-button" onClick={() => edit(r)} aria-label="Edit usage right"><Pencil size={15} /></button><button className="icon-button danger-icon" disabled={busy === r.id} onClick={() => remove(r.id)} aria-label="Delete usage right"><Trash2 size={15} /></button></div></td></tr>)}</tbody></Table> : <Empty icon={FileCheck2} title="No usage rights found" text="Log the permissions attached to a brand collaboration." action={add} actionLabel="Add usage right" />}</section>}</EmptyPage></>
}

function Exclusivity({ refreshKey, search, focusId, add, refresh, notify }) {
  const loader = useCallback(async () => { const [exclusivity, collaborations] = await Promise.all([api.exclusivity(), api.collaborations()]); return { exclusivity, collaborations } }, [])
  const { data, loading, error, reload } = useLoad(loader, refreshKey)
  const [busy, setBusy] = useState(null)
  const collabs = Object.fromEntries((data?.collaborations || []).map((c) => [c.id, c]))
  const rows = (data?.exclusivity || []).map((r) => ({ ...r, collab: collabs[r.collaboration_id] })).filter((r) => `${r.category} ${r.collab?.brand_name} ${r.collab?.campaign_name}`.toLowerCase().includes(search.toLowerCase()))
  const remove = async (id) => { if (!window.confirm('Delete this exclusivity agreement?')) return; setBusy(id); try { await api.deleteExclusivity(id); notify('Exclusivity agreement deleted'); refresh() } catch (e) { notify(e.message) } finally { setBusy(null) } }
  return <><Heading title="Exclusivity" subtitle="Know where category commitments begin and end." action={add} actionLabel="Add agreement" refresh={reload} loading={loading} /><EmptyPage loading={loading} error={error} retry={reload}>{<section className="panel directory-panel"><div className="directory-heading"><div><h2>Category agreements</h2><span>{rows.length} agreements</span></div><span className="directory-hint"><ShieldCheck size={14} />Recorded commitments</span></div>{rows.length ? <Table minWidth="850px"><thead><tr>{['Category', 'Brand / campaign', 'Start date', 'End date', 'Status', 'Remaining', 'Notes', 'Actions'].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r) => { const remain = r.end_date ? daysUntil(r.end_date) : null; const active = Boolean(r.start_date) && daysUntil(r.start_date) <= 0 && (remain === null || remain >= 0); return <tr key={r.id} className={String(r.id) === focusId ? 'highlight-record' : ''}><td><span className="category-chip"><ShieldCheck size={14} />{r.category}</span></td><td><strong>{r.collab?.brand_name || 'Brand unavailable'}</strong><small>{r.collab?.campaign_name || `Campaign #${r.collaboration_id}`}</small></td><td>{shortDate(r.start_date)}</td><td>{shortDate(r.end_date)}</td><td><Badge status={active ? 'ACTIVE' : remain !== null && remain < 0 ? 'EXPIRED' : 'UPCOMING'} /></td><td>{remain === null ? '—' : remain < 0 ? `${Math.abs(remain)} days ago` : `${remain} days`}</td><td className="notes-cell">{r.notes || '—'}</td><td><button className="icon-button danger-icon" disabled={busy === r.id} onClick={() => remove(r.id)} aria-label="Delete agreement"><Trash2 size={15} /></button></td></tr>})}</tbody></Table> : <Empty icon={ShieldCheck} title="No agreements recorded" text="Add category exclusivity details linked to a collaboration." action={add} actionLabel="Add agreement" />}</section>}</EmptyPage></>
}

function FormDialog({ kind, record, close, done }) {
  const [brands, setBrands] = useState([]), [collaborations, setCollaborations] = useState([])
  const [loading, setLoading] = useState(kind !== 'brand'), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const [form, setForm] = useState(() => kind === 'brand'
    ? { name: '', contact_name: '', email: '', industry: '' }
    : kind === 'collaboration' ? { brand_id: '', campaign_name: '', deal_amount: '', start_date: '', end_date: '', status: 'ACTIVE' }
      : kind === 'right' ? { collaboration_id: record?.collaboration_id || '', content_title: record?.content_title || '', platform: record?.platform || '', usage_type: record?.usage_type || 'ORGANIC', start_date: record?.start_date?.slice(0, 10) || '', expiry_date: record?.expiry_date?.slice(0, 10) || '', renewal_fee: record?.renewal_fee ?? '', notes: record?.notes || '' }
        : { collaboration_id: '', category: '', start_date: '', end_date: '', notes: '' })
  useEffect(() => {
    if (kind === 'brand') return
    Promise.all([api.brands(), api.collaborations()]).then(([b, c]) => {
      setBrands(b); setCollaborations(c)
      if (kind === 'collaboration' && b.length) setForm((v) => ({ ...v, brand_id: String(v.brand_id || b[0].id) }))
      if (['right', 'exclusivity'].includes(kind) && c.length) setForm((v) => ({ ...v, collaboration_id: String(v.collaboration_id || c[0].id) }))
    }).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [kind])
  const update = (event) => setForm((v) => ({ ...v, [event.target.name]: event.target.value }))
  const save = async (event) => {
    event.preventDefault(); setError('')
    const required = kind === 'brand' ? ['name'] : kind === 'collaboration' ? ['brand_id', 'campaign_name'] : kind === 'right' ? ['collaboration_id', 'content_title', 'platform', 'usage_type'] : ['collaboration_id', 'category']
    const missing = required.find((field) => !String(form[field] ?? '').trim())
    if (missing) return setError(`${label(missing.replaceAll('_', ' '))} is required.`)
    const dateFields = kind === 'collaboration' ? ['start_date', 'end_date'] : kind === 'right' ? ['start_date', 'expiry_date'] : ['start_date', 'end_date']
    for (const field of dateFields) if (form[field] && !/^\d{4}-\d{2}-\d{2}$/.test(form[field])) return setError(`${label(field.replaceAll('_', ' '))} must be a valid date.`)
    for (const field of dateFields) if (form[field] && new Date(`${form[field]}T00:00:00Z`).toISOString().slice(0, 10) !== form[field]) return setError('Enter a valid calendar date.')
    if (dateFields[1] && form[dateFields[0]] && form[dateFields[1]] && form[dateFields[1]] < form[dateFields[0]]) return setError(`${label(dateFields[1].replaceAll('_', ' '))} must be on or after the start date.`)
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Enter a valid email address.')
    if (['deal_amount', 'renewal_fee'].some((field) => form[field] !== '' && Number(form[field]) < 0)) return setError('Amounts cannot be negative.')
    setSaving(true)
    try {
      if (kind === 'brand') { await api.createBrand(Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''))); return done('Brand added') }
      if (kind === 'collaboration') { await api.createCollaboration({ ...form, brand_id: Number(form.brand_id), deal_amount: form.deal_amount === '' ? null : Number(form.deal_amount), start_date: form.start_date || null, end_date: form.end_date || null }); return done('Collaboration added') }
      if (kind === 'right') { const body = { ...form, collaboration_id: Number(form.collaboration_id), start_date: form.start_date || null, expiry_date: form.expiry_date || null, renewal_fee: form.renewal_fee === '' ? null : Number(form.renewal_fee) }; if (record) await api.updateRight(record.id, body); else await api.createRight(body); return done(record ? 'Usage right updated' : 'Usage right added') }
      await api.createExclusivity({ ...form, collaboration_id: Number(form.collaboration_id), start_date: form.start_date || null, end_date: form.end_date || null }); done('Exclusivity agreement added')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  const title = kind === 'brand' ? 'Add a brand' : kind === 'collaboration' ? 'New collaboration' : kind === 'right' ? record ? 'Edit usage right' : 'Add usage right' : 'Add exclusivity agreement'
  const opts = kind === 'collaboration' ? brands : collaborations
  const fields = kind === 'brand' ? [['name', 'Brand name', 'text', true], ['contact_name', 'Contact name', 'text'], ['email', 'Email address', 'email'], ['industry', 'Industry', 'text']]
    : kind === 'collaboration' ? [['brand_id', 'Brand', 'select', true], ['campaign_name', 'Campaign name', 'text', true], ['deal_amount', 'Deal amount (₹)', 'number'], ['start_date', 'Start date', 'date'], ['end_date', 'End date', 'date'], ['status', 'Status', 'status']]
      : kind === 'right' ? [['collaboration_id', 'Collaboration', 'select', true], ['content_title', 'Content title', 'text', true], ['platform', 'Platform', 'text', true], ['usage_type', 'Usage type', 'usage', true], ['start_date', 'Permission starts', 'date'], ['expiry_date', 'Permission expires', 'date'], ['renewal_fee', 'Renewal fee (₹)', 'number'], ['notes', 'Notes', 'textarea']]
        : [['collaboration_id', 'Collaboration', 'select', true], ['category', 'Category', 'text', true], ['start_date', 'Starts on', 'date'], ['end_date', 'Ends on', 'date'], ['notes', 'Notes', 'textarea']]
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><section className="form-modal"><div className="modal-header"><div><div className="eyebrow">WORKSPACE RECORD</div><h2>{title}</h2><p>Details are saved to your CreatorDesk workspace.</p></div><button className="icon-button" onClick={close} aria-label="Close"><X size={18} /></button></div>{loading ? <Loading>Preparing the form…</Loading> : <form className="record-form" onSubmit={save}><div className="form-grid">{fields.map(([name, text, type, required]) => <label key={name} className={`form-field ${type === 'textarea' ? 'field-wide' : ''}`}><span>{text}{required && <b> *</b>}</span>{type === 'select' ? <select name={name} value={form[name]} onChange={update} required={required}><option value="">Choose {text.toLowerCase()}</option>{opts.map((o) => <option key={o.id} value={o.id}>{kind === 'collaboration' ? o.name : `${o.brand_name || 'Brand'} · ${o.campaign_name}`}</option>)}</select> : type === 'usage' ? <select name={name} value={form[name]} onChange={update}><option value="ORGANIC">Organic</option><option value="PAID_AD">Paid ad</option><option value="LICENSING">Licensing</option><option value="WHITELISTING">Whitelisting</option></select> : type === 'status' ? <select name={name} value={form[name]} onChange={update}><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="PAUSED">Paused</option></select> : type === 'textarea' ? <textarea name={name} value={form[name]} onChange={update} rows="3" /> : <input name={name} value={form[name]} onChange={update} type={type} required={required} min={type === 'number' ? '0' : undefined} step={['deal_amount', 'renewal_fee'].includes(name) ? '0.01' : undefined} />}</label>)}</div>{error && <div className="form-error"><CircleAlert size={15} />{error}</div>}{kind !== 'brand' && !opts.length && !loading && <div className="form-hint">Add a brand and collaboration before creating this record.</div>}<div className="modal-actions"><button className="button button-secondary" type="button" onClick={close}>Cancel</button><button className="button button-primary" disabled={saving || (kind !== 'brand' && !opts.length)} type="submit">{saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{saving ? 'Saving…' : record ? 'Save changes' : 'Save record'}</button></div></form>}</section></div>
}
