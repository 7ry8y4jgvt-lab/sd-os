import { useState, useEffect, useCallback, useRef } from 'react';

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  // S&D brand tokens
  bg: '#FFFFFF', bgS: '#F7F6F3', bgD: '#FDF1F2', bgSu: '#F0FDF4',
  bgW: '#FFFBEB', bgI: '#F5F3FF',
  tx: '#0D0D0B', txS: '#5a5a56', txT: '#9ca3af',
  txD: '#C41E2D', txSu: '#16a34a', txW: '#b45309', txI: '#5C1A9A',
  bd: '#E8E6E1', bdS: '#D4D1CB',
  // Brand palette
  red: '#C41E2D', midnight: '#0D0D0B', violet: '#5C1A9A',
  spark: '#C8EC3C', flash: '#F572A8',
  accent: '#C41E2D', blue: '#5C1A9A', orange: '#F572A8', green: '#16a34a',
  // Fonts
  mono: "'Space Mono', monospace",
  serif: "'Playfair Display', serif",
  sans: "'Cabinet Grotesk', sans-serif",
  body: "'DM Sans', sans-serif",
};

// ─── API UTILS ────────────────────────────────────────────────────────────────
async function callAI(prompt, useSearch = false, maxTokens = 2000) {
  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (useSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  const res = await fetch('/api/claude', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'API error'); }
  const data = await res.json();
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function xj(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in response');
  return JSON.parse(m[0]);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const STATUS_MAP = [
  ['done', { bg: T.bgSu, color: T.txSu }],
  ['ready to post', { bg: T.bgSu, color: T.txSu }],
  ['working on it', { bg: T.bgW, color: T.txW }],
  ['stuck', { bg: T.bgD, color: T.txD }],
  ['intention', { bg: T.bgI, color: T.txI }],
];
function ss(s) {
  const l = (s || '').toLowerCase();
  for (const [k, v] of STATUS_MAP) if (l.includes(k)) return v;
  return { bg: T.bgS, color: T.txS };
}

function Pill({ s }) {
  const { bg, color } = ss(s);
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap', flexShrink: 0, backgroundColor: bg, color }}>{s || '—'}</span>;
}

function Skel({ n = 5 }) {
  return <div>{Array.from({ length: n }, (_, i) => (
    <div key={i} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: i < n - 1 ? `0.5px solid ${T.bd}` : 'none' }}>
      <div style={{ height: '13px', borderRadius: '3px', background: T.bgS, width: (60 + (i * 7) % 30) + '%' }} />
      <div style={{ height: '20px', borderRadius: '4px', background: T.bgS, width: '70px', flexShrink: 0 }} />
    </div>
  ))}</div>;
}

function Fld({ label, value, onChange, placeholder, multiline }) {
  const s = { width: '100%', fontSize: '13px', padding: '7px 10px', border: `0.5px solid ${T.bdS}`, borderRadius: '6px', background: T.bg, color: T.tx, fontFamily: T.sans, boxSizing: 'border-box', resize: 'vertical' };
  return (
    <div style={{ marginBottom: '10px' }}>
      {label && <label style={{ fontSize: '11px', color: T.txT, display: 'block', marginBottom: '3px', fontFamily: T.mono, letterSpacing: '0.05em' }}>{label}</label>}
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} style={s} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />}
    </div>
  );
}

