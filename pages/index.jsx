import { useState, useEffect, useCallback, useRef } from 'react';

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: '#FFFFFF', bgS: '#F7F6F3', bgD: '#FDF1F2', bgSu: '#F0FDF4',
  bgW: '#FFFBEB', bgI: '#F5F3FF',
  tx: '#0D0D0B', txS: '#5a5a56', txT: '#9ca3af',
  txD: '#C41E2D', txSu: '#16a34a', txW: '#b45309', txI: '#5C1A9A',
  bd: '#E8E6E1', bdS: '#D4D1CB',
  red: '#C41E2D', midnight: '#0D0D0B', violet: '#5C1A9A',
  spark: '#C8EC3C', flash: '#F572A8',
  accent: '#C41E2D', blue: '#5C1A9A', orange: '#F572A8', green: '#16a34a',
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



// 6 genuinely distinct marks. Each has a specific, deliberate character.
// All use negative offsets to extend 14px above/below and 18px left/right of text.
// ViewBox 0 0 110 50 — text sits roughly in the centre zone x:18–92, y:14–36.
const circleVariants = [

  // 1. FAST LOOP — single confident stroke, GAP deliberately on the RIGHT
  //    Pen enters top-left, sweeps clockwise, almost closes but lifts before meeting.
  ({ color }) => (
    <svg viewBox="0 0 110 50" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 28px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 100,20 C 108,8 88,2 55,2 C 22,2 4,10 4,25 C 4,40 22,48 55,48 C 82,48 100,42 104,32"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),

  // 2. RUBBER BAND — super flat, thin. Almost two parallel lines curving at ends.
  //    The flattest possible oval. Delicate.
  ({ color }) => (
    <svg viewBox="0 0 110 36" style={{ position:"absolute",top:"-8px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 16px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 8,18 C 8,6 24,2 55,2 C 86,2 102,6 102,18 C 102,30 86,34 55,34 C 24,34 8,30 8,20 L 11,17"
        fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),

  // 3. EMPHATIC THIN DOUBLE — thin stroke, circled TWICE, second pass slightly bigger and messier.
  //    Both strokes thin. Start and end at different points so overlaps show.
  ({ color }) => (
    <svg viewBox="0 0 110 50" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 28px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 12,26 C 10,8 26,2 55,2 C 84,2 100,8 100,25 C 100,42 84,48 55,48 C 26,48 10,42 12,28 L 15,24"
        fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M 8,22 C 6,5 23,0 55,0 C 87,0 105,6 105,25 C 105,44 87,50 55,50 C 23,50 5,44 8,24 L 12,21"
        fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),

  // 4. TILTED — oval rotated ~20 degrees. Clearly reads as slanted, not horizontal.
  //    The tilt itself is the character.
  ({ color }) => (
    <svg viewBox="0 0 110 50" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 28px)",pointerEvents:"none",overflow:"visible",transform:"rotate(-20deg)",transformOrigin:"50% 50%" }}>
      <path d="M 10,26 C 8,8 26,2 55,2 C 84,2 102,8 102,25 C 102,42 84,48 55,48 C 26,48 8,42 10,28 L 13,24"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),

  // 5. FLICK EXIT — pen completes the loop then visibly flicks off downward.
  //    The tail is the signature — the moment the pen left the page.
  ({ color }) => (
    <svg viewBox="0 0 110 60" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 38px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 12,26 C 10,8 26,2 55,2 C 84,2 100,8 100,25 C 100,42 84,48 55,48 C 26,48 9,42 10,28 L 13,24 L 16,29 L 12,38 L 6,52"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

  // 6. HEAVY MARKER — thick bold stroke, single pass. Like a fat Sharpie circled fast.
  //    Weight is the whole point.
  ({ color }) => (
    <svg viewBox="0 0 110 50" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 28px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 10,26 C 8,7 26,2 55,2 C 84,2 102,8 102,25 C 102,42 84,48 55,48 C 26,48 8,43 10,28 L 14,23"
        fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

];

const SVGCircle = ({ color="#C41E2D", variant=0 }) => {
  const V = circleVariants[variant % circleVariants.length];
  return <V color={color}/>;
};

const SVGUnderline = ({ color="#C41E2D", width=120 }) => (
  <svg viewBox={`0 0 ${width} 10`} width={width} height={10} style={{ display:"block",marginTop:-2 }}>
    <path d={`M2,6 C${width*.2},3 ${width*.55},8 ${width-3},5`} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// Editable component
const E = ({ value, onChange, editMode, multiline=false, style={}, block=false }) => {
  const base = {
    background: editMode ? "rgba(200,236,60,0.15)" : "transparent",
    border: editMode ? "1px dashed rgba(100,140,0,0.4)" : "1px solid transparent",
    borderRadius: 2, outline:"none", padding: editMode ? "1px 4px" : "0",
    fontFamily:"inherit", fontSize:"inherit", fontWeight:"inherit",
    fontStyle:"inherit", letterSpacing:"inherit", lineHeight:"inherit",
    color:"inherit", cursor: editMode ? "text" : "inherit",
    display: block ? "block" : "inline",
    width: block ? "100%" : "auto",
    ...style,
  };
  if (!editMode) return block ? <span style={{ display:"block" }}>{value}</span> : <span>{value}</span>;
  return multiline
    ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} style={{ ...base, display:"block", width:"100%", resize:"vertical" }}/>
    : <input value={value} onChange={e=>onChange(e.target.value)} style={base}/>;
};

const initContent = {
  // IDEA
  idea: {
    heading1: "Seriously",
    heading2: "Playful.",
    // heading1 renders in serif (flipped), heading2 renders in sans
    body1: "The name is the brief. The Smith — craft, precision, 20+ years of hard-earned know-how. The Devil — audacity, mischief, the move no one else would make.",
    body2: "Two forces in permanent creative tension. They don't compromise — they battle. Every brief is where they meet.",
    craftLabel: "Craft 🔨 — The Smith",
    craftDesc: "Precision. Deep colours. Considered marks. Thin type at scale. The work done properly.",
    creativityLabel: "Creativity ✨ — The Devil",
    creativityDesc: "Audacity. Candy colours. The serif switch-up. The circled word. The mischievous move that lands.",
    originHeading: "At over 6,000 years old, The Smith & The Devil is the world's most enduring story.",
    originBody: "Not bad for a narrative that pre-dates the written word. It's had a refresh or two along the way — but the devil's in the detail. A great story well-told has the power to last forever.",
  },
  // LOGO
  logo: {
    headingSerif: "ampersand",
    intro: "The logo is a Didone serif wordmark — high contrast thick/thin. \"Smith\" and \"Devil\" are restrained. The & is not. It's ornate, looped, larger than it should be. That tension is the whole brand.",
    lockups: [
      { label:"Full wordmark", desc:"Primary. Use wherever space allows. Never stretch or squeeze." },
      { label:"S&D monogram", desc:"Icon / avatar. Social, larger favicons, app icon." },
      { label:"& standalone", desc:"Favicon only. The brand's most distinctive character." },
    ],
    variants: [
      { tag:"Primary", label:"White/Red on Black" },
      { tag:"Reversed", label:"Black/Red on White" },
      { tag:"Single colour", label:"All Black on White" },
      { tag:"Brand colour", label:"White/Spark on Violet" },
    ],
    rules: [
      { do:true, text:"Always use the supplied logo files. Never recreate from type." },
      { do:false, text:"Never use the wordmark at less than 120px wide. Use the S&D icon instead." },
      { do:true, text:"The & is always red. In single-colour versions it matches the wordmark." },
      { do:false, text:"Never place the logo on a busy photograph without a clear zone or overlay." },
      { do:true, text:"Minimum clear space: the height of the capital S on all sides." },
      { do:false, text:"Never rotate, distort, recolour, or add effects to the logo." },
    ],
  },
  // COLOUR
  colour: {
    headingSans1: "Craft vs",
    headingSerifInline: "Creativity",
    intro: "Deep colours for craft. Candy colours for creativity.",
    colors: {
      craft: [
        { name:"Midnight", hex:"#0D0D0B", use:"The Smith's forge. All key backgrounds, the logo ground, hero moments." },
        { name:"Devil Red", hex:"#C41E2D", use:"The & — where craft meets danger. The brand signature. Earns its place every time." },
        { name:"White", hex:"#FFFFFF", use:"The canvas. Clean ground — lets craft and creativity battle it out on top." },
      ],
      creativity: [
        { name:"Violet", hex:"#5C1A9A", use:"Deep, made, considered. Pairs with Midnight, contrasts the candy colours hard." },
        { name:"Spark", hex:"#C8EC3C", use:"Candy lime. The creative energy hit. Works hardest against Midnight and Violet." },
        { name:"Flash", hex:"#F572A8", use:"Candy pink. Playful, warm, the devil's lighter side. Stop the scroll." },
      ],
    },
    combos: [
      { label:"Default", note:"White ground. All pages." },
      { label:"Midnight", note:"Craft hero moments." },
      { label:"Violet", note:"Craft depth, creative spark." },
      { label:"Spark", note:"Creativity in full force." },
      { label:"Flash", note:"The devil's lighter side." },
    ],
  },
  // TYPE
  type: {
    headingSerifInline: "unexpected",
    intro: "The weight is the restraint. The switch is the surprise.",
    mischiefIntro: "The serif switch is one move. Mischief with type means knowing when to use it — and when to do something weirder instead.",
    mischiefMoves: [
      { label:"BURY THE SERIF", render:"serif-buried", before:"Playing hard to ", serif:"work", after:" harder.", note:"Not 'harder.' — work. The effort, not the result. The last word is too obvious." },
      { label:"SCALE CLASH", render:"scale-clash", big:"Done.", small:"Brief arrived in January. Handed it back in March. Live in April.", note:"One word enormous. Everything else small. The size is the statement." },
      { label:"MONO INTERRUPTS", render:"mono-interrupt", before:"Big-agency firepower.", mono:"without the overhead.", note:"Space Mono crashes the display moment. Completely wrong register — which makes it work." },
      { label:"SERIF BURIES IN PROSE", render:"serif-mid", before:"Most briefs ", serif:"aren't", after:" briefs.", note:"Preposition, negation, a throwaway word. Never the noun. Never the last word." },
      { label:"WEIGHT ONLY — NO SERIF", render:"weight-only", light:"Brief in. Chaos out.", bold:"Magic happens.", note:"Heavy weight on the payoff, no italic needed. The devil doesn't always need to show up." },
      { label:"ONE WORD. FULL STOP.", render:"all-in", serif:"Delivered.", note:"Drop everything else. When there's only one word worth saying, say only that." },
    ],
    scale: [
      { label:"Hero", size:"88px", weight:"200", sample:"Seriously Playful." },
      { label:"H1", size:"60px", weight:"300", sample:"Big-agency firepower." },
      { label:"H2", size:"42px", weight:"300", sample:"What we do." },
      { label:"Accent", size:"42px", weight:"400i", sample:"can't put down." },
      { label:"Body L", size:"18px", weight:"400", sample:"We design experiences people want to be in." },
      { label:"Body", size:"16px", weight:"400", sample:"Brief in. Chaos out. Magic happens." },
      { label:"Micro", size:"11px", weight:"400m", sample:"SDV · 04 · LDN" },
    ],
  },
  // MARKS
  marks: {
    headingSerif: "right",
    intro: "Hand-drawn circles and underlines. The editorial punctuation that says: this one matters. Use sparingly — one mark per piece, two at most.",
    circleExamples: [
      { label:"Red on white", phrase:"seriously" },
      { label:"Spark on black", phrase:"playful" },
      { label:"Flash on violet", phrase:"magic" },
    ],
    underlineExamples: [
      { label:"Red on white", line1:"Big-agency firepower", line2:"without the baggage." },
      { label:"Spark on black", line1:"Playing hard to", line2:"work harder." },
    ],
    rules: [
      "One mark per piece. Two maximum. More than that and nothing is marked.",
      "Circles go around nouns and phrases. Underlines go under the punchline or key claim.",
      "Use creativity palette colours for marks on dark backgrounds. Use Devil Red on white.",
      "Marks should feel like they were added by hand after the type was set — not designed in.",
    ],
  },
  // VOICE
  voice: {
    headingSans: "mischievous",
    intro: "The design is calm. The copy does the work.",
    examples: [
      { do:"Playing hard to work harder. 💪", doSub:"Our work comes from a playful place — but it doesn't pass the test unless it's built on rock solid strategy.", dont:"Our creative approach is underpinned by robust strategic thinking.", dontSub:"Same point. Zero personality." },
      { do:"The devil's in the detail. We put him there. 😈", doSub:"Short. Earns the name. Owns the reference.", dont:"We pay close attention to every aspect of the work we produce.", dontSub:"Every agency says this. In those exact words." },
      { do:"Big-agency firepower without the big-agency baggage.", doSub:"Specific contrast. Positions against a real client anxiety.", dont:"An agile alternative to the traditional agency model.", dontSub:"LinkedIn post, 2019." },
      { do:"Brief in. Chaos out. Magic happens.", doSub:"Three sentences. Each one earns the next.", dont:"Our streamlined onboarding process ensures efficient project initiation.", dontSub:"Reads like terms and conditions." },
    ],
    emojis: {
      craft: [
        { emoji:"🔨", use:"The making. Craft, build, deliver." },
        { emoji:"⚒️", use:"The forge. The physical act of making." },
        { emoji:"📐", use:"Precision and strategy. The plan that holds." },
        { emoji:"✂️", use:"Editing, sharpening, cutting to the point." },
        { emoji:"⚗️", use:"Experimentation with rigour. The test." },
        { emoji:"🔭", use:"Seeing further than the brief." },
        { emoji:"🧩", use:"The piece that finally fits." },
        { emoji:"🏹", use:"Precise. Intentional. Hits the mark." },
      ],
      creativity: [
        { emoji:"✨", use:"The creative spark. Magic happening." },
        { emoji:"💡", use:"The idea arriving. Unexpected and right." },
        { emoji:"🪄", use:"The devil's move — the trick that works." },
        { emoji:"⚡", use:"Speed and impact. The unexpected hit." },
        { emoji:"🌀", use:"Chaos before clarity. The creative process, honestly." },
        { emoji:"🎲", use:"A calculated gamble. Risk with intent." },
        { emoji:"🎭", use:"Performance, spectacle, the big reveal." },
        { emoji:"🪩", use:"Unserious energy deployed seriously." },
      ],
      disrupt: [
        { emoji:"😈", use:"The devil. Use it like a signature — sparingly, when something is properly, unmistakably S&D." },
        { emoji:"💣", use:"The idea that blows up the brief. Use when something is properly disruptive." },
        { emoji:"🧨", use:"A shorter fuse. Smaller explosion. Still a statement." },
        { emoji:"🥊", use:"Fighting talk. Positioning against something." },
        { emoji:"🪤", use:"They didn't see it coming. The trap that delights." },
        { emoji:"👻", use:"The thing nobody else in the room said." },
        { emoji:"🦊", use:"Cunning. Clever. A little bit devil." },
        { emoji:"🫦", use:"Audacious. Bold. Slightly uncomfortable — in a good way." },
        { emoji:"📡", use:"All signal, no noise. Cut through." },
      ],
      random: [
        { emoji:"🐈", use:"Completely off-piste. The fonts.xyz move — disarms people." },
        { emoji:"🧿", use:"Warding off the ordinary. Protective energy." },
        { emoji:"🕹️", use:"Control. Play. The person in the room who knows the cheat codes." },
        { emoji:"🎪", use:"The spectacle. The whole show." },
        { emoji:"☻", use:"Old internet charm. Warm but a little unsettling." },
        { emoji:"💍", use:"One licence to rule them all. Cultural reference energy." },
        { emoji:"🌋", use:"Something is about to erupt. Build the tension." },
        { emoji:"🧲", use:"The gravitational pull of a good idea." },
      ],
    },
  },
  // SOCIAL
  social: {
    igResults: [
      { bg:"#0D0D0B", fg:"#FFFFFF", acc:"#C8EC3C", sans:"3 weeks.", serif:"Brief to launch.", emoji:"🏹" },
      { bg:"#FFFFFF", fg:"#0D0D0B", acc:"#C41E2D", sans:"Brief in February.", serif:"Live in April.", emoji:"🔨" },
      { bg:"#5C1A9A", fg:"#FFFFFF", acc:"#F572A8", sans:"Repositioned.", serif:"Relaunched.", emoji:"📐" },
      { bg:"#C8EC3C", fg:"#0D0D0B", acc:"#5C1A9A", sans:"Zero ad spend.", serif:"Just good work.", emoji:"🧲" },
      { bg:"#0D0D0B", fg:"#FFFFFF", acc:"#F572A8", sans:"Six months of", serif:"positioning. Done.", emoji:"⚗️" },
      { bg:"#FFFFFF", fg:"#0D0D0B", acc:"#C41E2D", sans:"Brief in. Chaos out.", serif:"Magic delivered.", emoji:"🌀" },
    ],
    igMessages: [
      { bg:"#FFFFFF", fg:"#0D0D0B", acc:"#C41E2D", sans:"Seriously", serif:"Playful.", emoji:"✨" },
      { bg:"#0D0D0B", fg:"#FFFFFF", acc:"#C8EC3C", sans:"The devil's in the detail.", serif:"We put him there.", emoji:"🦊" },
      { bg:"#5C1A9A", fg:"#FFFFFF", acc:"#F572A8", sans:"Playing hard to", serif:"work harder.", emoji:"🥊" },
      { bg:"#F572A8", fg:"#0D0D0B", acc:"#0D0D0B", sans:"Most briefs", serif:"aren't briefs.", emoji:"🪤" },
      { bg:"#C8EC3C", fg:"#0D0D0B", acc:"#5C1A9A", sans:"Big-agency firepower.", serif:"Without the baggage.", emoji:"💣" },
      { bg:"#0D0D0B", fg:"#FFFFFF", acc:"#C41E2D", sans:"Brief in. Chaos out.", serif:"Magic happens.", emoji:"🐈" },
    ],
    liResults: [
      { bg:"#0D0D0B", fg:"#FFFFFF", acc:"#C8EC3C", sans:"Brief to launch.", serif:"21 days. No drama.", emoji:"🏹" },
      { bg:"#5C1A9A", fg:"#FFFFFF", acc:"#F572A8", sans:"Repositioned. Relaunched.", serif:"Sold out.", emoji:"📐" },
      { bg:"#C8EC3C", fg:"#0D0D0B", acc:"#5C1A9A", sans:"Zero ad spend.", serif:"Just good work.", emoji:"🧲" },
      { bg:"#0D0D0B", fg:"#FFFFFF", acc:"#F572A8", sans:"Six months of positioning.", serif:"Done in six weeks.", emoji:"⚗️" },
    ],
    liMessages: [
      { bg:"#0D0D0B", fg:"#FFFFFF", acc:"#C41E2D", sans:"Most briefs aren't briefs.", serif:"Change my mind.", emoji:"🪤" },
      { bg:"#5C1A9A", fg:"#FFFFFF", acc:"#C8EC3C", sans:"We don't do average.", serif:"Neither should your brief.", emoji:"🧨" },
      { bg:"#F572A8", fg:"#0D0D0B", acc:"#0D0D0B", sans:"Playing hard to", serif:"work harder.", emoji:"🥊" },
      { bg:"#C8EC3C", fg:"#0D0D0B", acc:"#5C1A9A", sans:"Seriously", serif:"Playful.", emoji:"🎲" },
    ],
  },
    // BEHAVIOUR
  behaviour: {
    headingSans: "Not rules.",
    headingSerif: "Instincts.",
    items: [
      { side:"Both", name:"Seriously Playful is the proposition", desc:"Every execution should answer both: is this serious? Is this playful? If it's only one, it's not S&D. The tension is the brand." },
      { side:"Craft", name:"Deep colours do the serious work", desc:"Midnight, Devil Red and Violet carry the weight — precision, conviction, intent. Use them when S&D needs to be believed." },
      { side:"Creativity", name:"Candy colours do the playful work", desc:"Spark and Flash are the devil showing up uninvited. One per section — their power comes from being unexpected." },
      { side:"Both", name:"The serif is the signal", desc:"When a phrase needs to land — really land — switch to Playfair. The contrast between thin grotesque and high-contrast Didone IS the moment." },
      { side:"Both", name:"Marks are editorial, not decorative", desc:"A hand-drawn circle or underline says: this matters. Used sparingly on one or two words per piece, not scattered like confetti." },
      { side:"Creativity", name:"Emojis signal which side is speaking", desc:"Craft emojis (🔨 📐 ✂️) when the work is the point. Creativity emojis (✨ 💡 🪄) when the idea is the point. Never both in the same breath." },
    ],
  },
  webflowMeta: {
    headingSerif: "everywhere",
  },
};

// webflow headings live in initContent under webflowMeta
// Added via initContent.webflowMeta below — see render
const webflow = [
  { token:"--color-midnight", value:"#0D0D0B", note:"Craft — brand black" },
  { token:"--color-devil-red", value:"#C41E2D", note:"Craft — the &" },
  { token:"--color-violet", value:"#5C1A9A", note:"Craft — deep third" },
  { token:"--color-spark", value:"#C8EC3C", note:"Creativity — candy lime" },
  { token:"--color-flash", value:"#F572A8", note:"Creativity — candy pink" },
  { token:"--color-white", value:"#FFFFFF", note:"Base — site background" },
  { token:"--font-display", value:"'Cabinet Grotesk', sans-serif", note:"Hero, H1, H2" },
  { token:"--font-accent", value:"'Playfair Display', serif", note:"Didone switch-up — echoes logo" },
  { token:"--font-body", value:"'DM Sans', sans-serif", note:"Body, nav, UI" },
  { token:"--font-detail", value:"'Space Mono', monospace", note:"Metadata only" },
  { token:"--weight-hero", value:"200", note:"ExtraLight — hero display" },
  { token:"--weight-display", value:"300", note:"Light — H1/H2" },
];

const sections = ["Idea","Logo","Colour","Type","Marks","Voice","Behaviour","Social","Webflow"];

function BrandGuide() {
  const [active, setActive] = useState("Idea");
  const [editMode, setEditMode] = useState(false);
  const [ct, setCt] = useState(initContent);
  const [copied, setCopied] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved

  // Load saved content on mount
  useState(() => {
      try {
        const result = (()=>{try{const v=localStorage.getItem("sd-brand-content");return v?{value:v}:null;}catch(e){return null;}})();
        if (result?.value) {
          const saved = JSON.parse(result.value);
          // Deep merge: saved values win for arrays/primitives, but plain objects
          // are merged recursively so new keys in initContent are always present.
          function deepMerge(defaults, saved) {
            if (!saved || typeof saved !== "object" || Array.isArray(saved)) return saved;
            const result = { ...defaults };
            for (const key of Object.keys(defaults)) {
              if (saved[key] === undefined) continue;
              const dv = defaults[key], sv = saved[key];
              const bothPlainObj = dv && sv && typeof dv === "object" && typeof sv === "object"
                && !Array.isArray(dv) && !Array.isArray(sv);
              result[key] = bothPlainObj ? deepMerge(dv, sv) : sv;
            }
            for (const key of Object.keys(saved)) {
              if (defaults[key] === undefined) result[key] = saved[key];
            }
            return result;
          }
          const merged = deepMerge(initContent, saved);
          // Always use initContent for emoji palette — system content, not user copy
          merged.voice.emojis = initContent.voice.emojis;
          setCt(merged);
          setSaveStatus("saved");
        }
      } catch (e) {
        // No saved content yet, use defaults
      }
  });

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(()=>setCopied(null),1500); };

  const set = useCallback((path, value) => {
    setCt(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length-1; i++) {
        const k = isNaN(keys[i]) ? keys[i] : parseInt(keys[i]);
        obj = obj[k];
      }
      const lk = isNaN(keys[keys.length-1]) ? keys[keys.length-1] : parseInt(keys[keys.length-1]);
      obj[lk] = value;
      return next;
    });
    setSaveStatus("idle");
  }, []);

  const saveContent = useCallback(async (contentToSave) => {
    setSaveStatus("saving");
    try {
      await window.storage.set("sd-brand-content", JSON.stringify(contentToSave));
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("idle");
    }
  }, []);

  const resetContent = useCallback(async () => {
    try { await window.storage.delete("sd-brand-content"); } catch(e) {}
    setCt(initContent);
    setSaveStatus("idle");
  }, []);

  const c = { midnight:"#0D0D0B", red:"#C41E2D", white:"#FFFFFF", violet:"#5C1A9A", spark:"#C8EC3C", flash:"#F572A8", ash:"#C4BDB4" };
  const sf = "'Playfair Display', serif";
  const sg = "'Cabinet Grotesk', sans-serif";
  const dm = "'DM Sans', sans-serif";
  const mn = "'Space Mono', monospace";

  const comboStyles = [
    { bg:c.white, fg:c.midnight, accent:c.red, border:true },
    { bg:c.midnight, fg:c.white, accent:c.red },
    { bg:c.violet, fg:c.white, accent:c.spark },
    { bg:c.spark, fg:c.midnight, accent:c.violet },
    { bg:c.flash, fg:c.midnight, accent:c.violet },
  ];
  const sideCol = s => s==="Craft"?c.midnight:s==="Creativity"?"#5A7A0A":c.red;
  const sideBg  = s => s==="Craft"?"rgba(13,13,11,.03)":s==="Creativity"?"rgba(200,236,60,.06)":"rgba(196,30,45,.03)";

  const em = editMode;

  return (
    <div style={{ fontFamily:dm, background:c.white, color:c.midnight, minHeight:"100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=DM+Sans:wght@400;500&family=Space+Mono&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@200,300,400,500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#C4BDB4}
        .nb{background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;padding:6px 11px;border-radius:2px;color:#0D0D0B;transition:all .15s}
        .nb:hover{background:rgba(13,13,11,.06)}
        .nb.on{background:#0D0D0B;color:#FFF}
        .swatch{width:100%;padding-top:65%;border-radius:3px;position:relative;cursor:pointer;transition:transform .18s;border:1px solid rgba(13,13,11,.08)}
        .swatch:hover{transform:scale(1.03)}
        .cb{background:none;border:1px solid rgba(13,13,11,.18);color:#0D0D0B;cursor:pointer;font-family:'Space Mono',monospace;font-size:10px;padding:4px 9px;border-radius:2px;transition:all .15s;white-space:nowrap}
        .cb:hover,.cb.ok{border-color:#C41E2D;color:#C41E2D}
        .lbl{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:#C4BDB4}
        .div{height:1px;background:rgba(13,13,11,.08)}
        .bc{padding:20px 24px;border:1px solid rgba(13,13,11,.09);border-radius:3px;transition:border-color .2s}
        .bc:hover{border-color:#C41E2D}
        .tr{display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid rgba(13,13,11,.07)}
        .do-b{background:rgba(196,30,45,.04);border:1px solid rgba(196,30,45,.14);border-radius:3px;padding:18px 20px}
        .dn-b{background:rgba(13,13,11,.02);border:1px solid rgba(13,13,11,.08);border-radius:3px;padding:18px 20px}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:"1px solid rgba(13,13,11,.08)",padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:c.white,zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"baseline",gap:12 }}>
          <span style={{ fontFamily:sg,fontWeight:300,fontSize:18,letterSpacing:"-0.02em" }}>Smith<span style={{ color:c.red,fontFamily:sf,fontStyle:"italic",fontWeight:700 }}>&</span>Devil</span>
          <span style={{ fontFamily:mn,fontSize:10,color:c.ash,letterSpacing:".06em" }}>BRAND SYSTEM v10.0</span>
        </div>
        <div style={{ display:"flex",gap:2,alignItems:"center" }}>
          {sections.map(s=>(
            <button key={s} className={`nb${active===s?" on":""}`} onClick={()=>setActive(s)}>{s}</button>
          ))}
          <div style={{ width:1,height:20,background:"rgba(13,13,11,.12)",margin:"0 6px" }}/>
          <button onClick={()=>setEditMode(e=>!e)} style={{ background:em?c.spark:"none",border:`1px solid ${em?c.spark:"rgba(13,13,11,.2)"}`,cursor:"pointer",fontFamily:dm,fontSize:11,fontWeight:500,letterSpacing:".05em",textTransform:"uppercase",padding:"6px 12px",borderRadius:2,color:em?c.midnight:c.midnight,transition:"all .15s" }}>
            {em?"✓ Editing":"✏ Edit"}
          </button>
          {em && (
            <>
              <button onClick={()=>saveContent(ct)} style={{ background:saveStatus==="saved"?c.midnight:c.red,border:"none",cursor:"pointer",fontFamily:dm,fontSize:11,fontWeight:500,letterSpacing:".05em",textTransform:"uppercase",padding:"6px 14px",borderRadius:2,color:c.white,transition:"all .2s" }}>
                {saveStatus==="saving"?"Saving…":saveStatus==="saved"?"✓ Saved":"Save edits"}
              </button>
              <button onClick={resetContent} style={{ background:"none",border:"1px solid rgba(13,13,11,.15)",cursor:"pointer",fontFamily:dm,fontSize:11,fontWeight:500,letterSpacing:".05em",textTransform:"uppercase",padding:"6px 10px",borderRadius:2,color:"rgba(13,13,11,.4)" }}>
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {em && (
        <div style={{ background:c.spark,padding:"7px 28px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontFamily:mn,fontSize:10,letterSpacing:".05em" }}>EDIT MODE</span>
            <span style={{ fontSize:12,color:"rgba(13,13,11,.6)" }}>— Click any text to edit. Hit Save edits when done.</span>
          </div>
          {saveStatus==="saved" && <span style={{ fontFamily:mn,fontSize:10,color:"rgba(13,13,11,.5)",letterSpacing:".05em" }}>ALL CHANGES SAVED ✓</span>}
        </div>
      )}

      <div style={{ padding:"44px 40px",maxWidth:1000,margin:"0 auto" }}>

        {/* IDEA */}
        {active==="Idea" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>01 — The Proposition</p>
            <div style={{ marginBottom:48 }}>
              <div style={{ fontFamily:sg,fontWeight:200,fontSize:80,lineHeight:.93,letterSpacing:"-0.025em" }}>
                <E value={ct.idea.heading1} onChange={v=>set("idea.heading1",v)} editMode={em}/>
              </div>
              <div style={{ fontFamily:sf,fontStyle:"italic",fontWeight:400,fontSize:88,lineHeight:.9,letterSpacing:"-0.01em",color:c.red }}>
                <E value={ct.idea.heading2} onChange={v=>set("idea.heading2",v)} editMode={em}/>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,marginBottom:44 }}>
              <div>
                <div style={{ fontSize:18,lineHeight:1.65,marginBottom:14 }}>
                  <E value={ct.idea.body1} onChange={v=>set("idea.body1",v)} editMode={em} multiline block/>
                </div>
                <div style={{ fontSize:15,lineHeight:1.65,color:"rgba(13,13,11,.55)" }}>
                  <E value={ct.idea.body2} onChange={v=>set("idea.body2",v)} editMode={em} multiline block/>
                </div>
              </div>
              <div style={{ borderLeft:"1px solid rgba(13,13,11,.08)",paddingLeft:32 }}>
                <p className="lbl" style={{ marginBottom:16,color:"rgba(13,13,11,.3)" }}>BEHIND THE SCENES</p>
                <div style={{ marginBottom:20 }}>
                  <div className="lbl" style={{ color:c.midnight,marginBottom:6 }}>
                    <E value={ct.idea.craftLabel} onChange={v=>set("idea.craftLabel",v)} editMode={em}/>
                  </div>
                  <div style={{ fontSize:14,lineHeight:1.65,color:"rgba(13,13,11,.55)" }}>
                    <E value={ct.idea.craftDesc} onChange={v=>set("idea.craftDesc",v)} editMode={em} multiline block/>
                  </div>
                </div>
                <div className="div" style={{ marginBottom:20 }}/>
                <div>
                  <div className="lbl" style={{ color:c.red,marginBottom:6 }}>
                    <E value={ct.idea.creativityLabel} onChange={v=>set("idea.creativityLabel",v)} editMode={em}/>
                  </div>
                  <div style={{ fontSize:14,lineHeight:1.65,color:"rgba(13,13,11,.55)" }}>
                    <E value={ct.idea.creativityDesc} onChange={v=>set("idea.creativityDesc",v)} editMode={em} multiline block/>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background:c.midnight,borderRadius:4,padding:32 }}>
              <p className="lbl" style={{ color:c.ash,marginBottom:12 }}>THE ORIGIN</p>
              <div style={{ fontFamily:sg,fontWeight:200,fontSize:24,lineHeight:1.2,letterSpacing:"-0.02em",color:c.white,marginBottom:12 }}>
                <E value={ct.idea.originHeading} onChange={v=>set("idea.originHeading",v)} editMode={em} multiline block/>
              </div>
              <div style={{ fontSize:14,color:"rgba(255,255,255,.4)",lineHeight:1.65 }}>
                <E value={ct.idea.originBody} onChange={v=>set("idea.originBody",v)} editMode={em} multiline block/>
              </div>
            </div>
          </div>
        )}

        {/* LOGO */}
        {active==="Logo" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>02 — Logo</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:56,lineHeight:1,letterSpacing:"-0.025em",marginBottom:36 }}>
              The wordmark and the <span style={{ fontFamily:sf,fontStyle:"italic",color:c.red }}><E value={ct.logo.headingSerif} onChange={v=>set("logo.headingSerif",v)} editMode={em}/></span>
            </h2>
            <div style={{ fontSize:15,color:"rgba(13,13,11,.5)",marginBottom:44,lineHeight:1.65,maxWidth:560 }}>
              <E value={ct.logo.intro} onChange={v=>set("logo.intro",v)} editMode={em} multiline block/>
            </div>

            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
              <p className="lbl">WORDMARK — Full lockup</p><div className="div" style={{ flex:1 }}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:36 }}>
              <div style={{ border:"1px solid rgba(13,13,11,.09)",borderRadius:3,overflow:"hidden" }}>
                <div style={{ background:"#0D0D0B",padding:"32px 24px",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <img src="data:image/png;base64,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TxzOa4ag+YqqfdKPtHwl75TeiQUZREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQbTNlf2POCve1vynKTFGeyv7HnBXva35TlJiAiIgIiIKT90u+zeCPc1Z8qJU/VwO6XfZvBHuas+VEqfoCIiAiIgIiICuZ3Mv7oP5t/WlTNXM7mX90H82/rSC5iIiAiIgKJtsH2NuMfc0Xp41LKibbB9jbjH3NF6eNBrAREQEREBERAREQEREBERAREQEREBERAREQFIWW16bLTfQeofpJHq6An2zect8Y+LxKPVyU80tPOyeF7o5GODmuHOCsGJsRftzTKayDObmT42nEUb44VRzjr/WO1OaLwMI4igvNMI5HNjrWD65H99+E3s+Je+qxct1W6ppqje+icDjrGPsU37FWtM/vSe3nAo9zVpC2upK0DwZIzGT2g6j4/gUhLxMa243LD88cbd6aL67GOsjnHlGoWbB3fd3qZngiNq8unMMqu2qY1qiOlHfG/1jd4ojREVofOYiIgIiICIiAiIgIiICIiAiIgIiICIiAiL0aCyXau072oJ3tPM4t3W+c8F5qqppjWqdGaxh72Iq6Fmiap5REzPo85FmNvwDXyaOraqGnb96wb7v0D4VkduwbZKTR0kL6p46ZnajzDQefVadzMbFHCde5a8BsLm+L0mqiLcc6p09I1nziEYU1NUVUnJ00Esz+qNhcfgXu2/Bl8qtDJCylYemZ+h8w1KlKGKKGMRwxsjYOZrGgAeQL7WhczWufkjRdMF7NsJb0nE3ZrnlHwx95+jDLdgGij0dXVcs5+9jG439JPwLJrdardbm6UVHDCfvg3Vx8p4ruotG5ibt35qlyy/Icuy/fh7MRPPjPnOsiIiwJcREQEReViK+0Vlpt+d2/M4fW4WnwnfsHavdFFVdXRpjWWDFYqzhLVV6/VFNMcZlFF6+zFb7ok+UV1Fy1cxqKuaoc0NMr3PIHRqdVxK20xpTEPl7EVxXeqqp4TM/UREXphWm7m566eI/eQ+niV8lQ3ubnrp4j95D6eJXyQEREBERAVQO6XfYPBHums+TErfqoHdLvsHgj3TWfJiQUmREQEREBERAREQEREGbZG47qsuM0LLiuBz+Qp5wytjb/G0z/Blbp0nd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62f4lx6vUc3qOJVIsSWK8YbvVRZb9bam23GmduzU9Qwte3q8YI4gjgRxC3DrAs5cpcHZqWTvDElABVxNIpLjAA2opj+C7pbrztOoPVroQGqRFJ+e+SWL8pbru3SHv6yzP3aS607DyUnU14/i36e1PUdC4DVRggIiICIiAiIgLbllP61mEveSi9AxajVtyyn9azCXvJRegYgyZERAREQFSnuld4e+7YNw+1+jIoKmskb1l7mMaT4tx/nKusqCd0fme7Oax0503GYdieOHS6oqAfkhBWJERAREQFk+U3rqYS9+6L07FjCyfKb11MJe/dF6diDbiiIgIiICIiDXZt/3590z+mte8eTs1up6YN6A57eWJ8ZErfMFXpS1tg+ySxj7ph+bxqJUBERAREQFuYWmdbmEBERAREQFrT24qcQ7S+JZA7Xl46OTTTTd/esTdO31OvlWyxa4tvaFkW0VcXt11moKV7tevk934mhBAiIiAiIgK2fc1/t3xb72w+lVTFbPua/274t97YfSoLyoiICIiAsMz29ZDHn827j82kWZrDM9vWQx5/Nu4/NpEGppERAREQEREG0zZX9jzgr3tb8pykxRnsr+x5wV72t+U5SYgIiICIiCk/dLvs3gj3NWfKiVP1cDul32bwR7mrPlRKn6AiIgIiICIiArmdzL+6D+bf1pUzVzO5l/dB/Nv60guYiIgIiICwfP+6yWTJLGdyic5ssdmqWxubzte+MsafIXArOFE22ASNm7GWh0/e0Xp40GsBERAREQEREEzbEvsncI/wC2/Mp1syWs3Yl9k7hH/bfmU62ZICIiAiIg+ZY2SxPikaHMe0tc09IPOFptqYX09TLTyab8Tyx2h6QdCtyi06X77OV/umT5RQdJERARF6uGbNNerk2nZq2JvhTSfet/aehea64opmqrhDYwuFu4u9TYsxrVVOkQ7uDcOSXmo5efeZRRnwjzGQ/ej9JUowRRQQshhjbHGwaNa0aABfNHTQUdLHTU8YjijbutaFzKs4rFVX6terqfQmzmztjJcN0Kd9yfmq59kdkdXmIiLVWJ5eKLq2z2eWq4GU+BE09Lzzebn8ih+aR80r5ZXl73uLnOPOSecrKMy7iam8tomO+t0rdCOt54n4NB51iiseX2Pd2ulPGXBtuc5qx+YzZpn4LW6O/8U+e7wERFvqUIiICIiAu7ZbfN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NOhBHSFmdgzazOsTGx2rHuI6eJvqYjcJHxjxMcS0eZYUiCZaDahzxpC0fTqZ2Ak7s1upXa+M8nvfCu99Vhnb/KOi/syD/CoMRBMNz2m8768Oa/HEsDDr4NPQ00Wnic2Pe+FYHifH+OMTtczEOL77dI3c8VTXSPj8jCd0eQLGkQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAX60lpBaSCOYhEQelSX+80ughuVQAOYOdvAeQ6herTY5vUWglFNOPw49D8BCIsNeHtV/NTCWw2e5lhd1q/VEctZ08p3PSgzCeBpPa2ntZNp8BC7sWP7Yf4Wjq2fihrv0hEWCrLsPPUmbO3Wd2903Yq76aftEO1HjexO03n1DPxov2arnbjHDxGpry3sML/ANiIsU5XZnrn9+Dfo9o2bU8aaJ8J+1UOaPE9jkYHsrtWnp5J/wCxff0x2b/pn/hP/YiLBVl9qJ01n9+Cbtbc5hXRFU0Ub45Vf9nXdi/Dzdf/AOQ1I6ORk/wrgkxtYWeplnk/FiP6dERZ4yuzzn9+CGue0bNZ3RTRHhP3qdWbH1rb/BUlW89oa0fGV0KjMKQgintjG9RfLr8AARFlpy6xHUjr23WdXd0XYp7qY+8S8urxtfJgRG+CnB/ycevytV49bdblWgiqrqiVp9q553fNzIi2KLFuj5aYQWKznH4vdfvVVRymZ08uDpIiLKjRERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERB//Z" alt="Smith and Devil wordmark white" style={{ maxWidth:"100%",height:"auto",maxHeight:60 }}/>
                </div>
                <div style={{ padding:"12px 14px" }}>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:400,fontSize:14,marginBottom:3 }}>White on Black</p>
                  <p style={{ fontSize:12,color:"rgba(13,13,11,.45)" }}>Primary. Use on all dark backgrounds.</p>
                </div>
              </div>
              <div style={{ border:"1px solid rgba(13,13,11,.09)",borderRadius:3,overflow:"hidden" }}>
                <div style={{ background:"#0D0D0B",padding:"32px 24px",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <img src="data:image/png;base64,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" alt="Smith and Devil wordmark grey" style={{ maxWidth:"100%",height:"auto",maxHeight:60 }}/>
                </div>
                <div style={{ padding:"12px 14px" }}>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:400,fontSize:14,marginBottom:3 }}>Grey on Black</p>
                  <p style={{ fontSize:12,color:"rgba(13,13,11,.45)" }}>Secondary. Lower contrast dark background variant.</p>
                </div>
              </div>
            </div>

            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
              <p className="lbl">MONOGRAM — S&D icon</p><div className="div" style={{ flex:1 }}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:36 }}>
              <div style={{ border:"1px solid rgba(13,13,11,.09)",borderRadius:3,overflow:"hidden" }}>
                <div style={{ background:"#0D0D0B",padding:"28px 16px",display:"flex",alignItems:"center",justifyContent:"center",minHeight:120 }}>
                  <img src="data:image/png;base64,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" alt="S&D monogram circle" style={{ width:80,height:80,objectFit:"contain" }}/>
                </div>
                <div style={{ padding:"10px 12px" }}>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:400,fontSize:13,marginBottom:2 }}>Circle monogram</p>
                  <p style={{ fontSize:11,color:"rgba(13,13,11,.45)" }}>Social avatars, profile images.</p>
                </div>
              </div>
              <div style={{ border:"1px solid rgba(13,13,11,.09)",borderRadius:3,overflow:"hidden" }}>
                <div style={{ background:"#0D0D0B",padding:"28px 16px",display:"flex",alignItems:"center",justifyContent:"center",minHeight:120 }}>
                  <img src="data:image/jpeg;base64,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bERib29sAAAAAABJbnRyYm9vbAAAAAAAQmNrZ09iamMAAAABAAAAAAAAUkdCQwAAAAMAAAAAUmQgIGRvdWJAb+AAAAAAAAAAAABHcm4gZG91YkBv4AAAAAAAAAAAAEJsICBkb3ViQG/gAAAAAAAAAAAAQnJkVFVudEYjUmx0AAAAAAAAAAAAAAAAQmxkIFVudEYjUmx0AAAAAAAAAAAAAAAAUnNsdFVudEYjUHhsQGIAAAAAAAAAAAAKdmVjdG9yRGF0YWJvb2wBAAAAAFBnUHNlbnVtAAAAAFBnUHMAAAAAUGdQQwAAAABMZWZ0VW50RiNSbHQAAAAAAAAAAAAAAABUb3AgVW50RiNSbHQAAAAAAAAAAAAAAABTY2wgVW50RiNQcmNAWQAAAAAAAAAAABBjcm9wV2hlblByaW50aW5nYm9vbAAAAAAOY3JvcFJlY3RCb3R0b21sb25nAAAAAAAAAAxjcm9wUmVjdExlZnRsb25nAAAAAAAAAA1jcm9wUmVjdFJpZ2h0bG9uZwAAAAAAAAALY3JvcFJlY3RUb3Bsb25nAAAAAAA4QklNA+0AAAAAABAAkAAAAAEAAgCQAAAAAQACOEJJTQQmAAAAAAAOAAAAAAAAAAAAAD+AAAA4QklNBA0AAAAAAAQAAAAeOEJJTQQZAAAAAAAEAAAAHjhCSU0D8wAAAAAACQAAAAAAAAAAAQA4QklNJxAAAAAAAAoAAQAAAAAAAAACOEJJTQP1AAAAAABIAC9mZgABAGxmZgAGAAAAAAABAC9mZgABAKGZmgAGAAAAAAABADIAAAABAFoAAAAGAAAAAAABADUAAAABAC0AAAAGAAAAAAABOEJJTQP4AAAAAABwAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAADhCSU0ECAAAAAAAEAAAAAEAAAJAAAACQAAAAAA4QklNBB4AAAAAAAQAAAAAOEJJTQQaAAAAAANBAAAABgAAAAAAAAAAAAABAAAAAQAAAAAGADIANQA2AF8AUwBEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAEAAAABAAAAAAAA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AHAAAAAUAEEAZABvAGIAZQAgAFAAaABvAHQAbwBzAGgAbwBwACAAMgAwADIAMQAAAAEAOEJJTQQGAAAAAAAHAAQBAQABAQD/4RHlaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA3LjAtYzAwMCA3OS5kYWJhY2JiLCAyMDIxLzA0LzE0LTAwOjM5OjQ0ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpzdE1mcz0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL01hbmlmZXN0SXRlbSMiIHhtbG5zOmlsbHVzdHJhdG9yPSJodHRwOi8vbnMuYWRvYmUuY29tL2lsbHVzdHJhdG9yLzEuMC8iIHhtbG5zOnBkZj0iaHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiBkYzpmb3JtYXQ9ImltYWdlL2pwZWciIHhtcDpNZXRhZGF0YURhdGU9IjIwMjEtMTEtMjVUMTM6NDg6MTZaIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMS0xMS0yNVQxMzo0ODoxNloiIHhtcDpDcmVhdGVEYXRlPSIyMDIxLTExLTI1VDEzOjQ1OjEzWiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBJbGx1c3RyYXRvciAyNS4zIChNYWNpbnRvc2gpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmQ3MTA3NzBmLTZiZTItNGI5Zi04ZDRmLWVkM2M2M2EwMDQ0MSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo0NTA4YjljYy01MmMwLTQ3MzMtOTQ2Ny01ZmVkMjUxYmVkMDgiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0idXVpZDo1RDIwODkyNDkzQkZEQjExOTE0QTg1OTBEMzE1MDhDOCIgeG1wTU06UmVuZGl0aW9uQ2xhc3M9InByb29mOnBkZiIgaWxsdXN0cmF0b3I6U3RhcnR1cFByb2ZpbGU9IlByaW50IiBpbGx1c3RyYXRvcjpDcmVhdG9yU3ViVG9vbD0iQUlSb2JpbiIgcGRmOlByb2R1Y2VyPSJBZG9iZSBQREYgbGlicmFyeSAxNS4wMCIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIj4gPGRjOnRpdGxlPiA8cmRmOkFsdD4gPHJkZjpsaSB4bWw6bGFuZz0ieC1kZWZhdWx0Ij5TbWl0aCZhbXA7RGV2aWxfQUxMbG9nb3M8L3JkZjpsaT4gPC9yZGY6QWx0PiA8L2RjOnRpdGxlPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0idXVpZDplMDc4YWVlNy1kZDcwLTBhNDEtOGY5NS03MTBjMjY0M2VmMGEiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6ZjA5NWI5ZjAtOWRmOS00YTIzLTllMDAtZmE2NDdmZjAxNzJlIiBzdFJlZjpvcmlnaW5hbERvY3VtZW50SUQ9InV1aWQ6NUQyMDg5MjQ5M0JGREIxMTkxNEE4NTkwRDMxNTA4QzgiIHN0UmVmOnJlbmRpdGlvbkNsYXNzPSJwcm9vZjpwZGYiLz4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6MGQwODllNWYtMDBmNi00NzI2LTk5NGYtZDMxMmQ3MTJjYzg1IiBzdEV2dDp3aGVuPSIyMDIwLTA2LTE5VDE0OjIyOjI0KzAxOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBJbGx1c3RyYXRvciBDQyAyMy4wIChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDpkNzEwNzcwZi02YmUyLTRiOWYtOGQ0Zi1lZDNjNjNhMDA0NDEiIHN0RXZ0OndoZW49IjIwMjEtMTEtMjVUMTM6NDg6MTZaIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjIuNCAoTWFjaW50b3NoKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPHhtcE1NOk1hbmlmZXN0PiA8cmRmOlNlcT4gPHJkZjpsaT4gPHJkZjpEZXNjcmlwdGlvbiBzdE1mczpsaW5rRm9ybT0iRW1iZWRCeVJlZmVyZW5jZSI+IDxzdE1mczpyZWZlcmVuY2Ugc3RSZWY6ZmlsZVBhdGg9Ii92YXIvZm9sZGVycy9yNi8wMXo5bXZ4OTRrOWNtNW0xM3g5bm1tMjgwMDAwZ24vVC9UZW1wb3JhcnlJdGVtcy8oQSBEb2N1bWVudCBCZWluZyBTYXZlZCBCeSBJbGx1c3RyYXRvcikvSzRORjZxLnRpZiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6bGk+IDwvcmRmOlNlcT4gPC94bXBNTTpNYW5pZmVzdD4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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" alt="S&D square icon" style={{ width:80,height:80,objectFit:"contain",borderRadius:8 }}/>
                </div>
                <div style={{ padding:"10px 12px" }}>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:400,fontSize:13,marginBottom:2 }}>Square icon</p>
                  <p style={{ fontSize:11,color:"rgba(13,13,11,.45)" }}>App icon, larger digital uses.</p>
                </div>
              </div>
              <div style={{ border:"1px solid rgba(13,13,11,.09)",borderRadius:3,overflow:"hidden" }}>
                <div style={{ background:"#0D0D0B",padding:"28px 16px",display:"flex",alignItems:"center",justifyContent:"center",minHeight:120 }}>
                  <img src="data:image/jpeg;base64,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AAAAAAAAAABCbCAgZG91YkBv4AAAAAAAAAAAAEJyZFRVbnRGI1JsdAAAAAAAAAAAAAAAAEJsZCBVbnRGI1JsdAAAAAAAAAAAAAAAAFJzbHRVbnRGI1B4bEBSAAAAAAAAAAAACnZlY3RvckRhdGFib29sAQAAAABQZ1BzZW51bQAAAABQZ1BzAAAAAFBnUEMAAAAATGVmdFVudEYjUmx0AAAAAAAAAAAAAAAAVG9wIFVudEYjUmx0AAAAAAAAAAAAAAAAU2NsIFVudEYjUHJjQFkAAAAAAAAAAAAQY3JvcFdoZW5QcmludGluZ2Jvb2wAAAAADmNyb3BSZWN0Qm90dG9tbG9uZwAAAAAAAAAMY3JvcFJlY3RMZWZ0bG9uZwAAAAAAAAANY3JvcFJlY3RSaWdodGxvbmcAAAAAAAAAC2Nyb3BSZWN0VG9wbG9uZwAAAAAAOEJJTQPtAAAAAAAQAEgAAAABAAIASAAAAAEAAjhCSU0EJgAAAAAADgAAAAAAAAAAAAA/gAAAOEJJTQQNAAAAAAAEAAAAHjhCSU0EGQAAAAAABAAAAB44QklNA/MAAAAAAAkAAAAAAAAAAAEAOEJJTScQAAAAAAAKAAEAAAAAAAAAAjhCSU0D9QAAAAAASAAvZmYAAQBsZmYABgAAAAAAAQAvZmYAAQChmZoABgAAAAAAAQAyAAAAAQBaAAAABgAAAAAAAQA1AAAAAQAtAAAABgAAAAAAAThCSU0D+AAAAAAAcAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAA4QklNBAgAAAAAABAAAAABAAACQAAAAkAAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADSwAAAAYAAAAAAAAAAAAAACAAAAAgAAAACwAzADIAUAB4AEYAQQBWAEkAQwBPAE4AAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAACAAAAAgAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAEAAAAAAABudWxsAAAAAgAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJj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Ij8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDYuMC1jMDA2IDc5LjE2NDY0OCwgMjAyMS8wMS8xMi0xNTo1MjoyOSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1sbnM6c3RNZnM9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9NYW5pZmVzdEl0ZW0jIiB4bWxuczppbGx1c3RyYXRvcj0iaHR0cDovL25zLmFkb2JlLmNvbS9pbGx1c3RyYXRvci8xLjAvIiB4bWxuczpwZGY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGRmLzEuMy8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIxLTAzLTA5VDEwOjAzOjE2WiIgeG1wOk1vZGlmeURhdGU9IjIwMjEtMDMtMDlUMTA6MDM6MTZaIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMS0wMy0wOVQxMDowMTo1NloiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgSWxsdXN0cmF0b3IgMjUuMiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxMzVlMDM3Yi01MWEzLTRlMDUtODUxZi02ZTk5MDNjNTMwNGEiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6ZjA5NWI5ZjAtOWRmOS00YTIzLTllMDAtZmE2NDdmZjAxNzJlIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InV1aWQ6NUQyMDg5MjQ5M0JGREIxMTkxNEE4NTkwRDMxNTA4QzgiIHhtcE1NOlJlbmRpdGlvbkNsYXNzPSJwcm9vZjpwZGYiIGlsbHVzdHJhdG9yOlN0YXJ0dXBQcm9maWxlPSJQcmludCIgaWxsdXN0cmF0b3I6Q3JlYXRvclN1YlRvb2w9IkFJUm9iaW4iIHBkZjpQcm9kdWNlcj0iQWRvYmUgUERGIGxpYnJhcnkgMTUuMDAiIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSI+IDxkYzp0aXRsZT4gPHJkZjpBbHQ+IDxyZGY6bGkgeG1sOmxhbmc9IngtZGVmYXVsdCI+U21pdGgmYW1wO0RldmlsX0FMTGxvZ29zPC9yZGY6bGk+IDwvcmRmOkFsdD4gPC9kYzp0aXRsZT4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InV1aWQ6OGJkMGVkNmQtNjZlMS1lMTRhLWJkZTEtMzNhYTQyZDBjODI3IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjkxY2NlNjM3LTg5NTUtNDcyOC04OTg1LWE3YTgzNTJiNjYxOCIgc3RSZWY6b3JpZ2luYWxEb2N1bWVudElEPSJ1dWlkOjVEMjA4OTI0OTNCRkRCMTE5MTRBODU5MEQzMTUwOEM4IiBzdFJlZjpyZW5kaXRpb25DbGFzcz0icHJvb2Y6cGRmIi8+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjBkMDg5ZTVmLTAwZjYtNDcyNi05OTRmLWQzMTJkNzEyY2M4NSIgc3RFdnQ6d2hlbj0iMjAyMC0wNi0xOVQxNDoyMjoyNCswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgSWxsdXN0cmF0b3IgQ0MgMjMuMCAoTWFjaW50b3NoKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6MTM1ZTAzN2ItNTFhMy00ZTA1LTg1MWYtNmU5OTAzYzUzMDRhIiBzdEV2dDp3aGVuPSIyMDIxLTAzLTA5VDEwOjAzOjE2WiIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDIyLjIgKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDx4bXBNTTpNYW5pZmVzdD4gPHJkZjpTZXE+IDxyZGY6bGk+IDxyZGY6RGVzY3JpcHRpb24gc3RNZnM6bGlua0Zvcm09IkVtYmVkQnlSZWZlcmVuY2UiPiA8c3RNZnM6cmVmZXJlbmNlIHN0UmVmOmZpbGVQYXRoPSIvdmFyL2ZvbGRlcnMvcjYvMDF6OW12eDk0azljbTVtMTN4OW5tbTI4MDAwMGduL1QvVGVtcG9yYXJ5SXRlbXMvKEEgRG9jdW1lbnQgQmVpbmcgU2F2ZWQgQnkgSWxsdXN0cmF0b3IpL0s0TkY2cS50aWYiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOmxpPiA8L3JkZjpTZXE+IDwveG1wTU06TWFuaWZlc3Q+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw/eHBhY2tldCBlbmQ9InciPz7/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" alt="favicon ampersand" style={{ width:48,height:48,objectFit:"contain",imageRendering:"pixelated" }}/>
                </div>
                <div style={{ padding:"10px 12px" }}>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:400,fontSize:13,marginBottom:2 }}>Favicon — &</p>
                  <p style={{ fontSize:11,color:"rgba(13,13,11,.45)" }}>32px browser favicon. The & alone.</p>
                </div>
              </div>
              <div style={{ border:"1px solid rgba(13,13,11,.09)",borderRadius:3,overflow:"hidden" }}>
                <div style={{ background:"#F5F3EF",padding:"28px 16px",display:"flex",alignItems:"center",justifyContent:"center",minHeight:120 }}>
                  <img src="data:image/png;base64,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" alt="Smith and Devil wordmark black" style={{ maxWidth:"100%",height:"auto",maxHeight:40 }}/>
                </div>
                <div style={{ padding:"10px 12px" }}>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:400,fontSize:13,marginBottom:2 }}>Black on Light</p>
                  <p style={{ fontSize:11,color:"rgba(13,13,11,.45)" }}>Print & light background use.</p>
                </div>
              </div>
            </div>

            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
              <p className="lbl">RULES</p><div className="div" style={{ flex:1 }}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              {ct.logo.rules.map((r,i)=>(
                <div key={i} style={{ padding:"12px 14px",borderRadius:3,border:`1px solid ${r.do?"rgba(196,30,45,.15)":"rgba(13,13,11,.09)"}`,background:r.do?"rgba(196,30,45,.03)":"transparent",display:"flex",gap:10,alignItems:"flex-start" }}>
                  <span style={{ fontFamily:mn,fontSize:11,color:r.do?c.red:c.ash,flexShrink:0,marginTop:1 }}>{r.do?"✓":"✗"}</span>
                  <div style={{ flex:1,fontSize:13,lineHeight:1.55,color:r.do?c.midnight:"rgba(13,13,11,.45)" }}>
                    <E value={r.text} onChange={v=>set(`logo.rules.${i}.text`,v)} editMode={em} multiline block/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COLOUR */}
        {active==="Colour" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>03 — Colour</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:56,lineHeight:1,letterSpacing:"-0.025em",marginBottom:14 }}>
              Craft vs <span style={{ fontFamily:sf,fontStyle:"italic",color:c.red }}><E value={ct.colour.headingSerifInline} onChange={v=>set("colour.headingSerifInline",v)} editMode={em}/></span>.
            </h2>
            <div style={{ fontSize:15,color:"rgba(13,13,11,.5)",marginBottom:40 }}>
              <E value={ct.colour.intro} onChange={v=>set("colour.intro",v)} editMode={em}/>
            </div>

            {[["CRAFT 🔨","craft"],["CREATIVITY ✨","creativity"]].map(([lbl,key])=>(
              <div key={key} style={{ marginBottom:36 }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
                  <p className="lbl">{lbl}</p><div className="div" style={{ flex:1 }}/>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
                  {ct.colour.colors[key].map((col,i)=>(
                    <div key={i}>
                      <div className="swatch" style={{ background:col.hex,borderColor:col.hex==="#FFFFFF"?"rgba(13,13,11,.14)":"transparent" }} onClick={()=>copy(col.hex,col.hex)}>
                        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"flex-end",padding:10 }}>
                          {copied===col.hex && <span style={{ fontFamily:mn,fontSize:9,background:"rgba(13,13,11,.75)",color:"#fff",padding:"2px 6px",borderRadius:2 }}>Copied</span>}
                        </div>
                      </div>
                      <div style={{ marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                        <div style={{ flex:1,marginRight:8 }}>
                          <div style={{ fontFamily:sg,fontWeight:400,fontSize:15,marginBottom:2 }}>
                            <E value={col.name} onChange={v=>set(`colour.colors.${key}.${i}.name`,v)} editMode={em}/>
                          </div>
                          <p style={{ fontFamily:mn,fontSize:10,color:c.ash,marginBottom:6 }}>{col.hex}</p>
                        </div>
                        <button className={`cb${copied===col.hex?" ok":""}`} onClick={()=>copy(col.hex,col.hex)}>{copied===col.hex?"✓":"Copy"}</button>
                      </div>
                      <div style={{ fontSize:12,color:"rgba(13,13,11,.45)",lineHeight:1.55 }}>
                        <E value={col.use} onChange={v=>set(`colour.colors.${key}.${i}.use`,v)} editMode={em} multiline block/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
              <p className="lbl">IN ACTION</p><div className="div" style={{ flex:1 }}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6 }}>
              {ct.colour.combos.map((combo,i)=>{
                const cs = comboStyles[i];
                return (
                  <div key={i} style={{ background:cs.bg,padding:"18px 12px",borderRadius:3,border:`1px solid ${cs.border?"rgba(13,13,11,.1)":"transparent"}` }}>
                    <p style={{ fontFamily:mn,fontSize:9,color:cs.accent,letterSpacing:".08em",marginBottom:10,textTransform:"uppercase" }}>{combo.label}</p>
                    <p style={{ fontFamily:sg,fontWeight:200,fontSize:17,color:cs.fg,lineHeight:1.05,marginBottom:5,letterSpacing:"-0.015em" }}>Smith<span style={{ color:cs.accent,fontFamily:sf,fontStyle:"italic",fontWeight:700 }}>&</span>Devil</p>
                    <div style={{ fontSize:10,color:cs.fg,opacity:.5,lineHeight:1.4 }}>
                      <E value={combo.note} onChange={v=>set(`colour.combos.${i}.note`,v)} editMode={em}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TYPE */}
        {active==="Type" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>04 — Typography</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:56,lineHeight:1,letterSpacing:"-0.025em",marginBottom:14 }}>
              One <span style={{ fontFamily:sf,fontStyle:"italic",color:c.red }}><E value={ct.type.headingSerifInline} onChange={v=>set("type.headingSerifInline",v)} editMode={em}/></span> word.
            </h2>
            <div style={{ fontSize:15,color:"rgba(13,13,11,.5)",marginBottom:36 }}>
              <E value={ct.type.intro} onChange={v=>set("type.intro",v)} editMode={em}/>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:40 }}>
              {[
                { label:"DISPLAY", fam:sg, fw:200, fs:32, ls:"-0.02em", fi:false, name:"Cabinet Grotesk", wt:"ExtraLight / Light (200–300)", use:"All display & hero. Thin weight at scale — size is the statement, not weight.", hot:false },
                { label:"ACCENT — THE SWITCH", fam:sf, fw:400, fs:36, ls:"-0.01em", fi:true, name:"Playfair Display", wt:"Italic / Bold (400i–700i)", use:"Key phrases only. Didone switch-up — echoes the logo's high-contrast thick/thin. Makes one moment land harder.", hot:true },
                { label:"BODY", fam:dm, fw:400, fs:24, ls:"0", fi:false, name:"DM Sans", wt:"Regular / Medium (400–500)", use:"Body copy, UI, navigation. Legible, warm, unfussy.", hot:false },
                { label:"DETAIL", fam:mn, fw:400, fs:16, ls:"0", fi:false, name:"Space Mono", wt:"Regular (400)", use:"Metadata only. Reference numbers, small labels. Rare.", hot:false },
              ].map((t,i)=>(
                <div key={i} style={{ border:`1px solid ${t.hot?"rgba(196,30,45,.2)":"rgba(13,13,11,.09)"}`,borderRadius:3,padding:20,background:t.hot?"rgba(196,30,45,.03)":"transparent" }}>
                  <p className="lbl" style={{ marginBottom:12,color:t.hot?c.red:c.ash }}>{t.label}</p>
                  <p style={{ fontFamily:t.fam,fontWeight:t.fw,fontStyle:t.fi?"italic":"normal",fontSize:t.fs,lineHeight:1.05,letterSpacing:t.ls,marginBottom:14 }}>{t.name}</p>
                  <p style={{ fontFamily:mn,fontSize:10,color:t.hot?c.red:c.ash,letterSpacing:".06em",marginBottom:8 }}>{t.wt}</p>
                  <p style={{ fontSize:12,color:"rgba(13,13,11,.5)",lineHeight:1.55 }}>{t.use}</p>
                </div>
              ))}
            </div>

            <p className="lbl" style={{ marginBottom:14 }}>MISCHIEF WITH TYPE</p>
            <div style={{ background:c.midnight, borderRadius:3, padding:"20px 24px", marginBottom:20 }}>
              <p style={{ fontFamily:sg, fontWeight:200, fontSize:20, lineHeight:1.4, letterSpacing:"-0.02em", color:c.white }}>
                <E value={ct.type.mischiefIntro} onChange={v=>set("type.mischiefIntro",v)} editMode={em} multiline block/>
              </p>
            </div>

            <div style={{ display:"grid", gap:8, marginBottom:40 }}>
              {ct.type.mischiefMoves.map((mv,i) => {
                const r = mv.render;
                return (
                  <div key={i} style={{ border:"1px solid rgba(13,13,11,.09)", borderRadius:3, padding:"18px 24px", display:"grid", gridTemplateColumns:"1fr 220px", gap:24, alignItems:"center" }}>
                    <div>
                      <p style={{ fontFamily:mn, fontSize:9, color:c.ash, letterSpacing:".07em", marginBottom:12 }}>{mv.label}</p>
                      {r==="serif-buried" && (
                        <p style={{ fontFamily:sg, fontWeight:300, fontSize:26, lineHeight:1.1, letterSpacing:"-0.015em" }}>
                          <E value={mv.before} onChange={v=>set(`type.mischiefMoves.${i}.before`,v)} editMode={em}/>
                          <span style={{ fontFamily:sf, fontStyle:"italic", fontWeight:400, fontSize:29, color:c.red }}><E value={mv.serif} onChange={v=>set(`type.mischiefMoves.${i}.serif`,v)} editMode={em}/></span>
                          <E value={mv.after} onChange={v=>set(`type.mischiefMoves.${i}.after`,v)} editMode={em}/>
                        </p>
                      )}
                      {r==="scale-clash" && (
                        <div>
                          <p style={{ fontFamily:sf, fontStyle:"italic", fontWeight:400, fontSize:52, lineHeight:.9, letterSpacing:"-0.02em", color:c.red, marginBottom:6 }}><E value={mv.big} onChange={v=>set(`type.mischiefMoves.${i}.big`,v)} editMode={em}/></p>
                          <p style={{ fontFamily:sg, fontWeight:300, fontSize:12, color:"rgba(13,13,11,.4)", lineHeight:1.5 }}><E value={mv.small} onChange={v=>set(`type.mischiefMoves.${i}.small`,v)} editMode={em} multiline/></p>
                        </div>
                      )}
                      {r==="mono-interrupt" && (
                        <div>
                          <p style={{ fontFamily:sg, fontWeight:200, fontSize:24, lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:4 }}><E value={mv.before} onChange={v=>set(`type.mischiefMoves.${i}.before`,v)} editMode={em}/></p>
                          <p style={{ fontFamily:mn, fontSize:13, color:c.red, letterSpacing:".01em" }}><E value={mv.mono} onChange={v=>set(`type.mischiefMoves.${i}.mono`,v)} editMode={em}/></p>
                        </div>
                      )}
                      {r==="serif-mid" && (
                        <p style={{ fontFamily:sg, fontWeight:300, fontSize:26, lineHeight:1.1, letterSpacing:"-0.015em" }}>
                          <E value={mv.before} onChange={v=>set(`type.mischiefMoves.${i}.before`,v)} editMode={em}/>
                          <span style={{ fontFamily:sf, fontStyle:"italic", fontWeight:400, fontSize:29, color:c.red }}><E value={mv.serif} onChange={v=>set(`type.mischiefMoves.${i}.serif`,v)} editMode={em}/></span>
                          <E value={mv.after} onChange={v=>set(`type.mischiefMoves.${i}.after`,v)} editMode={em}/>
                        </p>
                      )}
                      {r==="weight-only" && (
                        <p style={{ fontFamily:sg, lineHeight:1.05, letterSpacing:"-0.02em" }}>
                          <span style={{ fontWeight:200, fontSize:24, color:"rgba(13,13,11,.4)" }}><E value={mv.light} onChange={v=>set(`type.mischiefMoves.${i}.light`,v)} editMode={em}/>{" "}</span>
                          <span style={{ fontWeight:700, fontSize:28, color:c.midnight }}><E value={mv.bold} onChange={v=>set(`type.mischiefMoves.${i}.bold`,v)} editMode={em}/></span>
                        </p>
                      )}
                      {r==="all-in" && (
                        <p style={{ fontFamily:sf, fontStyle:"italic", fontWeight:400, fontSize:48, lineHeight:.9, letterSpacing:"-0.01em", color:c.red }}><E value={mv.serif} onChange={v=>set(`type.mischiefMoves.${i}.serif`,v)} editMode={em}/></p>
                      )}
                    </div>
                    <p style={{ fontSize:12, color:"rgba(13,13,11,.4)", lineHeight:1.65, fontStyle:"italic", borderLeft:"1px solid rgba(13,13,11,.08)", paddingLeft:20 }}>{mv.note}</p>
                  </div>
                );
              })}
            </div>

                        <p className="lbl" style={{ marginBottom:12 }}>TYPE SCALE</p>
            {ct.type.scale.map((s,i)=>{
              const isMono = s.weight==="400m";
              const isAccent = s.weight==="400i";
              const fam = isAccent?sf:isMono?mn:sg;
              const fw = isAccent||isMono?400:parseInt(s.weight);
              return (
                <div key={i} style={{ display:"flex",alignItems:"baseline",gap:16,padding:"10px 0",borderBottom:"1px solid rgba(13,13,11,.07)" }}>
                  <span style={{ fontFamily:mn,fontSize:9,color:c.ash,width:48,flexShrink:0 }}>{s.label}</span>
                  <span style={{ fontFamily:fam,fontWeight:fw,fontStyle:isAccent?"italic":"normal",fontSize:s.size,lineHeight:s.label==="Hero"?.92:1,letterSpacing:["Hero","H1","H2","Accent"].includes(s.label)?"-0.02em":"0",flex:1,color:isAccent?c.red:c.midnight }}>
                    <E value={s.sample} onChange={v=>set(`type.scale.${i}.sample`,v)} editMode={em}/>
                  </span>
                  <span style={{ fontFamily:mn,fontSize:9,color:c.ash,flexShrink:0 }}>{s.size}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* MARKS */}
        {active==="Marks" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>05 — Brand Marks</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:56,lineHeight:1,letterSpacing:"-0.025em",marginBottom:14 }}>
              The <span style={{ fontFamily:sf,fontStyle:"italic",color:c.red }}><E value={ct.marks.headingSerif} onChange={v=>set("marks.headingSerif",v)} editMode={em}/></span> mark, at the right moment.
            </h2>
            <div style={{ fontSize:15,color:"rgba(13,13,11,.5)",marginBottom:40,lineHeight:1.65 }}>
              <E value={ct.marks.intro} onChange={v=>set("marks.intro",v)} editMode={em} multiline block/>
            </div>

            <p className="lbl" style={{ marginBottom:12 }}>THE CIRCLE — 6 variants</p>
            <p style={{ fontSize:13,color:"rgba(13,13,11,.45)",marginBottom:20,lineHeight:1.6 }}>Each feels like a different moment — use any one of them. The variety is intentional. Never use the same variant twice on the same piece.</p>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12 }}>
              {[0,1,2,3,4,5].map(v=>{
                const configs = [
                  { bg:c.white,text:c.midnight,markColor:c.red,border:true,label:"Fast loop — gap right" },
                  { bg:c.midnight,text:c.white,markColor:c.spark,border:false,label:"Rubber band — super flat" },
                  { bg:c.violet,text:c.white,markColor:c.flash,border:false,label:"Emphatic thin — circled twice" },
                  { bg:c.white,text:c.midnight,markColor:c.violet,border:true,label:"Tilted — 20° slant" },
                  { bg:c.midnight,text:c.white,markColor:c.spark,border:false,label:"Flick exit — pen tail" },
                  { bg:c.flash,text:c.midnight,markColor:c.midnight,border:false,label:"Heavy marker — thick single" },
                ];
                const ex = configs[v];
                const phrase = ct.marks.circleExamples[v % ct.marks.circleExamples.length].phrase;
                const pw = phrase.length * 13 + 28;
                return (
                  <div key={v} style={{ border:`1px solid ${ex.border?"rgba(13,13,11,.09)":"transparent"}`,borderRadius:3,background:ex.bg,padding:"22px 20px" }}>
                    <p style={{ fontFamily:mn,fontSize:9,color:ex.markColor,letterSpacing:".08em",marginBottom:14,textTransform:"uppercase" }}>{String(v+1).padStart(2,"0")} — {ex.label}</p>
                    <p style={{ fontFamily:sg,fontWeight:200,fontSize:22,color:ex.text,lineHeight:1.5,letterSpacing:"-0.02em" }}>
                      We are{" "}
                      <span style={{ position:"relative",display:"inline-block" }}>
                        <span style={{ position:"relative",zIndex:1 }}>{phrase}</span>
                        <SVGCircle color={ex.markColor} variant={v}/>
                      </span>
                      {" "}about this.
                    </p>
                  </div>
                );
              })}
            </div>
            <div style={{ background:"rgba(13,13,11,.03)",border:"1px solid rgba(13,13,11,.08)",borderRadius:3,padding:"14px 18px",marginBottom:32 }}>
              <p style={{ fontSize:13,color:"rgba(13,13,11,.55)",lineHeight:1.6 }}>All six SVG variants are in the code — reference by <span style={{ fontFamily:mn,fontSize:12 }}>variant={"{0–5}"}</span>. Use on the web directly or trace onto physical materials for print.</p>
            </div>

            <p className="lbl" style={{ marginBottom:12 }}>THE UNDERLINE</p>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:32 }}>
              {[
                { bg:c.white,text:c.midnight,markColor:c.red,border:true },
                { bg:c.midnight,text:c.white,markColor:c.spark },
              ].map((ex,i)=>{
                const ue = ct.marks.underlineExamples[i];
                return (
                  <div key={i} style={{ border:`1px solid ${ex.border?"rgba(13,13,11,.09)":"transparent"}`,borderRadius:3,background:ex.bg,padding:26 }}>
                    <div style={{ fontFamily:mn,fontSize:9,color:ex.markColor,letterSpacing:".08em",marginBottom:16,textTransform:"uppercase" }}>
                      <E value={ue.label} onChange={v=>set(`marks.underlineExamples.${i}.label`,v)} editMode={em}/>
                    </div>
                    <p style={{ fontFamily:sg,fontWeight:200,fontSize:28,color:ex.text,lineHeight:1.05,letterSpacing:"-0.02em" }}>{ue.line1}</p>
                    <div style={{ display:"inline-block" }}>
                      <p style={{ fontFamily:sf,fontStyle:"italic",fontWeight:400,fontSize:32,color:ex.markColor,lineHeight:1 }}>{ue.line2}</p>
                      <SVGUnderline color={ex.markColor} width={ue.line2.length*15}/>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="lbl" style={{ marginBottom:12 }}>RULES</p>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              {ct.marks.rules.map((rule,i)=>(
                <div key={i} style={{ fontSize:13,color:"rgba(13,13,11,.6)",lineHeight:1.6,paddingLeft:12,borderLeft:`2px solid ${i%2===0?c.red:c.ash}` }}>
                  <E value={rule} onChange={v=>set(`marks.rules.${i}`,v)} editMode={em} multiline block/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VOICE */}
        {active==="Voice" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>06 — Voice & Tone</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:56,lineHeight:1,letterSpacing:"-0.025em",marginBottom:14 }}>
              Warm. Specific. A little <span style={{ fontFamily:sf,fontStyle:"italic",color:c.red }}><E value={ct.voice.headingSans} onChange={v=>set("voice.headingSans",v)} editMode={em}/></span>.
            </h2>
            <div style={{ fontSize:15,color:"rgba(13,13,11,.5)",marginBottom:36 }}>
              <E value={ct.voice.intro} onChange={v=>set("voice.intro",v)} editMode={em}/>
            </div>
            <div style={{ display:"grid",gap:10,marginBottom:40 }}>
              {ct.voice.examples.map((v,i)=>(
                <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                  <div className="do-b">
                    <p style={{ fontFamily:mn,fontSize:9,color:c.red,letterSpacing:".08em",marginBottom:8 }}>DO ✓</p>
                    <div style={{ fontFamily:sg,fontWeight:400,fontSize:17,lineHeight:1.2,marginBottom:6 }}>
                      <E value={v.do} onChange={val=>set(`voice.examples.${i}.do`,val)} editMode={em} block/>
                    </div>
                    <div style={{ fontSize:13,color:"rgba(13,13,11,.55)",lineHeight:1.55 }}>
                      <E value={v.doSub} onChange={val=>set(`voice.examples.${i}.doSub`,val)} editMode={em} multiline block/>
                    </div>
                  </div>
                  <div className="dn-b">
                    <p style={{ fontFamily:mn,fontSize:9,color:c.ash,letterSpacing:".08em",marginBottom:8 }}>DON'T ✗</p>
                    <div style={{ fontSize:14,lineHeight:1.4,marginBottom:6,color:"rgba(13,13,11,.35)",textDecoration:"line-through" }}>
                      <E value={v.dont} onChange={val=>set(`voice.examples.${i}.dont`,val)} editMode={em} block/>
                    </div>
                    <div style={{ fontSize:12,color:"rgba(13,13,11,.4)",lineHeight:1.55 }}>
                      <E value={v.dontSub} onChange={val=>set(`voice.examples.${i}.dontSub`,val)} editMode={em} multiline block/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {[
              ["CRAFT 🔨","craft","rgba(13,13,11,.03)","rgba(13,13,11,.09)"],
              ["CREATIVITY ✨","creativity","rgba(200,236,60,.07)","rgba(200,236,60,.22)"],
              ["DISRUPT 💣","disrupt","rgba(196,30,45,.03)","rgba(196,30,45,.14)"],
              ["RANDOM / WILD CARD 🐈","random","rgba(92,26,154,.04)","rgba(92,26,154,.15)"],
            ].map(([label,key,bg,border])=>(
              <div key={key} style={{ marginBottom:16 }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
                  <p className="lbl">{label}</p><div className="div" style={{ flex:1 }}/>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
                  {ct.voice.emojis[key].map((e,i)=>(
                    <div key={i} style={{ background:bg,border:`1px solid ${border}`,borderRadius:3,padding:"11px 13px",display:"flex",gap:10,alignItems:"flex-start" }}>
                      <span style={{ fontSize:19 }}>{e.emoji}</span>
                      <div style={{ fontSize:12,color:"rgba(13,13,11,.55)",lineHeight:1.55 }}>
                        <E value={e.use} onChange={v=>set(`voice.emojis.${key}.${i}.use`,v)} editMode={em} block/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ background:c.midnight,borderRadius:3,padding:"16px 20px",marginTop:8 }}>
              <p style={{ fontFamily:mn,fontSize:9,color:c.ash,letterSpacing:".08em",marginBottom:10 }}>THE FONTS.XYZ PRINCIPLE</p>
              <p style={{ fontFamily:sg,fontWeight:200,fontSize:18,color:c.white,lineHeight:1.4,letterSpacing:"-0.015em" }}>
                Emojis are punctuation with <span style={{ fontFamily:sf,fontStyle:"italic",color:c.spark }}>personality.</span>
              </p>
              <p style={{ fontSize:13,color:"rgba(255,255,255,.4)",marginTop:8,lineHeight:1.65 }}>Not decoration at the end of a sentence. Not signposts. A 🐈 after a sharp observation is funnier and more memorable than a 👏. The unexpected choice is always better than the obvious one.</p>
            </div>
          </div>
        )}

        {/* BEHAVIOUR */}
        {active==="Behaviour" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>07 — Brand Behaviours</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:52,lineHeight:1,letterSpacing:"-0.025em",marginBottom:4 }}>
              <E value={ct.behaviour.headingSans} onChange={v=>set("behaviour.headingSans",v)} editMode={em}/>
            </h2>
            <h2 style={{ fontFamily:sf,fontStyle:"italic",fontWeight:400,fontSize:58,lineHeight:1,letterSpacing:"-0.01em",color:c.red,marginBottom:40 }}>
              <E value={ct.behaviour.headingSerif} onChange={v=>set("behaviour.headingSerif",v)} editMode={em}/>
            </h2>
            <div style={{ display:"grid",gap:8 }}>
              {ct.behaviour.items.map((b,i)=>(
                <div key={i} className="bc" style={{ background:sideBg(b.side) }}>
                  <div style={{ display:"flex",gap:18 }}>
                    <div style={{ flexShrink:0,paddingTop:2 }}>
                      <span style={{ fontFamily:mn,fontSize:10,color:c.ash,display:"block",marginBottom:3 }}>0{i+1}</span>
                      <span style={{ fontFamily:mn,fontSize:8,color:sideCol(b.side),letterSpacing:".06em",textTransform:"uppercase" }}>{b.side}</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:sg,fontWeight:400,fontSize:17,marginBottom:4 }}>
                        <E value={b.name} onChange={v=>set(`behaviour.items.${i}.name`,v)} editMode={em} block/>
                      </div>
                      <div style={{ fontSize:13,color:"rgba(13,13,11,.55)",lineHeight:1.65 }}>
                        <E value={b.desc} onChange={v=>set(`behaviour.items.${i}.desc`,v)} editMode={em} multiline block/>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SOCIAL */}
        {active==="Social" && (() => {
          const sf2 = "'Playfair Display', serif";
          const sg2 = "'Cabinet Grotesk', sans-serif";
          const mn2 = "'Space Mono', monospace";

          // Giant circle SVG for use inside cards
          const BigCircle = ({ color, size=220 }) => (
            <svg viewBox="0 0 110 50" style={{ position:"absolute", top:"-30%", left:"-15%", width:"130%", height:"130%", pointerEvents:"none", overflow:"visible", opacity:.9 }}>
              <path d="M 100,20 C 108,8 88,2 55,2 C 22,2 4,10 4,25 C 4,40 22,48 55,48 C 82,48 100,42 104,32"
                fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          );

          const BigUnderline = ({ color }) => (
            <svg viewBox="0 0 120 12" style={{ display:"block", width:"100%", height:14, marginTop:-4, overflow:"visible" }}>
              <path d="M3,8 C24,4 66,11 117,7" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"/>
            </svg>
          );

          // CARD TYPES — each demonstrates a different serif rule
          const cards = [
            // --- IG RESULTS ---
            // Classic: sans setup → serif payoff
            {
              id:"r1", platform:"ig", tag:"RESULTS 🏹",
              render: () => (
                <div style={{ background:"#0D0D0B", aspectRatio:"1", borderRadius:3, padding:"12px 14px", display:"flex", flexDirection:"column", justifyContent:"flex-end", overflow:"hidden" }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:"rgba(200,236,60,.4)", letterSpacing:".08em", marginBottom:10 }}>CLASSIC — serif closes</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:22, lineHeight:1.05, letterSpacing:"-0.02em", color:"rgba(255,255,255,.5)" }}>Brief in February.</p>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontWeight:400, fontSize:26, lineHeight:1, color:"#C8EC3C" }}>Live in April. 🏹</p>
                </div>
              )
            },
            // All serif: no sans at all
            {
              id:"r2", platform:"ig", tag:"RESULTS 🏹",
              render: () => (
                <div style={{ background:"#FFFFFF", aspectRatio:"1", borderRadius:3, border:"1px solid rgba(13,13,11,.09)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:c.ash, letterSpacing:".08em", marginBottom:12, position:"relative", zIndex:1 }}>ALL SERIF — no setup needed</p>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontWeight:400, fontSize:48, lineHeight:.95, letterSpacing:"-0.01em", color:"#C41E2D", position:"relative", zIndex:1 }}>Delivered.</p>
                  <BigCircle color="#C41E2D"/>
                </div>
              )
            },
            // Emoji hero — no serif at all
            {
              id:"r3", platform:"ig", tag:"RESULTS 🏹",
              render: () => (
                <div style={{ background:"#C8EC3C", aspectRatio:"1", borderRadius:3, padding:14, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:"rgba(13,13,11,.4)", letterSpacing:".08em" }}>NO SERIF — devil takes a day off</p>
                  <div>
                    <span style={{ fontSize:48, display:"block", marginBottom:8 }}>🧲</span>
                    <p style={{ fontFamily:sg2, fontWeight:200, fontSize:17, letterSpacing:"-0.02em", color:"#0D0D0B", lineHeight:1.15 }}>Zero ad spend.<br/>Just good work.</p>
                  </div>
                </div>
              )
            },
            // Serif first (reversed) — serif is the hook
            {
              id:"r4", platform:"ig", tag:"RESULTS 🏹",
              render: () => (
                <div style={{ background:"#5C1A9A", aspectRatio:"1", borderRadius:3, padding:"12px 14px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:"rgba(245,114,168,.5)", letterSpacing:".08em", marginBottom:10 }}>SERIF FIRST — the hook</p>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontWeight:400, fontSize:26, color:"#F572A8", lineHeight:1, marginBottom:4 }}>Brief to launch.</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:48, lineHeight:.88, letterSpacing:"-0.04em", color:"#FFFFFF" }}>3 weeks.</p>
                  <p style={{ fontSize:22, marginTop:6 }}>📐</p>
                </div>
              )
            },
            // Stacked — alternating, no rule
            {
              id:"r5", platform:"ig", tag:"RESULTS 🏹",
              render: () => (
                <div style={{ background:"#0D0D0B", aspectRatio:"1", borderRadius:3, padding:"12px 14px", display:"flex", flexDirection:"column", justifyContent:"flex-end", overflow:"hidden" }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:"rgba(200,236,60,.4)", letterSpacing:".08em", marginBottom:10 }}>STACKED — alternating weight</p>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:20, color:"#C8EC3C", lineHeight:1, margin:0 }}>Repositioned.</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:18, color:"rgba(255,255,255,.5)", lineHeight:1.1, margin:0 }}>Relaunched.</p>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:20, color:"#C8EC3C", lineHeight:1, margin:0 }}>Sold. 📐</p>
                </div>
              )
            },
            // Fill — type dominates, no formula
            {
              id:"r6", platform:"ig", tag:"RESULTS 🏹",
              render: () => (
                <div style={{ background:"#F572A8", aspectRatio:"1", borderRadius:3, overflow:"hidden", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <p style={{ fontFamily:mn2, fontSize:7, color:"rgba(13,13,11,.35)", letterSpacing:".08em", position:"absolute", top:10, left:12 }}>FILL — type owns the frame</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:70, lineHeight:.85, letterSpacing:"-0.05em", color:"#0D0D0B", textAlign:"center", padding:"0 8px" }}>Done. 🔨</p>
                </div>
              )
            },
            // --- IG MESSAGES ---
            // Flipped: serif on the SERIOUS word — most devilish
            {
              id:"m1", platform:"ig", tag:"MESSAGES 🦊",
              render: () => (
                <div style={{ background:"#FFFFFF", aspectRatio:"1", borderRadius:3, border:"1px solid rgba(13,13,11,.09)", padding:14, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:c.ash, letterSpacing:".08em", marginBottom:10 }}>FLIPPED — serif on the wrong word</p>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontWeight:400, fontSize:34, lineHeight:1, color:"#C41E2D" }}>Seriously</p>
                  <div>
                    <p style={{ fontFamily:sg2, fontWeight:200, fontSize:28, lineHeight:1, letterSpacing:"-0.025em", color:"#0D0D0B" }}>Playful. ✨</p>
                    <BigUnderline color="#C41E2D"/>
                  </div>
                </div>
              )
            },
            // Emoji hero — sans label only, no serif
            {
              id:"m2", platform:"ig", tag:"MESSAGES 🦊",
              render: () => (
                <div style={{ background:"#0D0D0B", aspectRatio:"1", borderRadius:3, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:14 }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:"rgba(200,236,60,.4)", letterSpacing:".08em", marginBottom:14 }}>EMOJI AS HERO</p>
                  <span style={{ fontSize:58, display:"block", textAlign:"center", marginBottom:10 }}>🦊</span>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:12, color:"rgba(255,255,255,.5)", textAlign:"center", lineHeight:1.5, letterSpacing:"-0.01em" }}>The devil's in the detail.<br/>We put him there.</p>
                </div>
              )
            },
            // Buried: serif on an unexpected mid-word
            {
              id:"m3", platform:"ig", tag:"MESSAGES 🦊",
              render: () => (
                <div style={{ background:"#5C1A9A", aspectRatio:"1", borderRadius:3, padding:14, display:"flex", flexDirection:"column", justifyContent:"flex-end", overflow:"hidden" }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:"rgba(245,114,168,.5)", letterSpacing:".08em", marginBottom:10 }}>BURIED — serif hides mid-sentence</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:20, lineHeight:1.15, letterSpacing:"-0.02em", color:"#FFFFFF" }}>
                    Most briefs <span style={{ fontFamily:sf2, fontStyle:"italic", color:"#F572A8" }}>aren't</span> briefs. 🪤
                  </p>
                </div>
              )
            },
            // Classic but with mark
            {
              id:"m4", platform:"ig", tag:"MESSAGES 🦊",
              render: () => (
                <div style={{ background:"#C8EC3C", aspectRatio:"1", borderRadius:3, overflow:"hidden", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <p style={{ fontFamily:mn2, fontSize:7, color:"rgba(13,13,11,.35)", letterSpacing:".08em", position:"absolute", top:10, left:12 }}>MARK DOMINANT</p>
                  <div style={{ textAlign:"center", padding:"0 12px", position:"relative" }}>
                    <p style={{ fontFamily:sg2, fontWeight:200, fontSize:16, color:"rgba(13,13,11,.5)", letterSpacing:"-0.015em", position:"relative", zIndex:1 }}>Playing hard to</p>
                    <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:20, color:"#5C1A9A", lineHeight:1, position:"relative", zIndex:1 }}>work harder. 🥊</p>
                    <BigCircle color="#5C1A9A"/>
                  </div>
                </div>
              )
            },
            // All serif stacked
            {
              id:"m5", platform:"ig", tag:"MESSAGES 🦊",
              render: () => (
                <div style={{ background:"#0D0D0B", aspectRatio:"1", borderRadius:3, padding:"12px 14px", display:"flex", flexDirection:"column", justifyContent:"center", gap:0 }}>
                  <p style={{ fontFamily:mn2, fontSize:8, color:"rgba(200,236,60,.4)", letterSpacing:".08em", marginBottom:10 }}>ALTERNATING — no dominant voice</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:18, lineHeight:1.05, letterSpacing:"-0.02em", color:"rgba(255,255,255,.5)", margin:0 }}>Brief in.</p>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:20, color:"#C8EC3C", lineHeight:1.05, margin:0 }}>Chaos out. 🌀</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:18, lineHeight:1.05, letterSpacing:"-0.02em", color:"rgba(255,255,255,.5)", margin:0 }}>Magic happens.</p>
                </div>
              )
            },
            // Fill with buried serif
            {
              id:"m6", platform:"ig", tag:"MESSAGES 🦊",
              render: () => (
                <div style={{ background:"#F572A8", aspectRatio:"1", borderRadius:3, padding:14, overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                  <p style={{ fontFamily:mn2, fontSize:7, color:"rgba(13,13,11,.35)", letterSpacing:".08em", marginBottom:10 }}>FILL + BURIED</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:44, lineHeight:.88, letterSpacing:"-0.04em", color:"#0D0D0B" }}>Big-<span style={{ fontFamily:sf2, fontStyle:"italic", fontSize:46, color:"rgba(13,13,11,.8)" }}>agency</span><br/>firepower.</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:12, color:"rgba(13,13,11,.5)", marginTop:6 }}>Without the baggage. 💣</p>
                </div>
              )
            },
            // --- LI RESULTS ---
            {
              id:"lr1", platform:"li", tag:"RESULTS 📐",
              render: () => (
                <div style={{ background:"#0D0D0B", aspectRatio:"1.91/1", borderRadius:3, padding:"16px 20px", display:"flex", alignItems:"center", gap:20, overflow:"hidden" }}>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontWeight:400, fontSize:58, lineHeight:.88, letterSpacing:"-0.02em", color:"#C8EC3C", flexShrink:0 }}>21<br/>days.</p>
                  <div>
                    <p style={{ fontFamily:sg2, fontWeight:200, fontSize:14, color:"rgba(255,255,255,.4)", letterSpacing:"-0.01em", lineHeight:1.3 }}>Brief to launch.</p>
                    <p style={{ fontFamily:mn2, fontSize:10, color:"rgba(196,189,180,.3)", marginTop:4 }}>No drama. 🏹</p>
                  </div>
                </div>
              )
            },
            {
              id:"lr2", platform:"li", tag:"RESULTS 📐",
              render: () => (
                <div style={{ background:"#5C1A9A", aspectRatio:"1.91/1", borderRadius:3, padding:"16px 24px", display:"flex", flexDirection:"column", justifyContent:"center", overflow:"hidden", position:"relative" }}>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:15, color:"rgba(255,255,255,.4)", letterSpacing:"-0.015em" }}>Repositioned. Relaunched.</p>
                  <div style={{ display:"inline-block" }}>
                    <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:28, color:"#F572A8", lineHeight:1 }}>Sold out. 📐</p>
                    <BigUnderline color="#F572A8"/>
                  </div>
                </div>
              )
            },
            {
              id:"lr3", platform:"li", tag:"RESULTS 📐",
              render: () => (
                <div style={{ background:"#C8EC3C", aspectRatio:"1.91/1", borderRadius:3, padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <p style={{ fontFamily:sg2, fontWeight:200, fontSize:15, color:"rgba(13,13,11,.5)", letterSpacing:"-0.015em" }}>Zero ad spend.</p>
                    <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:22, color:"#5C1A9A" }}>Just good work.</p>
                  </div>
                  <span style={{ fontSize:48 }}>🧲</span>
                </div>
              )
            },
            {
              id:"lr4", platform:"li", tag:"RESULTS 📐",
              render: () => (
                <div style={{ background:"#0D0D0B", aspectRatio:"1.91/1", borderRadius:3, padding:"16px 20px", display:"flex", flexDirection:"column", justifyContent:"center", overflow:"hidden" }}>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:20, color:"#C41E2D", lineHeight:1, margin:0 }}>Six months of positioning.</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:15, color:"rgba(255,255,255,.4)", letterSpacing:"-0.015em", margin:0 }}>Done in six weeks. ⚗️</p>
                </div>
              )
            },
            // --- LI MESSAGES ---
            {
              id:"lm1", platform:"li", tag:"MESSAGES 🧨",
              render: () => (
                <div style={{ background:"#0D0D0B", aspectRatio:"1.91/1", borderRadius:3, padding:"16px 24px", display:"flex", flexDirection:"column", justifyContent:"center", position:"relative", overflow:"hidden" }}>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:16, color:"rgba(255,255,255,.4)", letterSpacing:"-0.015em" }}>Most briefs <span style={{ fontFamily:sf2, fontStyle:"italic", color:"#C41E2D" }}>aren't</span> briefs.</p>
                  <p style={{ fontFamily:mn2, fontSize:10, color:"rgba(196,30,45,.5)", marginTop:6 }}>Change my mind. 🪤</p>
                </div>
              )
            },
            {
              id:"lm2", platform:"li", tag:"MESSAGES 🧨",
              render: () => (
                <div style={{ background:"#5C1A9A", aspectRatio:"1.91/1", borderRadius:3, padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <p style={{ fontFamily:sg2, fontWeight:200, fontSize:15, color:"rgba(255,255,255,.5)", letterSpacing:"-0.015em" }}>We don't do average.</p>
                    <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:22, color:"#C8EC3C", lineHeight:1 }}>Neither should your brief.</p>
                  </div>
                  <span style={{ fontSize:38, flexShrink:0 }}>🧨</span>
                </div>
              )
            },
            {
              id:"lm3", platform:"li", tag:"MESSAGES 🧨",
              render: () => (
                <div style={{ background:"#F572A8", aspectRatio:"1.91/1", borderRadius:3, padding:"16px 24px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
                  <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:26, color:"#0D0D0B", lineHeight:1, marginBottom:2 }}>Seriously</p>
                  <p style={{ fontFamily:sg2, fontWeight:200, fontSize:20, letterSpacing:"-0.02em", color:"rgba(13,13,11,.6)", lineHeight:1 }}>Playful. 🎲</p>
                </div>
              )
            },
            {
              id:"lm4", platform:"li", tag:"MESSAGES 🧨",
              render: () => (
                <div style={{ background:"#C8EC3C", aspectRatio:"1.91/1", borderRadius:3, padding:"16px 24px", display:"flex", alignItems:"center", gap:16 }}>
                  <span style={{ fontSize:44, flexShrink:0 }}>🥊</span>
                  <div>
                    <p style={{ fontFamily:sg2, fontWeight:200, fontSize:15, color:"rgba(13,13,11,.5)", letterSpacing:"-0.015em" }}>Playing hard to</p>
                    <p style={{ fontFamily:sf2, fontStyle:"italic", fontSize:22, color:"#5C1A9A", lineHeight:1 }}>work harder.</p>
                  </div>
                </div>
              )
            },
          ];

                    const igResults = cards.filter(c=>c.platform==="ig"&&c.tag.includes("RESULTS"));
          const igMessages = cards.filter(c=>c.platform==="ig"&&c.tag.includes("MESSAGES"));
          const liResults = cards.filter(c=>c.platform==="li"&&c.tag.includes("RESULTS"));
          const liMessages = cards.filter(c=>c.platform==="li"&&c.tag.includes("MESSAGES"));

          const Section = ({ label, cols, items }) => (
            <div style={{ marginBottom:36 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                <span style={{ fontFamily:mn, fontSize:10, letterSpacing:".06em", color:c.ash }}>{label.split("·")[0].trim()}</span>
                <div className="div" style={{ flex:1 }}/>
                <span style={{ fontFamily:mn, fontSize:10, color:c.red, letterSpacing:".06em" }}>{label.split("·")[1]?.trim()}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:8 }}>
                {items.map(card => <div key={card.id}>{card.render()}</div>)}
              </div>
            </div>
          );

          return (
            <div>
              <p className="lbl" style={{ marginBottom:20 }}>09 — Social Cards</p>
              <Section label="INSTAGRAM · RESULTS 🏹" cols={6} items={igResults}/>
              <Section label="INSTAGRAM · MESSAGES 🦊" cols={6} items={igMessages}/>
              <div className="div" style={{ marginBottom:36 }}/>
              <Section label="LINKEDIN · RESULTS 📐" cols={2} items={liResults}/>
              <Section label="LINKEDIN · MESSAGES 🧨" cols={2} items={liMessages}/>
            </div>
          );
        })()}

                {/* WEBFLOW */}
        {active==="Webflow" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>08 — Webflow</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:56,lineHeight:1,letterSpacing:"-0.025em",marginBottom:8 }}>
              Set once. Use <span style={{ fontFamily:sf,fontStyle:"italic",color:c.red }}><E value={ct.webflowMeta.headingSerif} onChange={v=>set("webflowMeta.headingSerif",v)} editMode={em}/></span>.
            </h2>
            <p style={{ fontSize:15,color:"rgba(13,13,11,.5)",marginBottom:40 }}>Paste into Site Settings → Custom Code → head.</p>
            <div style={{ background:c.midnight,borderRadius:4,padding:28,marginBottom:28,fontFamily:mn,fontSize:12,lineHeight:2.1 }}>
              <p style={{ color:"rgba(196,189,180,.4)",marginBottom:8,fontSize:10 }}>/* S&D Brand Tokens v9 */</p>
              <p style={{ color:c.red }}>{":root {"}</p>
              {webflow.map(t=>(
                <p key={t.token} style={{ paddingLeft:24 }}>
                  <span style={{ color:"#F0EDE8" }}>{t.token}</span>
                  <span style={{ color:c.ash }}>: </span>
                  <span style={{ color:"#FFF" }}>{t.value}</span>
                  <span style={{ color:"rgba(196,189,180,.3)" }}>; /* {t.note} */</span>
                </p>
              ))}
              <p style={{ color:c.red }}>{"}"}</p>
            </div>
            <div>
              {webflow.map((t,i)=>(
                <div key={i} className="tr">
                  <span style={{ fontFamily:mn,fontSize:11,color:c.red,minWidth:210 }}>{t.token}</span>
                  <span style={{ fontFamily:mn,fontSize:11,color:"rgba(13,13,11,.35)",flex:1 }}>{t.value}</span>
                  <span style={{ fontSize:12,color:c.ash,flex:1 }}>{t.note}</span>
                  <button className={`cb${copied===t.token?" ok":""}`} onClick={()=>copy(`${t.token}: ${t.value};`,t.token)}>{copied===t.token?"✓":"Copy"}</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


function Brand() {
  return <BrandGuide />;
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
            <div style={{ fontSize: '10px', color: T.txT, fontFamily: T.mono, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Smith & Devil</div>
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