function Card({ children, accent, label, status = 'live' }) {
  return (
    <div style={{ background: T.bg, border: `0.5px solid ${T.bd}`, borderRadius: '8px', overflow: 'hidden' }}>
      {label && (
        <div style={{ padding: '12px 16px', borderBottom: `2px solid ${accent || T.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: '500', color: T.tx }}>{label}</span>
          <span style={{ fontSize: '10px', color: accent || T.txT, fontFamily: T.mono, letterSpacing: '0.08em' }}>{status}</span>
        </div>
      )}
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

function Btn({ onClick, disabled, children, full, style: extra }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...(full ? { width: '100%' } : {}), padding: '10px 16px', fontSize: '13px', fontWeight: '500', cursor: disabled ? 'not-allowed' : 'pointer', ...extra }}>
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, warn }) {
  return (
    <div style={{ background: warn && value > 0 ? T.bgW : T.bgS, borderRadius: '6px', padding: '10px 12px' }}>
      <div style={{ fontSize: '10px', color: warn && value > 0 ? T.txW : T.txT, marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '500', color: warn && value > 0 ? T.txW : T.tx, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', color: warn && value > 0 ? T.txW : T.txT, marginTop: '3px' }}>{sub}</div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const _CB = {5:5094931964,6:5094932056,7:5094932075,8:5094932087,9:5094932139,10:5094932144,11:5094932152,12:5094932287};
const _NOW = new Date();
const _MOFFSETS = [0,1,2].map(o => { const m = _NOW.getMonth()+1+o; return m>12 ? m-12 : m; });
const MONDAY_QUERY = `{
  draughts: boards(ids: [5092879734]) {
    items_page(limit: 20) {
      items {
        name
        column_values(ids: ["project_status", "project_owner"]) { id text }
      }
    }
  }
  ${_MOFFSETS.map(m => _CB[m] ? `m${m}: boards(ids: [${_CB[m]}]) { items_page(limit: 100) { items { name column_values(ids: ["color_mm2pf5wp", "date_mm2kg11k"]) { id text } } } }` : "").filter(Boolean).join("\n  ")}
  content: boards(ids: [5093423870]) {
    items_page(limit: 20) {
      items {
        name
        column_values(ids: ["color_mm1kb3ww", "date_mm1k6pbw"]) { id text }
      }
    }
  }
  websitebuild: boards(ids: [5096740248]) {
    items_page(limit: 50) {
      items {
        name
        column_values(ids: ["color_mm3gsn5d", "date_mm3gzw4j"]) { id text }
      }
    }
  }
}`;

function parseBoard(board, statusId, secondId, secondKey) {
  return (board?.[0]?.items_page?.items || []).map(item => ({
    name: item.name,
    status: item.column_values.find(c => c.id === statusId)?.text || '',
    [secondKey]: item.column_values.find(c => c.id === secondId)?.text || '',
  }));
}

function IRow({ item, showDate, showOwner, last }) {
  const d = item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: last ? 'none' : `0.5px solid ${T.bd}` }}>
      <span style={{ fontSize: '13px', color: T.tx, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {showOwner && item.owner && <span style={{ fontSize: '11px', color: T.txT }}>{item.owner.split(' ')[0]}</span>}
        <Pill s={item.status} />
        {showDate && d && <span style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono }}>{d}</span>}
      </div>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientTab, setClientTab] = useState('all');
  const [openMonths, setOpenMonths] = useState([true, true, true]);
  const [openDraughtsLive, setOpenDraughtsLive] = useState(true);
  const [openDraughtsDone, setOpenDraughtsDone] = useState(false);
  const [openContent, setOpenContent] = useState(true);
  const [openWebsite, setOpenWebsite] = useState(true);const [brief, setBrief] = useState('');
  const [briefing, setBriefing] = useState(false);
  const [synced, setSynced] = useState(null);

  const sync = useCallback(async () => {
    setLoading(true); setError(null); setBrief('');
    try {
      const res = await fetch('/api/monday', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: MONDAY_QUERY }),
      });
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0].message);
      setData(json.data);
      setSynced(new Date());
    } catch (e) { setError(e.message || JSON.stringify(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { sync(); }, [sync]);

    const _diAll = parseBoard(data?.draughts, 'project_status', 'project_owner', 'owner');
    const di = _diAll.filter(i => (i.status || '').toLowerCase().includes('done') === false);
    const diDone = _diAll.filter(i => (i.status || '').toLowerCase().includes('done'));
const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const _mnFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const [openEmails, setOpenEmails] = useState(false);
  const [aEmails, setAEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailsFetched, setEmailsFetched] = useState(false);
  const _months = _MOFFSETS.map(m => ({ label: _mnFull[m-1], items: _CB[m] ? parseBoard(data?.[`m${m}`], 'color_mm2pf5wp', 'date_mm2kg11k', 'date') : [] }));
    const _allCi = _months.flatMap(mm => mm.items);
const co = parseBoard(data?.content, 'color_mm1kb3ww', 'date_mm1k6pbw', 'date').filter(i => !i.date || new Date(i.date) >= startOfMonth);
    const wb = parseBoard(data?.websitebuild, 'color_mm3gsn5d', 'date_mm3gzw4j', 'date').slice(0, 6);
  const getbrief = useCallback(async () => {
    setBriefing(true); setBrief('');
    try {
      const t = await callAI(`S&D ops director. 2-3 sentence briefing, direct, no filler.\nDraughts: ${JSON.stringify(di.slice(0, 5).map(i => ({ n: i.name, s: i.status })))}\nCampaigns: ${JSON.stringify(_allCi.slice(0, 5).map(i => ({ n: i.name, s: i.status })))}\n2-3 sentences:`);
      setBrief(t.trim());
    } catch (e) { setBrief(e.message); }
    finally { setBriefing(false); }
  }, [di, _allCi]);
  const fetchEmails = useCallback(async () => {
    if (emailsFetched) return;
    setEmailsLoading(true);
    try {
      const r = await fetch('/api/allstars-emails');
      const d = await r.json();
      setAEmails(d.emails || []);
      setEmailsFetched(true);
    } catch (e) { setAEmails([]); }
    finally { setEmailsLoading(false); }
  }, [emailsFetched]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono }}>
          {synced ? `Synced ${synced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : loading ? 'Connecting…' : ''}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn onClick={sync} disabled={loading}>{loading ? 'Syncing…' : '↻ Sync'}</Btn>
          {data && !loading && <Btn onClick={getbrief} disabled={briefing}>{briefing ? '…' : 'AI brief ↗'}</Btn>}
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', marginBottom: '12px', fontSize: '13px', background: T.bgD, color: T.txD, borderRadius: '6px' }}>monday.com error: {error}</div>}

      {(brief || briefing) && (
        <div style={{ padding: '13px 16px', marginBottom: '14px', background: T.bgS, borderLeft: `2px solid ${T.blue}`, borderRadius: '0 6px 6px 0', fontSize: '14px', lineHeight: '1.7', color: T.tx }}>
          {briefing ? <em style={{ color: T.txT }}>Generating…</em> : brief}
        </div>
      )}

      {!loading && data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          <StatCard label="Draughts projects" value={_diAll.length} sub={`${diDone.length} done`} />
          <StatCard label="May campaigns" value={_allCi.length} sub={`${_allCi.filter(i => i.status?.toLowerCase().includes('ready')).length} ready`} />
          <StatCard label="Content pieces" value={co.length} sub={`${co.filter(i => i.status?.toLowerCase().includes('done')).length} done`} />
        </div>
      )}
      <div style={{ display: 'flex', gap: '0', marginBottom: '10px', borderBottom: `0.5px solid ${T.bd}` }}>
        {['all', 'draughts', 'allstars'].map(t => (
          <button key={t} onClick={() => setClientTab(t)} style={{ fontSize: '12px', padding: '5px 14px', fontWeight: clientTab === t ? '500' : '400', borderBottom: clientTab === t ? `2px solid ${T.red}` : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, background: 'none', color: clientTab === t ? T.tx : T.txT, cursor: 'pointer' }}>{t === 'all' ? 'All clients' : t === 'draughts' ? 'Draughts' : 'Allstars'}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: clientTab === 'all' ? '1fr 1fr' : '1fr', gap: '10px' }}>
        {(clientTab === 'all' || clientTab === 'draughts') && <Card label="Draughts London" accent={T.blue} status={loading ? 'syncing…' : 'live'}>
          {loading ? <Skel /> : <div><div onClick={() => setOpenDraughtsLive(o => !o)} style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', cursor: 'pointer', userSelect: 'none' }}>{openDraughtsLive ? '▾' : '▸'} Live ({di.length})</div>{openDraughtsLive && di.map((item, i) => <IRow key={i} item={item} showOwner last={i === di.length - 1} />)}{diDone.length > 0 && <div><div onClick={() => setOpenDraughtsDone(o => !o)} style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 10px', paddingTop: '16px', borderTop: '0.5px solid #333', cursor: 'pointer', userSelect: 'none' }}>{openDraughtsDone ? '▾' : '▸'} Done ({diDone.length})</div>{openDraughtsDone && diDone.map((item, i) => <IRow key={i} item={item} showOwner last={i === diDone.length - 1} />)}</div>}</div>}
        </Card>}
        {(clientTab === 'all' || clientTab === 'allstars') && <Card label="Allstars Group" accent={T.orange} status={loading ? 'syncing…' : 'live'}>
          {loading ? <Skel /> : (
            <>
              {/* Campaigns */}
              {_months.map((m, mi) => <div key={mi}><div onClick={() => setOpenMonths(prev => prev.map((v,ix) => ix===mi ? !v : v))} style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', cursor: 'pointer', userSelect: 'none', ...(mi > 0 ? { marginTop: '16px', paddingTop: '16px', borderTop: `0.5px solid ${T.bd}` } : {}) }}>{openMonths[mi] ? '▾' : '▸'} {m.label} Campaigns</div>{openMonths[mi] && m.items.map((item, i) => <IRow key={i} item={item} showDate last={i === m.items.length - 1} />)}</div>)}
              {co.length > 0 && <>
                <div onClick={() => setOpenContent(o => !o)} style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 10px', paddingTop: '16px', borderTop: `0.5px solid ${T.bd}`, cursor: 'pointer', userSelect: 'none' }}>{openContent ? '▾' : '▸'} Content Calendar</div>
                {openContent && co.map((item, i) => <IRow key={i} item={item} showDate last={i === co.length - 1} />)}
              </>}
              <div onClick={() => setOpenWebsite(o => !o)} style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 10px', paddingTop: '16px', borderTop: `0.5px solid ${T.bd}`, cursor: 'pointer', userSelect: 'none' }}>{openWebsite ? '▾' : '▸'} Website Build</div>
              {openWebsite && wb.map((item, i) => <IRow key={i} item={item} showDate last={i === wb.length - 1} />)}
            <div onClick={() => { setOpenEmails(o => !o); if (!openEmails && !emailsFetched) fetchEmails(); }} style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 10px', paddingTop: '16px', borderTop: `0.5px solid ${T.bd}`, cursor: 'pointer', userSelect: 'none' }}>{openEmails ? '▼' : '►'} Emails</div>
            {openEmails && (emailsLoading
              ? <div style={{ fontSize: '12px', color: T.txT, padding: '8px 0' }}>Loading…</div>
              : aEmails.length === 0
                ? <div style={{ fontSize: '12px', color: T.txT, padding: '8px 0' }}>No Allstars emails found for May / June.</div>
                : aEmails.map((em, i) => (
                    <div key={i} style={{ padding: '10px 0', borderBottom: i < aEmails.length - 1 ? `0.5px solid ${T.bd}` : 'none' }}>
                      <div style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{em.from}</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: T.tx, marginBottom: '3px' }}>{em.subject}</div>
                      <div style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono, marginBottom: '4px' }}>{new Date(em.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
                      <div style={{ fontSize: '12px', color: T.txT, lineHeight: '1.5' }}>{em.snippet}</div>
                    </div>
                  ))
            )}
            </>
          )}
        </Card>}
      </div>
      <div style={{ marginTop: '10px', padding: '12px 14px', background: T.bgS, borderRadius: '6px', fontSize: '12px', color: T.txS }}>
        📧 <strong>Gmail panel</strong> — coming in the next update. Requires OAuth setup. For now, check Gmail directly.
      </div>
    </div>
  );
}

// ─── OUTBOUND ─────────────────────────────────────────────────────────────────
const VTYPES = ['Competitive socialising venues', 'Golf clubs considering mini golf', 'Adventure / crazy golf operators', 'Multi-activity entertainment venues', 'Holiday parks / resorts'];
const REGS = ['UK — All regions', 'London', 'South East', 'Midlands', 'North West', 'North East', 'Yorkshire', 'South West', 'Scotland', 'Wales', 'Ireland', 'USA', 'Europe'];

function ProspCard({ p, onSelect, selected }) {
  const [exp, setExp] = useState(false);
  const [email, setEmail] = useState(p.email || '');
  const [hunting, setHunting] = useState(false);

  const findEmail = async () => {
    if (!p.url) return;
    setHunting(true);
    try {
      const domain = p.url.replace(/https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '');
      const r = await fetch('/api/hunter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain }) });
      const data = await r.json();
      const emails = data?.data?.emails || [];
      const match = emails.find(e => e.first_name && p.contactName && p.contactName.toLowerCase().includes(e.first_name.toLowerCase())) || emails[0];
      if (match) setEmail(match.value);
      else setEmail('Not found');
    } catch(e) { setEmail('Error'); }
    finally { setHunting(false); }
  };

  return (
    <div style={{ background: selected ? T.bgI : T.bg, border: selected ? `1.5px solid ${T.txI}` : `0.5px solid ${T.bd}`, borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: T.tx }}>{p.company}</div>
          <div style={{ fontSize: '11px', color: T.txS }}>{p.contactName ? (p.contactName + (p.contactTitle ? ' · ' + p.contactTitle : '')) : 'Contact TBC'}</div>
          <div style={{ fontSize: '11px', color: T.txI, marginTop: '2px' }}>{email}</div>
          {p.location && <div style={{ fontSize: '11px', color: T.txT }}>{p.location}</div>}
        </div>
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          <Btn onClick={findEmail} disabled={hunting}>{hunting ? '...' : 'Email'}</Btn>
          <Btn onClick={() => window.open('https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent((p.contactName || '') + ' ' + p.company), '_blank')}>LinkedIn</Btn>
          <Btn onClick={() => window.open('https://www.google.com/search?q=' + encodeURIComponent('"' + (p.contactName || '') + '" "' + p.company + '" LinkedIn'), '_blank')}>Google</Btn>
          <Btn onClick={() => setExp(e => !e)}>{exp ? 'Less' : 'More'}</Btn>
          <Btn onClick={() => onSelect(p)} style={selected ? { background: T.bgSu, color: T.txSu } : {}}>{selected ? '✓' : 'Use →'}</Btn>
        </div>
      </div>
      {p.signal && <div style={{ marginTop: '8px', padding: '4px 10px', borderRadius: '6px', background: T.bgI, fontSize: '11px', color: T.txI }}>⚡ {p.signal}</div>}
      {exp && p.description && <div style={{ marginTop: '8px', fontSize: '12px', color: T.txS, lineHeight: '1.6', paddingTop: '8px', borderTop: `0.5px solid ${T.bd}` }}>{p.description}</div>}
    </div>
  );
}

function ECard({ email, index, onDraft, drafting, drafted }) {
  const [cp, setCp] = useState(false);
  const openGmail = () => {
    const params = new URLSearchParams();
    if (email.to) params.set('to', email.to);
    params.set('su', email.subject);
    params.set('body', email.body);
    window.open('https://mail.google.com/mail/?view=cm&' + params.toString(), '_blank');
  };
  return (
    <div style={{ background: T.bg, border: `0.5px solid ${T.bd}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
      <div style={{ padding: '10px 16px', borderBottom: `0.5px solid ${T.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgS }}>
        <span style={{ fontSize: '12px', fontWeight: '500', color: T.tx }}>Email {index + 1}</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Btn onClick={() => { navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`); setCp(true); setTimeout(() => setCp(false), 2000); }}>{cp ? 'Copied ✓' : 'Copy'}</Btn>
          <Btn onClick={openGmail}>Gmail ↗</Btn>
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono, marginBottom: '3px' }}>SUBJECT</div>
        <div style={{ fontSize: '14px', fontWeight: '500', color: T.tx, marginBottom: '12px' }}>{email.subject}</div>
        <div style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono, marginBottom: '3px' }}>BODY</div>
        <div style={{ fontSize: '13px', color: T.tx, lineHeight: '1.75', whiteSpace: 'pre-wrap' }}>{email.body}</div>
      </div>
    </div>
  );
}

function Outbound() {
  const [vtab, setVtab] = useState('find');
  const [vtype, setVtype] = useState(VTYPES[0]);
  const [region, setRegion] = useState(REGS[0]);
  const [extra, setExtra] = useState('');
  const [cnt, setCnt] = useState('8');
  const [prospects, setProspects] = useState([]);
  const [finding, setFinding] = useState(false);
  const [ferr, setFerr] = useState(null);
  const [sel, setSel] = useState(null);
  const [emails, setEmails] = useState([]);
  const [gen, setGen] = useState(false);
  const [gerr, setGerr] = useState(null);

  const find = useCallback(async () => {
    setFinding(true); setFerr(null); setProspects([]);
    try {
      const t = await callAI(`B2B researcher for Smith & Devil (bespoke mini golf design+build, concept to installation). Find ${cnt} real UK companies: type: ${vtype}, region: ${region}${extra ? ', criteria: ' + extra : ''}. For each: company name, location, contactName, contactTitle (owner/MD/GM), url, a specific recent trigger signal, 1-2 sentence description. Return ONLY JSON: {"prospects":[{"company":"","location":"","contactName":"","contactTitle":"","url":"","signal":"","description":""}]}`, false, 1500);
      setProspects(xj(t).prospects || []);
    } catch (e) { setFerr(e.message || JSON.stringify(e)); }
    finally { setFinding(false); }
  }, [vtype, region, extra, cnt]);

  const generate = useCallback(async (p) => {
    setSel(p); setGen(true); setGerr(null); setEmails([]); setVtab('seq');
    try {
      const t = await callAI(`Write 4-email cold outbound sequence from Alex at Smith & Devil (London branding agency, bespoke mini golf design+build, concept to installation). Case study: The Park RVA Wonderball — 50,000 sqft multi-activity venue in Richmond Virginia, two 9-hole courses designed and built by S&D, full service from concept to installation.\n\nProspect: ${p.company}, ${p.location}, ${p.contactName || 'decision maker'}${p.contactTitle ? ' (' + p.contactTitle + ')' : ''}, ${p.url || ''}, signal: ${p.signal || 'none'}, ${p.description || ''}.\n\nSearch for ${p.company} for any additional detail that strengthens personalisation.\n\nEmail 1: Case study + low friction CTA. Email 2: Signal-driven, reference their specific trigger. Email 3: Pain point (generic/no attractions). Email 4: 3-line follow-up.\n\nTone: warm, direct, never salesy. Subject lines reference something real. Sign: Alex\\nSmith & Devil\\nhello@smithanddevil.com\n\nReturn ONLY JSON: {"emails":[{"subject":"","body":""}]}`, true, 2500);
      setEmails(xj(t).emails || []);
    } catch (e) { setGerr(e.message); }
    finally { setGen(false); }
  }, []);

  const selStyle = { fontSize: '12px', padding: '7px 9px', border: `0.5px solid ${T.bdS}`, borderRadius: '6px', background: T.bg, color: T.tx, fontFamily: T.sans, width: '100%' };
  const Tb = ({ id, label }) => (
    <button onClick={() => setVtab(id)} style={{ fontSize: '12px', padding: '5px 14px', fontWeight: vtab === id ? '500' : '400', borderBottom: vtab === id ? `2px solid ${T.red}` : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, background: 'none', color: vtab === id ? T.tx : T.txT, cursor: 'pointer' }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: `0.5px solid ${T.bd}`, marginBottom: '16px' }}>
        <Tb id="find" label="Find prospects" />
        <Tb id="seq" label={`Sequence${sel ? ' — ' + sel.company : ''}`} />
      </div>

      {vtab === 'find' && (
        <div>
          <div style={{ background: T.bgS, border: `0.5px solid ${T.bd}`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', color: T.txT, display: 'block', marginBottom: '3px', fontFamily: T.mono }}>Venue type</label>
                <select value={vtype} onChange={e => setVtype(e.target.value)} style={selStyle}>{VTYPES.map(o => <option key={o}>{o}</option>)}</select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', color: T.txT, display: 'block', marginBottom: '3px', fontFamily: T.mono }}>Region</label>
                <select value={region} onChange={e => setRegion(e.target.value)} style={selStyle}>{REGS.map(o => <option key={o}>{o}</option>)}</select>
              </div>
            </div>
            <Fld label="Additional criteria" value={extra} onChange={setExtra} placeholder="e.g. premium venues, recently opened, over 5000 sqft..." />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '11px', color: T.txT, display: 'block', marginBottom: '3px', fontFamily: T.mono }}>Count</label>
                <select value={cnt} onChange={e => setCnt(e.target.value)} style={{ ...selStyle, width: 'auto' }}>{['5', '8', '10', '15'].map(o => <option key={o}>{o}</option>)}</select>
              </div>
              <Btn onClick={find} disabled={finding} full>{finding ? 'Searching the web…' : `Find ${cnt} prospects ↗`}</Btn>
            </div>
          </div>
          {ferr && <div style={{ padding: '10px', marginBottom: '10px', fontSize: '13px', background: T.bgD, color: T.txD, borderRadius: '6px' }}>{ferr}</div>}
          {prospects.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono, marginBottom: '10px' }}>{prospects.length} prospects found — click Use → to write their sequence</div>
              {prospects.map((p, i) => <ProspCard key={i} p={p} selected={sel?.company === p.company} onSelect={generate} />)}
            </div>
          )}
        </div>
      )}

      {vtab === 'seq' && (
        <div>
          {gen && <div style={{ padding: '20px', textAlign: 'center', color: T.txT, fontSize: '13px' }}>Researching {sel?.company || 'prospect'} and writing sequence…</div>}
          {gerr && <div style={{ padding: '10px', marginBottom: '10px', fontSize: '13px', background: T.bgD, color: T.txD, borderRadius: '6px' }}>{gerr}</div>}
          {!gen && emails.length === 0 && !gerr && <div style={{ padding: '40px', textAlign: 'center', color: T.txT, fontSize: '13px' }}>Select a prospect from the Find tab</div>}
          {emails.map((email, i) => <ECard key={i} email={email} index={i} />)}
        </div>
      )}
    </div>
  );
}

// ─── SOCIAL ───────────────────────────────────────────────────────────────────
const DEFAULT_BRAND = { name: 'Smith & Devil', handle: '@smithanddevil', tagline: 'Great stories well-told.', primary: '#0D0D0D', accent: '#C8392B', text: '#F5F0E8', headlineFont: 'Cormorant Garamond', bodyFont: 'Jost', logoText: 'S&D' };
const PLATS = ['Instagram', 'LinkedIn'];
const FMTS = ['Carousel', 'Single post', 'Animated'];
const PDIMS = { Instagram: { w: 1080, h: 1080, label: '1:1' }, LinkedIn: { w: 1200, h: 628, label: '1.91:1' } };

function SlideView({ slide, brand, platform, index, total, animating, animated }) {
  const d = PDIMS[platform]; const sc = 0.42; const w = d.w * sc; const h = d.h * sc;
  return (
    <div style={{ width: w, height: h, flexShrink: 0, background: slide.imageUrl ? `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.65)),url(${slide.imageUrl}) center/cover` : (index % 2 === 0 ? brand.primary : brand.accent), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: w * 0.06 + 'px', boxSizing: 'border-box', overflow: 'hidden', animation: animated && animating ? 'fSl 0.5s ease both' : undefined }}>
      <style>{`@keyframes fSl{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: brand.headlineFont + ',serif', color: brand.text, fontSize: w * 0.045 + 'px', fontWeight: '600', opacity: 0.9 }}>{brand.logoText}</span>
        {total > 1 && <span style={{ fontFamily: brand.bodyFont + ',sans-serif', color: brand.text, fontSize: w * 0.03 + 'px', opacity: 0.5 }}>{index + 1}/{total}</span>}
      </div>
      <div>
        <div style={{ fontFamily: brand.headlineFont + ',serif', color: brand.text, fontSize: w * 0.075 + 'px', lineHeight: 1.15, fontWeight: '600', marginBottom: w * 0.025 + 'px' }}>{slide.headline || 'Headline'}</div>
        {slide.body && <div style={{ fontFamily: brand.bodyFont + ',sans-serif', color: brand.text, fontSize: w * 0.038 + 'px', lineHeight: 1.6, opacity: 0.85, fontWeight: '300' }}>{slide.body}</div>}
        {slide.cta && <div style={{ marginTop: w * 0.04 + 'px', borderBottom: '1px solid ' + brand.text, paddingBottom: '2px', display: 'inline-block', fontFamily: brand.bodyFont + ',sans-serif', color: brand.text, fontSize: w * 0.03 + 'px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{slide.cta}</div>}
      </div>
      <div style={{ fontFamily: brand.bodyFont + ',sans-serif', color: brand.text, fontSize: w * 0.026 + 'px', opacity: 0.4 }}>{brand.handle}</div>
    </div>
  );
}

function Social() {
  const [br, setBr] = useState(DEFAULT_BRAND);
  const [showBr, setShowBr] = useState(false);
  const [plat, setPlat] = useState('Instagram');
  const [fmt, setFmt] = useState('Carousel');
  const [topic, setTopic] = useState('');
  const [msg, setMsg] = useState('');
  const [imgs, setImgs] = useState('');
  const [n, setN] = useState('5');
  const [tone, setTone] = useState('Confident and creative — never corporate');
  const [slides, setSlides] = useState([]);
  const [caption, setCap] = useState('');
  const [tags, setTags] = useState('');
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState(null);
  const [cur, setCur] = useState(0);
  const [anim, setAnim] = useState(false);
  const [cp, setCp] = useState(false);
  const [exporting, setExporting] = useState(false);
  const slideRef = useRef(null);
  const exportSlides = async () => {
    if (slides.length === 0 || slideRef.current === null) return;
    setExporting(true);
    try {
      const h2c = (await import('html2canvas')).default;
      for (let i = 0; i < slides.length; i++) {
        setCur(i);
        await new Promise(r => setTimeout(r, 400));
        const canvas = await h2c(slideRef.current, { useCORS: true, scale: 2 });
        const link = document.createElement('a');
        link.download = 'slide-' + (i+1) + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        await new Promise(r => setTimeout(r, 300));
      }
    } catch(e) { console.error(e); } finally { setExporting(false); }
  };

  const upd = (k, v) => setBr(b => ({ ...b, [k]: v }));
  const go = useCallback((i) => { setAnim(true); setCur(i); setTimeout(() => setAnim(false), 600); }, []);
  const isAnim = fmt === 'Animated';

  useEffect(() => {
    if (!isAnim || slides.length === 0) return;
    const t = setInterval(() => { setCur(i => { const nx = (i + 1) % slides.length; setAnim(true); setTimeout(() => setAnim(false), 600); return nx; }); }, 3000);
    return () => clearInterval(t);
  }, [isAnim, slides.length]);

  const generate = useCallback(async () => {
    if (!topic) { setErr('Enter a topic.'); return; }
    setGen(true); setErr(null); setSlides([]); setCap(''); setTags('');
    const urls = imgs.split('\n').map(u => u.trim()).filter(Boolean);
    const nc = fmt === 'Single post' ? 1 : parseInt(n);
    try {
      const t = await callAI(`Social content for ${br.name}, creative branding studio London. Tagline: "${br.tagline}". Platform: ${plat}. Format: ${fmt} (${nc} slides). Tone: ${tone}. Topic: ${topic}. Message: ${msg || 'infer'}. ${urls.length ? 'Images: ' + urls.join(', ') : 'Text-led'}.\n${fmt === 'Carousel' ? `${nc}-slide carousel. Slide 1 hooks. Last CTA. Each: headline (8 words max), body (25 words max), cta (5 words max).` : fmt === 'Single post' ? 'Single: headline (10 words), body (30 words), cta (6 words).' : `Animated ${nc} slides, narrative flow, short punchy headlines.`}\nCaption (2-3 sentences, ${plat === 'Instagram' ? 'punchy' : 'professional'}) and 6 hashtags.\nReturn ONLY JSON: {"slides":[{"headline":"","body":"","cta":"","imageUrl":""}],"caption":"","hashtags":[""]}`, true);
      const p = xj(t);
      setSlides((p.slides || []).map((s, i) => ({ ...s, imageUrl: urls[i] || '' })));
      setCap(p.caption || ''); setTags((p.hashtags || []).join(' ')); setCur(0);
    } catch (e) { setErr(e.message); }
    finally { setGen(false); }
  }, [br, plat, fmt, topic, msg, imgs, n, tone]);

  const d = PDIMS[plat]; const sc = 0.42; const pw = d.w * sc; const ph = d.h * sc;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono }}>{br.name} · {plat} · {fmt}</div>
        <Btn onClick={() => setShowBr(s => !s)}>{showBr ? 'Hide brand' : 'Brand ✎'}</Btn>
      </div>

      {showBr && (
        <div style={{ background: T.bgS, border: `0.5px solid ${T.bd}`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
            <Fld label="Primary colour" value={br.primary} onChange={v => upd('primary', v)} />
            <Fld label="Accent colour" value={br.accent} onChange={v => upd('accent', v)} />
            <Fld label="Text colour" value={br.text} onChange={v => upd('text', v)} />
            <Fld label="Logo / wordmark" value={br.logoText} onChange={v => upd('logoText', v)} />
            <Fld label="Handle" value={br.handle} onChange={v => upd('handle', v)} />
            <Fld label="Headline font" value={br.headlineFont} onChange={v => upd('headlineFont', v)} />
          </div>
          <Fld label="Tagline" value={br.tagline} onChange={v => upd('tagline', v)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <label style={{ fontSize: '11px', color: T.txT, display: 'block', marginBottom: '3px', fontFamily: T.mono }}>Platform</label>
          <div style={{ display: 'flex', gap: '5px' }}>{PLATS.map(p => <Btn key={p} onClick={() => setPlat(p)} style={{ flex: 1, fontWeight: plat === p ? '500' : '400', background: plat === p ? T.bgS : 'none', borderColor: plat === p ? T.tx : T.bd }}>{p}</Btn>)}</div>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: T.txT, display: 'block', marginBottom: '3px', fontFamily: T.mono }}>Format</label>
          <div style={{ display: 'flex', gap: '5px' }}>{FMTS.map(f => <Btn key={f} onClick={() => setFmt(f)} style={{ flex: 1, fontSize: '11px', padding: '7px 4px', fontWeight: fmt === f ? '500' : '400', background: fmt === f ? T.bgS : 'none', borderColor: fmt === f ? T.tx : T.bd }}>{f}</Btn>)}</div>
        </div>
      </div>

      <div style={{ background: T.bg, border: `0.5px solid ${T.bd}`, borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
        <Fld label="Topic" value={topic} onChange={setTopic} placeholder="e.g. Wonderball mini golf — The Park RVA" />
        <Fld label="Key message" value={msg} onChange={setMsg} placeholder="e.g. Full-service from concept to installation" multiline />
        <Fld label="Image URLs (one per line)" value={imgs} onChange={setImgs} placeholder="https://..." multiline />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0 12px' }}>
          {fmt !== 'Single post' && <Fld label="Slides" value={n} onChange={setN} />}
          <Fld label="Tone" value={tone} onChange={setTone} />
        </div>
      </div>

      {err && <div style={{ padding: '10px', marginBottom: '10px', fontSize: '13px', background: T.bgD, color: T.txD, borderRadius: '6px' }}>{err}</div>}
      <Btn onClick={generate} disabled={gen} full>{gen ? 'Writing and designing…' : `Generate ${fmt.toLowerCase()} ↗`}</Btn>

      {slides.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono }}>{slides.length} slides · {d.label}{isAnim ? ' · Auto-playing' : ''}</div>
            <Btn onClick={exportSlides} disabled={exporting}>{exporting ? 'Exporting...' : 'Export PNGs'}</Btn>
            {slides.length > 1 && !isAnim && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <Btn onClick={() => go(Math.max(0, cur - 1))} disabled={cur === 0}>←</Btn>
                <span style={{ fontSize: '12px', color: T.txT, padding: '4px 8px' }}>{cur + 1}/{slides.length}</span>
                <Btn onClick={() => go(Math.min(slides.length - 1, cur + 1))} disabled={cur === slides.length - 1}>→</Btn>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', background: T.bgS, borderRadius: '8px', padding: '16px', marginBottom: '10px', overflow: 'hidden' }} ref={slideRef}>
            <SlideView slide={slides[cur] || {}} brand={br} platform={plat} index={cur} total={slides.length} animated={isAnim} animating={anim} />
          </div>
          {slides.length > 1 && !isAnim && (
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '10px', overflowX: 'auto' }}>
              {slides.map((s, i) => (
                <div key={i} onClick={() => go(i)} style={{ width: pw * 0.26, height: ph * 0.26, flexShrink: 0, background: s.imageUrl ? `url(${s.imageUrl}) center/cover` : (i % 2 === 0 ? br.primary : br.accent), borderRadius: '3px', border: cur === i ? `2px solid ${T.txI}` : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          )}
          <div style={{ background: T.bg, border: `0.5px solid ${T.bd}`, borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: T.txT, fontFamily: T.mono }}>Caption + hashtags</div>
              <Btn onClick={() => { navigator.clipboard.writeText(caption + '\n\n' + tags); setCp(true); setTimeout(() => setCp(false), 2000); }}>{cp ? 'Copied ✓' : 'Copy'}</Btn>
            </div>
            <div style={{ fontSize: '13px', color: T.tx, lineHeight: '1.7', marginBottom: '8px' }}>{caption}</div>
            <div style={{ fontSize: '12px', color: T.txI, lineHeight: '1.8' }}>{tags}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOARD ────────────────────────────────────────────────────────────────────
const BOARD_MEMBERS = [
  { id: 'colin', name: 'Commercial Colin', title: 'Commercial Director', color: '#185FA5', initials: 'CC' },
  { id: 'vinny', name: 'Vinny the Van', title: 'Creative Director', color: '#C8392B', initials: 'VV' },
  { id: 'epic', name: 'Epic Thunder', title: 'Operations', color: '#2A7A4B', initials: 'ET' },
  { id: 'bub', name: 'Bub', title: "Devil's Advocate", color: '#7B4EA0', initials: 'B' },
];

const BOARD_TYPES = [
  { id: 'newbiz', label: 'New business', desc: 'Should we pitch?' },
  { id: 'pricing', label: 'Pricing & proposal', desc: 'What should we charge?' },
  { id: 'marketing', label: 'Go-to-market', desc: 'How do we reach them?' },
];

const BOARD_FIELDS = {
  newbiz: [
    { key: 'client', label: 'Client / prospect', placeholder: 'e.g. The Alley Cat Club, Manchester' },
    { key: 'sector', label: 'Sector', placeholder: 'e.g. Competitive socialising' },
    { key: 'brief', label: 'Opportunity', placeholder: 'e.g. Full rebrand + venue concept, 3-floor site', multiline: true },
    { key: 'budget', label: 'Budget signals', placeholder: 'e.g. £4k pm, no budget mentioned' },
    { key: 'timeline', label: 'Timeline', placeholder: 'e.g. Immediate' },
    { key: 'gut', label: 'Your gut feeling', placeholder: 'e.g. Great brand but client felt vague', multiline: true },
  ],
  pricing: [
    { key: 'client', label: 'Client', placeholder: 'e.g. Draughts London' },
    { key: 'scope', label: 'Scope of work', placeholder: 'e.g. Brand identity, website, venue signage', multiline: true },
    { key: 'size', label: 'Client size', placeholder: 'e.g. Independent, 2 sites, ~£2m turnover' },
    { key: 'budget', label: 'Budget signals', placeholder: 'e.g. Said £15k, worth £28k' },
    { key: 'timeline', label: 'Timeline', placeholder: 'e.g. 10 weeks' },
    { key: 'similar', label: 'Comparable jobs', placeholder: 'e.g. Mama Bamboo £22k, More Concierge £18k', multiline: true },
  ],
  marketing: [
    { key: 'offer', label: 'What are we selling', placeholder: 'e.g. Bespoke mini golf design and build, full service' },
    { key: 'sector', label: 'Target sector', placeholder: 'e.g. Competitive socialising, golf clubs, holiday parks' },
    { key: 'region', label: 'Target region', placeholder: 'e.g. UK initially, then USA' },
    { key: 'current', label: 'Current positioning', placeholder: 'e.g. Premium product with proven results, not well known yet', multiline: true },
    { key: 'channels', label: 'Channels available', placeholder: 'e.g. Cold email, LinkedIn, blog, Google Ads' },
    { key: 'casestudies', label: 'Strongest case studies', placeholder: 'e.g. Wonderball, Levels Prague, Pop Golf' },
    { key: 'budget', label: 'Marketing budget', placeholder: 'e.g. Time-rich, cash-poor — doing it myself' },
    { key: 'goal', label: 'Goal', placeholder: 'e.g. 1 new client in 3 months', multiline: true },
  ],
};

const BOARD_PROMPTS = {
  newbiz: (ctx) => `Smith & Devil board meeting. New business decision.\n\nContext:\n${ctx}\n\nBoard members:\n- colin (Commercial Colin, Commercial Director): margin, risk, growth potential, strategic fit\n- vinny (Vinny the Van, Creative Director): creative opportunity, brand fit, craft standards\n- epic (Epic Thunder, Operations): capacity, timeline, deliverability\n- bub (Bub, Devil's Advocate): challenges assumptions, exposes uncomfortable truths\n\nWrite 5-7 sharp messages. Real conversation — they challenge each other. Bub must poke at least one uncomfortable truth. Each message under 70 words.\n\nReturn ONLY valid JSON:\n{"messages":[{"speaker":"colin","text":"..."},{"speaker":"vinny","text":"..."}],"verdict":"..."}`,
  pricing: (ctx) => `Smith & Devil board meeting. Pricing decision.\n\nContext:\n${ctx}\n\nBoard: colin (Commercial Colin), vinny (Vinny the Van), epic (Epic Thunder), bub (Bub).\n\nWrite 5-7 messages debating the right price. Specific numbers. Challenge the budget signals. Reference comparable jobs if mentioned. Bub questions at least one assumption.\n\nReturn ONLY valid JSON:\n{"messages":[{"speaker":"colin","text":"..."}],"verdict":"..."}`,
  marketing: (ctx) => `Smith & Devil board meeting. Go-to-market strategy.\n\nContext:\n${ctx}\n\nBoard: colin (Commercial Colin), vinny (Vinny the Van), epic (Epic Thunder), bub (Bub).\n\nDebate: which prospect types to prioritise, what the ideal profile is, which channels to lead with, how to position comms. Bub challenges the assumptions everyone's making. Write 5-7 messages.\n\nReturn ONLY valid JSON:\n{"messages":[{"speaker":"colin","text":"..."}],"verdict":"..."}`,
};

function BAvatar({ m, size = 34 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: size * 0.28 + 'px', fontWeight: '500', color: '#fff', fontFamily: T.sans, letterSpacing: '0.04em' }}>{m.initials}</div>;
}

function BoardMessage({ m, text, isVerdict }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const t = setTimeout(() => setShow(true), 80); return () => clearTimeout(t); }, []);

  if (isVerdict) return (
    <div ref={ref} style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(10px)', transition: 'all 0.5s ease', padding: '16px 18px', background: T.bg, border: `1.5px solid ${T.tx}`, borderRadius: '8px' }}>
      <div style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Board verdict</div>
      <div style={{ fontSize: '14px', color: T.tx, lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );

  return (
    <div ref={ref} style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <BAvatar m={m} size={32} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: '500', color: m.color }}>{m.name}</span>
          <span style={{ fontSize: '10px', color: T.txT }}>{m.title}</span>
        </div>
        <div style={{ fontSize: '13px', color: T.tx, lineHeight: '1.75', background: T.bgS, padding: '11px 13px', borderRadius: '0 6px 6px 6px', borderLeft: `2px solid ${m.color}`, whiteSpace: 'pre-wrap' }}>{text}</div>
      </div>
    </div>
  );
}

function Board() {
  const [dtype, setDtype] = useState('newbiz');
  const [form, setForm] = useState({});
  const [messages, setMessages] = useState([]);
  const [verdict, setVerdict] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [screen, setScreen] = useState('brief');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, verdict]);

  const fields = BOARD_FIELDS[dtype];
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const getMember = id => BOARD_MEMBERS.find(b => b.id === id) || BOARD_MEMBERS[0];

  const convene = useCallback(async () => {
    setRunning(true); setError(null); setMessages([]); setVerdict(''); setScreen('board');
    const ctx = fields.map(f => `${f.label}: ${form[f.key] || 'Not specified'}`).join('\n');
    try {
      const text = await callAI(BOARD_PROMPTS[dtype](ctx));
      const parsed = xj(text);
      const msgs = parsed.messages || [];
      for (let i = 0; i < msgs.length; i++) {
        await sleep(i === 0 ? 300 : 900);
        setMessages(prev => [...prev, msgs[i]]);
      }
      await sleep(800);
      setVerdict(parsed.verdict || '');
    } catch (e) {
      setError(e.message || JSON.stringify(e));
    } finally {
      setRunning(false);
    }
  }, [dtype, form, fields]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: T.tx, fontFamily: T.serif, letterSpacing: '-0.01em' }}>The Board</div>
          <div style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, letterSpacing: '0.08em', marginTop: '2px' }}>Smith & Devil · Advisory</div>
        </div>
        {screen === 'board' && !running && (
          <Btn onClick={() => { setScreen('brief'); setMessages([]); setVerdict(''); setError(null); }}>← New decision</Btn>
        )}
      </div>

      {screen === 'brief' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {BOARD_MEMBERS.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', background: T.bgS, borderRadius: '6px', border: `0.5px solid ${T.bd}` }}>
                <BAvatar m={m} size={30} />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '500', color: T.tx }}>{m.name}</div>
                  <div style={{ fontSize: '10px', color: T.txT }}>{m.title}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {BOARD_TYPES.map(dt => (
              <button key={dt.id} onClick={() => { setDtype(dt.id); setForm({}); }} style={{ flex: 1, padding: '9px 12px', fontSize: '12px', fontWeight: dtype === dt.id ? '500' : '400', background: dtype === dt.id ? T.bgS : 'none', borderColor: dtype === dt.id ? T.tx : T.bd, borderRadius: '6px', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ color: T.tx, marginBottom: '1px' }}>{dt.label}</div>
                <div style={{ fontSize: '10px', color: T.txT, fontWeight: '300' }}>{dt.desc}</div>
              </button>
            ))}
          </div>

          <div style={{ background: T.bg, border: `0.5px solid ${T.bd}`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
            {fields.map(f => <Fld key={f.key} label={f.label} value={form[f.key] || ''} onChange={v => upd(f.key, v)} placeholder={f.placeholder} multiline={f.multiline} />)}
          </div>

          <Btn onClick={convene} disabled={!form[fields[0].key]} full>Convene the board ↗</Btn>
        </div>
      )}

      {screen === 'board' && (
        <div>
          <div style={{ fontSize: '12px', color: T.txS, marginBottom: '16px' }}>
            {dtype === 'newbiz' ? 'New business: ' : dtype === 'pricing' ? 'Pricing: ' : 'Go-to-market: '}{form[fields[0].key] || ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {messages.map((msg, i) => <BoardMessage key={i} m={getMember(msg.speaker)} text={msg.text} />)}
            {running && messages.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: T.txT, fontSize: '13px' }}>The board is reviewing the brief…</div>}
            {running && messages.length > 0 && <div style={{ fontSize: '12px', color: T.txT, fontStyle: 'italic', padding: '4px 0' }}>…</div>}
            {error && <div style={{ padding: '10px 14px', fontSize: '12px', background: T.bgD, color: T.txD, borderRadius: '6px', fontFamily: T.mono }}>{error}</div>}
            {verdict && <BoardMessage m={BOARD_MEMBERS[0]} text={verdict} isVerdict />}
            <div ref={endRef} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dash', label: 'Dashboard' },
  { id: 'out', label: 'Outbound' },
  { id: 'soc', label: 'Social' },
  { id: 'board', label: 'The Board' },
  { id: 'brand', label: 'Brand 😈' },
];

// ─── BRAND GUIDE TAB ─────────────────────────────────────────────────────────
function Brand() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ borderBottom: `0.5px solid ${T.bd}`, paddingBottom: '16px' }}>
        <h2 style={{ fontFamily: T.sans, fontWeight: 200, fontSize: '36px', lineHeight: 1, letterSpacing: '-0.025em', color: T.midnight, marginBottom: '4px' }}>
          Brand <span style={{ fontFamily: T.serif, fontStyle: 'italic', color: T.red }}>System.</span>
        </h2>
        <p style={{ fontFamily: T.body, fontSize: '13px', color: T.txS, marginTop: '6px' }}>
          The living S&D brand guide — open in full for editing and exporting.
        </p>
      </div>

      {/* Quick tokens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
        {[
          { name: 'Midnight', hex: '#0D0D0B' },
          { name: 'Devil Red', hex: '#C41E2D' },
          { name: 'White', hex: '#FFFFFF' },
          { name: 'Violet', hex: '#5C1A9A' },
          { name: 'Spark', hex: '#C8EC3C' },
          { name: 'Flash', hex: '#F572A8' },
        ].map(c => (
          <div key={c.hex} style={{ background: c.hex, borderRadius: '4px', padding: '12px 10px', border: c.hex === '#FFFFFF' ? `0.5px solid ${T.bd}` : 'none' }}>
            <p style={{ fontFamily: T.mono, fontSize: '8px', color: c.hex === '#0D0D0B' || c.hex === '#5C1A9A' ? 'rgba(255,255,255,.5)' : 'rgba(13,13,11,.45)', letterSpacing: '.06em', marginBottom: '2px' }}>{c.name.toUpperCase()}</p>
            <p style={{ fontFamily: T.mono, fontSize: '9px', color: c.hex === '#0D0D0B' || c.hex === '#5C1A9A' ? 'rgba(255,255,255,.7)' : 'rgba(13,13,11,.5)' }}>{c.hex}</p>
          </div>
        ))}
      </div>

      {/* Type specimen */}
      <div style={{ background: T.midnight, borderRadius: '6px', padding: '24px 28px' }}>
        <p style={{ fontFamily: T.sans, fontWeight: 200, fontSize: '32px', lineHeight: 1, letterSpacing: '-0.025em', color: '#FFFFFF', marginBottom: '2px' }}>
          Playing hard to <span style={{ fontFamily: T.serif, fontStyle: 'italic', color: T.spark }}>work</span> harder.
        </p>
        <p style={{ fontFamily: T.mono, fontSize: '9px', color: 'rgba(255,255,255,.3)', marginTop: '12px', letterSpacing: '.08em' }}>CABINET GROTESK 200 + PLAYFAIR DISPLAY ITALIC · THE SWITCH</p>
      </div>

      {/* Social card previews */}
      <div>
        <p style={{ fontFamily: T.mono, fontSize: '9px', color: T.txT, letterSpacing: '.08em', marginBottom: '10px' }}>SOCIAL CARD SAMPLES</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {[
            { bg: T.midnight, fg: '#FFFFFF', acc: T.spark, sans: '3 weeks.', serif: 'Brief to launch.', emoji: '🏹' },
            { bg: T.red, fg: '#FFFFFF', acc: '#FFFFFF', sans: 'Seriously', serif: 'Playful.', emoji: '😈' },
            { bg: T.spark, fg: T.midnight, acc: T.violet, sans: 'Zero ad spend.', serif: 'Just good work.', emoji: '🧲' },
            { bg: T.violet, fg: '#FFFFFF', acc: T.flash, sans: 'Playing hard to', serif: 'work harder.', emoji: '🥊' },
          ].map((card, i) => (
            <div key={i} style={{ background: card.bg, aspectRatio: '1', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', border: card.bg === '#FFFFFF' ? `0.5px solid ${T.bd}` : 'none' }}>
              <p style={{ fontFamily: T.sans, fontWeight: 200, fontSize: '13px', lineHeight: 1.1, letterSpacing: '-0.02em', color: card.fg, marginBottom: '2px' }}>{card.sans}</p>
              <p style={{ fontFamily: T.serif, fontStyle: 'italic', fontSize: '15px', lineHeight: 1, color: card.acc }}>{card.serif}</p>
              <span style={{ fontSize: '16px', marginTop: '6px' }}>{card.emoji}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Open full guide */}
      <a
        href="https://claude.ai/artifacts"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', background: T.midnight, color: '#FFFFFF', borderRadius: '6px', padding: '16px 20px', textDecoration: 'none', border: 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: T.sans, fontWeight: 300, fontSize: '18px', letterSpacing: '-0.015em' }}>
              Open full brand <span style={{ fontFamily: T.serif, fontStyle: 'italic', color: T.spark }}>system</span> →
            </p>
            <p style={{ fontFamily: T.body, fontSize: '12px', color: 'rgba(255,255,255,.4)', marginTop: '4px' }}>9 tabs · editable · persistent · v10.0</p>
          </div>
          <span style={{ fontSize: '28px' }}>😈</span>
        </div>
      </a>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('dash');

  return (
    <div style={{ minHeight: '100vh', background: T.bgS }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 16px', borderBottom: `0.5px solid ${T.bd}`, marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <div style={{ fontSize: '26px', fontWeight: 200, color: T.midnight, fontFamily: T.sans, letterSpacing: '-0.03em' }}>S&D <span style={{ fontFamily: T.serif, fontStyle: 'italic', color: T.red }}>OS</span></div>
            <div style={{ fontSize: '9px', color: T.txT, fontFamily: T.mono, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Smith & Devil</div>
          </div>
          <div style={{ display: 'flex' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ fontSize: '13px', padding: '6px 16px', fontWeight: tab === t.id ? '500' : '400', borderBottom: tab === t.id ? `2px solid ${T.red}` : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, background: 'none', color: tab === t.id ? T.tx : T.txT, cursor: 'pointer' }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          {tab === 'dash' && <Dashboard />}
          {tab === 'out' && <Outbound />}
          {tab === 'soc' && <Social />}
          {tab === 'board' && <Board />}
          {tab === 'brand' && <Brand />}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '10px', color: T.txT, fontFamily: T.mono }}>
          S&D OS · monday.com · Anthropic AI · v1.1 😈
        </div>
      </div>
    </div>
  );
}
