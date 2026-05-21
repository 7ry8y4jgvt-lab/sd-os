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
  ({ color }) => (
    <svg viewBox="0 0 110 50" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 28px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 100,20 C 108,8 88,2 55,2 C 22,2 4,10 4,25 C 4,40 22,48 55,48 C 82,48 100,42 104,32"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),
  ({ color }) => (
    <svg viewBox="0 0 110 36" style={{ position:"absolute",top:"-8px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 16px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 8,18 C 8,6 24,2 55,2 C 86,2 102,6 102,18 C 102,30 86,34 55,34 C 24,34 8,30 8,20 L 11,17"
        fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  ({ color }) => (
    <svg viewBox="0 0 110 50" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 28px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 12,26 C 10,8 26,2 55,2 C 84,2 100,8 100,25 C 100,42 84,48 55,48 C 26,48 10,42 12,28 L 15,24"
        fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M 8,22 C 6,5 23,0 55,0 C 87,0 105,6 105,25 C 105,44 87,50 55,50 C 23,50 5,44 8,24 L 12,21"
        fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  ({ color }) => (
    <svg viewBox="0 0 110 50" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 28px)",pointerEvents:"none",overflow:"visible",transform:"rotate(-20deg)",transformOrigin:"50% 50%" }}>
      <path d="M 10,26 C 8,8 26,2 55,2 C 84,2 102,8 102,25 C 102,42 84,48 55,48 C 26,48 8,42 10,28 L 13,24"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),
  ({ color }) => (
    <svg viewBox="0 0 110 60" style={{ position:"absolute",top:"-14px",left:"-18px",width:"calc(100% + 36px)",height:"calc(100% + 38px)",pointerEvents:"none",overflow:"visible" }}>
      <path d="M 12,26 C 10,8 26,2 55,2 C 84,2 100,8 100,25 C 100,42 84,48 55,48 C 26,48 9,42 10,28 L 13,24 L 16,29 L 12,38 L 6,52"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
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
  "idea": {
    "heading1": "Seriously",
    "heading2": "Playful.",
    "body1": "The Smith — craft, precision, 20+ years of hard-earned know-how. The Devil — wit, mischief, charm.",
    "body2": "The Devil breaks the rules, The Smith crafts the results.",
    "craftLabel": "Craft 🔨 — The Smith",
    "craftDesc": "Precision. Deep colours. Considered marks. Thin type at scale. The work done properly.",
    "creativityLabel": "Creativity ✨ — The Devil",
    "creativityDesc": "Audacity. Candy colours. The serif switch-up. The circled word. The mischievous move that lands.",
    "originHeading": "At over 6,000 years old, The Smith & The Devil is the world's most enduring story.",
    "originBody": "Not bad for a narrative that pre-dates the written word. It's had a refresh or two along the way — but the devil's in the detail. A great story well-told has the power to last forever."
  },
  "logo": {
    "headingSerif": "ampersand",
    "intro": "The logo is a Didone serif wordmark — high contrast thick/thin. \"Smith\" and \"Devil\" are restrained. The & is not. It's ornate, looped, larger than it should be. That tension is the whole brand.",
    "lockups": [
      {
    "label": "Full wordmark",
    "desc": "Primary. Use wherever space allows. Never stretch or squeeze."
  },
      {
    "label": "S&D monogram",
    "desc": "Icon / avatar. Social, larger favicons, app icon."
  },
      {
    "label": "& standalone",
    "desc": "Favicon only. The brand's most distinctive character."
  }
    ],
    "variants": [
      {
    "tag": "Primary",
    "label": "White/Red on Black"
  },
      {
    "tag": "Reversed",
    "label": "Black/Red on White"
  },
      {
    "tag": "Single colour",
    "label": "All Black on White"
  },
      {
    "tag": "Brand colour",
    "label": "White/Spark on Violet"
  }
    ],
    "rules": [
      {
    "do": true,
    "text": "Always use the supplied logo files. Never recreate from type."
  },
      {
    "do": false,
    "text": "Never use the wordmark at less than 120px wide. Use the S&D icon instead."
  },
      {
    "do": true,
    "text": "The & is always red. In single-colour versions it matches the wordmark."
  },
      {
    "do": false,
    "text": "Never place the logo on a busy photograph without a clear zone or overlay."
  },
      {
    "do": true,
    "text": "Minimum clear space: the height of the capital S on all sides."
  },
      {
    "do": false,
    "text": "Never rotate, distort, recolour, or add effects to the logo."
  }
    ]
  },
  "colour": {
    "headingSans1": "Craft vs",
    "headingSerifInline": "Creativity",
    "intro": "Deep colours for craft. Candy colours for creativity.",
    "colors": {
    "craft": [
      {
    "name": "Midnight",
    "hex": "#0D0D0B",
    "use": "The Smith's forge. All key backgrounds, the logo ground, hero moments."
  },
      {
    "name": "Devil Red",
    "hex": "#C41E2D",
    "use": "The & — where craft meets danger. The brand signature. Earns its place every time."
  },
      {
    "name": "White",
    "hex": "#FFFFFF",
    "use": "The canvas. Clean ground — lets craft and creativity battle it out on top."
  }
    ],
    "creativity": [
      {
    "name": "Violet",
    "hex": "#5C1A9A",
    "use": "Pairs with Midnight, contrasts the candy colours hard."
  },
      {
    "name": "Spark",
    "hex": "#C8EC3C",
    "use": "Candy lime. The creative energy hit. Works hardest against Midnight and Violet."
  },
      {
    "name": "Flash",
    "hex": "#F572A8",
    "use": "Candy pink. Playful, warm, the devil's lighter side."
  }
    ]
  },
    "combos": [
      {
    "label": "Default",
    "note": "White ground. All pages."
  },
      {
    "label": "Midnight",
    "note": "Craft hero moments."
  },
      {
    "label": "Violet",
    "note": "Craft depth, creative spark."
  },
      {
    "label": "Spark",
    "note": "Creativity in full force."
  },
      {
    "label": "Flash",
    "note": "The devil's lighter side."
  }
    ]
  },
  "type": {
    "headingSerifInline": "unexpected",
    "intro": "Typography punctuates meaning.",
    "mischiefIntro": "The serif switch is one move. Mischief with type means knowing when to use it — and when to do something weirder instead.",
    "mischiefMoves": [
      {
    "label": "BURY THE SERIF",
    "render": "serif-buried",
    "before": "Playing hard to ",
    "serif": "work",
    "after": " harder.",
    "note": "Not 'harder.' — work. The effort, not the result. The last word is too obvious."
  },
      {
    "label": "SCALE CLASH",
    "render": "scale-clash",
    "big": "Done.",
    "small": "Brief arrived in January. Handed it back in March. Live in April.",
    "note": "One word enormous. Everything else small. The size is the statement."
  },
      {
    "label": "MONO INTERRUPTS",
    "render": "mono-interrupt",
    "before": "Big-agency firepower.",
    "mono": "without the overhead.",
    "note": "Space Mono crashes the display moment. Completely wrong register — which makes it work."
  },
      {
    "label": "SERIF BURIES IN PROSE",
    "render": "serif-mid",
    "before": "Most briefs ",
    "serif": "aren't",
    "after": " briefs.",
    "note": "Preposition, negation, a throwaway word. Never the noun. Never the last word."
  },
      {
    "label": "WEIGHT ONLY — NO SERIF",
    "render": "weight-only",
    "light": "Brief in. Chaos out.",
    "bold": "Magic happens.",
    "note": "Heavy weight on the payoff, no italic needed. The devil doesn't always need to show up."
  },
      {
    "label": "ONE WORD. FULL STOP.",
    "render": "all-in",
    "serif": "Delivered.",
    "note": "Drop everything else. When there's only one word worth saying, say only that."
  }
    ],
    "scale": [
      {
    "label": "Hero",
    "size": "88px",
    "weight": "200",
    "sample": "Seriously Playful."
  },
      {
    "label": "H1",
    "size": "60px",
    "weight": "300",
    "sample": "Big-agency firepower."
  },
      {
    "label": "H2",
    "size": "42px",
    "weight": "300",
    "sample": "What we do."
  },
      {
    "label": "Accent",
    "size": "42px",
    "weight": "400i",
    "sample": "can't put down."
  },
      {
    "label": "Body L",
    "size": "18px",
    "weight": "400",
    "sample": "We design experiences people want to be in."
  },
      {
    "label": "Body",
    "size": "16px",
    "weight": "400",
    "sample": "Brief in. Chaos out. Magic happens."
  },
      {
    "label": "Micro",
    "size": "11px",
    "weight": "400m",
    "sample": "SDV · 04 · LDN"
  }
    ]
  },
  "marks": {
    "headingSerif": "notepad",
    "intro": "Hand-drawn circles and underlines. The editorial punctuation that says: this one matters. Use sparingly — one mark per piece, two at most.",
    "circleExamples": [
      {
    "label": "Red on white",
    "phrase": "seriously"
  },
      {
    "label": "Spark on black",
    "phrase": "playful"
  },
      {
    "label": "Flash on violet",
    "phrase": "magic"
  }
    ],
    "underlineExamples": [
      {
    "label": "Red on white",
    "line1": "Big-agency firepower",
    "line2": "without the baggage."
  },
      {
    "label": "Spark on black",
    "line1": "Playing hard to",
    "line2": "work harder."
  }
    ],
    "rules": [
      "One mark per piece. Two maximum. More than that and nothing is marked.",
      "Circles go around nouns and phrases. Underlines go under the punchline or key claim.",
      "Use creativity palette colours for marks on dark backgrounds. Use Devil Red on white.",
      "Marks should feel like they were added by hand after the type was set — not designed in."
    ]
  },
  "voice": {
    "headingLine1": "Craft & clarity.",
    "headingSans": "Playful mischief.",
    "intro": "Say what you mean with a twinkle in your eye.",
    "examples": [
      {
    "do": "Playing hard to work harder. 💪",
    "doSub": "Our work comes from a playful place — but it doesn't pass the test unless it's built on rock solid strategy.",
    "dont": "Our creative approach is underpinned by robust strategic thinking.",
    "dontSub": "Same point. Zero personality."
  },
      {
    "do": "A seemingly infinite box of creative tricks. 😈",
    "doSub": "Confident and interesting.",
    "dont": "A full service agency.",
    "dontSub": "Every agency says this. In those exact words."
  },
      {
    "do": "Big-agency firepower without the big-agency baggage.",
    "doSub": "Specific contrast. Positions against a real client anxiety.",
    "dont": "An agile alternative to the traditional agency model.",
    "dontSub": "LinkedIn post, 2019."
  },
      {
    "do": "Dipping a toe, or diving in? We're here for it.",
    "doSub": "Speaks to fears and resolves with charm.",
    "dont": "Our streamlined onboarding process ensures efficient project initiation.",
    "dontSub": "Reads like terms and conditions."
  }
    ],
    "emojis": {
    "craft": [
      {
    "emoji": "🔨",
    "use": "The making. Craft, build, deliver."
  },
      {
    "emoji": "⚒️",
    "use": "The forge. The physical act of making."
  },
      {
    "emoji": "📐",
    "use": "Precision and strategy. The plan that holds."
  },
      {
    "emoji": "✂️",
    "use": "Editing, sharpening, cutting to the point."
  },
      {
    "emoji": "⚗️",
    "use": "Experimentation with rigour. The test."
  },
      {
    "emoji": "🔭",
    "use": "Seeing further than the brief."
  },
      {
    "emoji": "🧩",
    "use": "The piece that finally fits."
  },
      {
    "emoji": "🏹",
    "use": "Precise. Intentional. Hits the mark."
  }
    ],
    "creativity": [
      {
    "emoji": "✨",
    "use": "The creative spark. Magic happening."
  },
      {
    "emoji": "💡",
    "use": "The idea arriving. Unexpected and right."
  },
      {
    "emoji": "🪄",
    "use": "The devil's move — the trick that works."
  },
      {
    "emoji": "⚡",
    "use": "Speed and impact. The unexpected hit."
  },
      {
    "emoji": "🌀",
    "use": "Chaos before clarity. The creative process, honestly."
  },
      {
    "emoji": "🎲",
    "use": "A calculated gamble. Risk with intent."
  },
      {
    "emoji": "🎭",
    "use": "Performance, spectacle, the big reveal."
  },
      {
    "emoji": "🪩",
    "use": "Unserious energy deployed seriously."
  }
    ],
    "disrupt": [
      {
    "emoji": "😈",
    "use": "The devil. Use it like a signature — sparingly, when something is properly, unmistakably S&D."
  },
      {
    "emoji": "💣",
    "use": "The idea that blows up the brief. Use when something is properly disruptive."
  },
      {
    "emoji": "🧨",
    "use": "A shorter fuse. Smaller explosion. Still a statement."
  },
      {
    "emoji": "🥊",
    "use": "Fighting talk. Positioning against something."
  },
      {
    "emoji": "🪤",
    "use": "They didn't see it coming. The trap that delights."
  },
      {
    "emoji": "👻",
    "use": "The thing nobody else in the room said."
  },
      {
    "emoji": "🦊",
    "use": "Cunning. Clever. A little bit devil."
  },
      {
    "emoji": "🫦",
    "use": "Audacious. Bold. Slightly uncomfortable — in a good way."
  },
      {
    "emoji": "📡",
    "use": "All signal, no noise. Cut through."
  }
    ],
    "random": [
      {
    "emoji": "🐈",
    "use": "Completely off-piste. The fonts.xyz move — disarms people."
  },
      {
    "emoji": "🧿",
    "use": "Warding off the ordinary. Protective energy."
  },
      {
    "emoji": "🕹️",
    "use": "Control. Play. The person in the room who knows the cheat codes."
  },
      {
    "emoji": "🎪",
    "use": "The spectacle. The whole show."
  },
      {
    "emoji": "☻",
    "use": "Old internet charm. Warm but a little unsettling."
  },
      {
    "emoji": "💍",
    "use": "One licence to rule them all. Cultural reference energy."
  },
      {
    "emoji": "🌋",
    "use": "Something is about to erupt. Build the tension."
  },
      {
    "emoji": "🧲",
    "use": "The gravitational pull of a good idea."
  }
    ]
  }
  },
  "social": {
    "igResults": [
      {
    "bg": "#0D0D0B",
    "fg": "#FFFFFF",
    "acc": "#C8EC3C",
    "sans": "3 weeks.",
    "serif": "Brief to launch.",
    "emoji": "🏹"
  },
      {
    "bg": "#FFFFFF",
    "fg": "#0D0D0B",
    "acc": "#C41E2D",
    "sans": "Brief in February.",
    "serif": "Live in April.",
    "emoji": "🔨"
  },
      {
    "bg": "#5C1A9A",
    "fg": "#FFFFFF",
    "acc": "#F572A8",
    "sans": "Repositioned.",
    "serif": "Relaunched.",
    "emoji": "📐"
  },
      {
    "bg": "#C8EC3C",
    "fg": "#0D0D0B",
    "acc": "#5C1A9A",
    "sans": "Zero ad spend.",
    "serif": "Just good work.",
    "emoji": "🧲"
  },
      {
    "bg": "#0D0D0B",
    "fg": "#FFFFFF",
    "acc": "#F572A8",
    "sans": "Six months of",
    "serif": "positioning. Done.",
    "emoji": "⚗️"
  },
      {
    "bg": "#FFFFFF",
    "fg": "#0D0D0B",
    "acc": "#C41E2D",
    "sans": "Brief in. Chaos out.",
    "serif": "Magic delivered.",
    "emoji": "🌀"
  }
    ],
    "igMessages": [
      {
    "bg": "#FFFFFF",
    "fg": "#0D0D0B",
    "acc": "#C41E2D",
    "sans": "Seriously",
    "serif": "Playful.",
    "emoji": "✨"
  },
      {
    "bg": "#0D0D0B",
    "fg": "#FFFFFF",
    "acc": "#C8EC3C",
    "sans": "The devil's in the detail.",
    "serif": "We put him there.",
    "emoji": "🦊"
  },
      {
    "bg": "#5C1A9A",
    "fg": "#FFFFFF",
    "acc": "#F572A8",
    "sans": "Playing hard to",
    "serif": "work harder.",
    "emoji": "🥊"
  },
      {
    "bg": "#F572A8",
    "fg": "#0D0D0B",
    "acc": "#0D0D0B",
    "sans": "Most briefs",
    "serif": "aren't briefs.",
    "emoji": "🪤"
  },
      {
    "bg": "#C8EC3C",
    "fg": "#0D0D0B",
    "acc": "#5C1A9A",
    "sans": "Big-agency firepower.",
    "serif": "Without the baggage.",
    "emoji": "💣"
  },
      {
    "bg": "#0D0D0B",
    "fg": "#FFFFFF",
    "acc": "#C41E2D",
    "sans": "Brief in. Chaos out.",
    "serif": "Magic happens.",
    "emoji": "🐈"
  }
    ],
    "liResults": [
      {
    "bg": "#0D0D0B",
    "fg": "#FFFFFF",
    "acc": "#C8EC3C",
    "sans": "Brief to launch.",
    "serif": "21 days. No drama.",
    "emoji": "🏹"
  },
      {
    "bg": "#5C1A9A",
    "fg": "#FFFFFF",
    "acc": "#F572A8",
    "sans": "Repositioned. Relaunched.",
    "serif": "Sold out.",
    "emoji": "📐"
  },
      {
    "bg": "#C8EC3C",
    "fg": "#0D0D0B",
    "acc": "#5C1A9A",
    "sans": "Zero ad spend.",
    "serif": "Just good work.",
    "emoji": "🧲"
  },
      {
    "bg": "#0D0D0B",
    "fg": "#FFFFFF",
    "acc": "#F572A8",
    "sans": "Six months of positioning.",
    "serif": "Done in six weeks.",
    "emoji": "⚗️"
  }
    ],
    "liMessages": [
      {
    "bg": "#0D0D0B",
    "fg": "#FFFFFF",
    "acc": "#C41E2D",
    "sans": "Most briefs aren't briefs.",
    "serif": "Change my mind.",
    "emoji": "🪤"
  },
      {
    "bg": "#5C1A9A",
    "fg": "#FFFFFF",
    "acc": "#C8EC3C",
    "sans": "We don't do average.",
    "serif": "Neither should your brief.",
    "emoji": "🧨"
  },
      {
    "bg": "#F572A8",
    "fg": "#0D0D0B",
    "acc": "#0D0D0B",
    "sans": "Playing hard to",
    "serif": "work harder.",
    "emoji": "🥊"
  },
      {
    "bg": "#C8EC3C",
    "fg": "#0D0D0B",
    "acc": "#5C1A9A",
    "sans": "Seriously",
    "serif": "Playful.",
    "emoji": "🎲"
  }
    ]
  },
  "behaviour": {
    "headingSans": "Search your",
    "headingSerif": "feelings...",
    "items": [
      {
    "side": "Both",
    "name": "Seriously Playful is our proposition",
    "desc": "Every execution should answer both: is this serious? Is this playful? If it's only one, it's not S&D. The tension is the brand."
  },
      {
    "side": "Craft",
    "name": "Deep colours do the serious work",
    "desc": "Midnight, Devil Red and Violet carry the weight — precision, conviction, intent. Use them when S&D needs to be believed."
  },
      {
    "side": "Creativity",
    "name": "Candy colours do the playful work",
    "desc": "Spark and Flash are the devil showing up uninvited. One per section — their power comes from being unexpected."
  },
      {
    "side": "Both",
    "name": "Font variance punctuates meaning.",
    "desc": "When a phrase needs to land switch type face. The contrast with Didone IS the moment."
  },
      {
    "side": "Both",
    "name": "Marks are editorial, not decorative",
    "desc": "A hand-drawn circle or underline says: this matters. Used sparingly on one or two words per piece, not scattered like confetti."
  },
      {
    "side": "Creativity",
    "name": "Emojis signal which side is speaking",
    "desc": "Craft emojis (🔨 📐 ✂️) when the work is the point. Creativity emojis (✨ 💡 🪄) when the idea is the point. Never both in the same breath."
  }
    ]
  },
  "webflowMeta": {
    "headingSerif": "everywhere"
  },
};

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
  const [saveStatus, setSaveStatus] = useState("idle");

  useState(() => {
    (async () => {
      try {
        const result = await window.storage.get("sd-brand-content-v2");
        if (result?.value) {
          const saved = JSON.parse(result.value);
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
          merged.voice.emojis = initContent.voice.emojis;
          if (merged.voice.headingSans && merged.voice.headingSans.length > 20) merged.voice.headingSans = initContent.voice.headingSans;
          if (merged.type.headingSerifInline && merged.type.headingSerifInline.length > 20) merged.type.headingSerifInline = initContent.type.headingSerifInline;
          if (merged.marks.headingSerif && merged.marks.headingSerif.length > 20) merged.marks.headingSerif = initContent.marks.headingSerif;
          if (merged.colour.headingSerifInline && merged.colour.headingSerifInline.length > 20) merged.colour.headingSerifInline = initContent.colour.headingSerifInline;
          if (merged.logo.headingSerif && merged.logo.headingSerif.length > 20) merged.logo.headingSerif = initContent.logo.headingSerif;
          setCt(merged);
          setSaveStatus("saved");
        }
      } catch (e) {}
    })();
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
      await window.storage.set("sd-brand-content-v2", JSON.stringify(contentToSave));
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("idle");
    }
  }, []);

  const exportJSON = useCallback(() => {
    const json = JSON.stringify(ct, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sd-brand-content.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [ct]);

  const resetContent = useCallback(async () => {
    try { await window.storage.delete("sd-brand-content-v2"); } catch(e) {}
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
        .export-btn{background:#C41E2D;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:8px 18px;border-radius:2px;color:#FFF;transition:all .2s}
        .export-btn:hover{background:#a01828}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:"1px solid rgba(13,13,11,.08)",padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:c.white,zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"baseline",gap:12 }}>
          <span style={{ fontFamily:sg,fontWeight:300,fontSize:18,letterSpacing:"-0.02em" }}>Smith<span style={{ color:c.red,fontFamily:sf,fontStyle:"italic",fontWeight:700 }}>&</span>Devil</span>
          <span style={{ fontFamily:mn,fontSize:10,color:c.ash,letterSpacing:".06em" }}>BRAND SYSTEM v10.0</span>
        </div>
        <div style={{ display:"flex",gap:2,alignItems:"center",flexWrap:"wrap" }}>
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
              <button className="export-btn" onClick={exportJSON}>
                ⬇ Export JSON
              </button>
              <button onClick={()=>{
                if(confirm("Reset to defaults? This clears all your edits.")) {
                  resetContent();
                }
              }} style={{ background:"transparent",border:"1px solid rgba(13,13,11,.1)",cursor:"pointer",fontFamily:dm,fontSize:11,letterSpacing:".05em",textTransform:"uppercase",padding:"6px 14px",borderRadius:2,color:"rgba(13,13,11,.35)" }}>
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
            <span style={{ fontSize:12,color:"rgba(13,13,11,.6)" }}>— Click any text to edit. Hit Save edits, then ⬇ Export JSON.</span>
          </div>
          {saveStatus==="saved" && <span style={{ fontFamily:mn,fontSize:10,color:"rgba(13,13,11,.5)",letterSpacing:".05em" }}>ALL CHANGES SAVED ✓</span>}
        </div>
      )}

      <div style={{ padding:"44px 40px",maxWidth:1000,margin:"0 auto" }}>

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

        {active==="Voice" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>06 — Voice & Tone</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:56,lineHeight:1,letterSpacing:"-0.025em",marginBottom:4 }}>
              {em ? <input value={ct.voice.headingLine1} onChange={e=>set("voice.headingLine1",e.target.value)} style={{ fontFamily:sg,fontWeight:200,fontSize:"inherit",letterSpacing:"inherit",lineHeight:"inherit",color:c.midnight,background:"rgba(200,236,60,.15)",border:"1px dashed rgba(100,140,0,.4)",borderRadius:2,outline:"none",padding:"0 4px",width:"100%" }}/> : <span>{ct.voice.headingLine1}</span>}
            </h2>
            <h2 style={{ fontFamily:sf,fontStyle:"italic",fontWeight:400,fontSize:56,lineHeight:1,letterSpacing:"-0.01em",color:c.red,marginBottom:14 }}>
              {em ? <input value={ct.voice.headingSans} onChange={e=>set("voice.headingSans",e.target.value)} style={{ fontFamily:sf,fontStyle:"italic",fontSize:"inherit",fontWeight:400,color:c.red,background:"rgba(200,236,60,.15)",border:"1px dashed rgba(100,140,0,.4)",borderRadius:2,outline:"none",padding:"0 4px",width:"100%",letterSpacing:"inherit",lineHeight:"inherit",display:"block" }}/> : <span>{ct.voice.headingSans}</span>}
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
          </div>
        )}

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
                { label:"DISPLAY", fam:sg, fw:200, fs:32, ls:"-0.02em", fi:false, name:"Cabinet Grotesk", wt:"ExtraLight / Light (200–300)", use:"All display & hero. Thin weight at scale.", hot:false },
                { label:"ACCENT — THE SWITCH", fam:sf, fw:400, fs:36, ls:"-0.01em", fi:true, name:"Playfair Display", wt:"Italic / Bold (400i–700i)", use:"Key phrases only. Didone switch-up — echoes the logo.", hot:true },
                { label:"BODY", fam:dm, fw:400, fs:24, ls:"0", fi:false, name:"DM Sans", wt:"Regular / Medium (400–500)", use:"Body copy, UI, navigation.", hot:false },
                { label:"DETAIL", fam:mn, fw:400, fs:16, ls:"0", fi:false, name:"Space Mono", wt:"Regular (400)", use:"Metadata only. Reference numbers, small labels.", hot:false },
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
            <div style={{ background:c.midnight,borderRadius:3,padding:"20px 24px",marginBottom:20 }}>
              <p style={{ fontFamily:sg,fontWeight:200,fontSize:20,lineHeight:1.4,letterSpacing:"-0.02em",color:c.white }}>
                <E value={ct.type.mischiefIntro} onChange={v=>set("type.mischiefIntro",v)} editMode={em} multiline block/>
              </p>
            </div>
            <div style={{ display:"grid",gap:8,marginBottom:40 }}>
              {ct.type.mischiefMoves.map((mv,i) => {
                const r = mv.render;
                return (
                  <div key={i} style={{ border:"1px solid rgba(13,13,11,.09)",borderRadius:3,padding:"18px 24px",display:"grid",gridTemplateColumns:"1fr 220px",gap:24,alignItems:"center" }}>
                    <div>
                      <p style={{ fontFamily:mn,fontSize:9,color:c.ash,letterSpacing:".07em",marginBottom:12 }}>{mv.label}</p>
                      {r==="serif-buried" && (
                        <p style={{ fontFamily:sg,fontWeight:300,fontSize:26,lineHeight:1.1,letterSpacing:"-0.015em" }}>
                          <E value={mv.before} onChange={v=>set(`type.mischiefMoves.${i}.before`,v)} editMode={em}/>
                          <span style={{ fontFamily:sf,fontStyle:"italic",fontWeight:400,fontSize:29,color:c.red }}><E value={mv.serif} onChange={v=>set(`type.mischiefMoves.${i}.serif`,v)} editMode={em}/></span>
                          <E value={mv.after} onChange={v=>set(`type.mischiefMoves.${i}.after`,v)} editMode={em}/>
                        </p>
                      )}
                      {r==="scale-clash" && (
                        <div>
                          <p style={{ fontFamily:sf,fontStyle:"italic",fontWeight:400,fontSize:52,lineHeight:.9,letterSpacing:"-0.02em",color:c.red,marginBottom:6 }}><E value={mv.big} onChange={v=>set(`type.mischiefMoves.${i}.big`,v)} editMode={em}/></p>
                          <p style={{ fontFamily:sg,fontWeight:300,fontSize:12,color:"rgba(13,13,11,.4)",lineHeight:1.5 }}><E value={mv.small} onChange={v=>set(`type.mischiefMoves.${i}.small`,v)} editMode={em} multiline/></p>
                        </div>
                      )}
                      {r==="mono-interrupt" && (
                        <div>
                          <p style={{ fontFamily:sg,fontWeight:200,fontSize:24,lineHeight:1.1,letterSpacing:"-0.02em",marginBottom:4 }}><E value={mv.before} onChange={v=>set(`type.mischiefMoves.${i}.before`,v)} editMode={em}/></p>
                          <p style={{ fontFamily:mn,fontSize:13,color:c.red,letterSpacing:".01em" }}><E value={mv.mono} onChange={v=>set(`type.mischiefMoves.${i}.mono`,v)} editMode={em}/></p>
                        </div>
                      )}
                      {(r==="serif-mid"||r==="weight-only"||r==="all-in") && (
                        <p style={{ fontFamily:sg,fontWeight:300,fontSize:26,lineHeight:1.1 }}>
                          {mv.before && <E value={mv.before} onChange={v=>set(`type.mischiefMoves.${i}.before`,v)} editMode={em}/>}
                          {mv.serif && <span style={{ fontFamily:sf,fontStyle:"italic",fontWeight:400,fontSize:29,color:c.red }}><E value={mv.serif} onChange={v=>set(`type.mischiefMoves.${i}.serif`,v)} editMode={em}/></span>}
                          {mv.after && <E value={mv.after} onChange={v=>set(`type.mischiefMoves.${i}.after`,v)} editMode={em}/>}
                        </p>
                      )}
                    </div>
                    <p style={{ fontSize:12,color:"rgba(13,13,11,.4)",lineHeight:1.65,fontStyle:"italic",borderLeft:"1px solid rgba(13,13,11,.08)",paddingLeft:20 }}>{mv.note}</p>
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
                  <span style={{ fontFamily:fam,fontWeight:fw,fontStyle:isAccent?"italic":"normal",fontSize:s.size,lineHeight:1,flex:1,color:isAccent?c.red:c.midnight }}>
                    <E value={s.sample} onChange={v=>set(`type.scale.${i}.sample`,v)} editMode={em}/>
                  </span>
                  <span style={{ fontFamily:mn,fontSize:9,color:c.ash,flexShrink:0 }}>{s.size}</span>
                </div>
              );
            })}
          </div>
        )}

        {active==="Marks" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>05 — Brand Marks</p>
            <h2 style={{ fontFamily:sg,fontWeight:200,fontSize:56,lineHeight:1,letterSpacing:"-0.025em",marginBottom:14 }}>
              The <span style={{ fontFamily:sf,fontStyle:"italic",color:c.red }}><E value={ct.marks.headingSerif} onChange={v=>set("marks.headingSerif",v)} editMode={em}/></span> mark.
            </h2>
            <div style={{ fontSize:15,color:"rgba(13,13,11,.5)",marginBottom:40,lineHeight:1.65 }}>
              <E value={ct.marks.intro} onChange={v=>set("marks.intro",v)} editMode={em} multiline block/>
            </div>
            <p className="lbl" style={{ marginBottom:12 }}>THE CIRCLE — 6 variants</p>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:32 }}>
              {[0,1,2,3,4,5].map(v=>{
                const configs = [
                  { bg:c.white,text:c.midnight,markColor:c.red,border:true,label:"Fast loop — gap right" },
                  { bg:c.midnight,text:c.white,markColor:c.spark,label:"Rubber band — super flat" },
                  { bg:c.violet,text:c.white,markColor:c.flash,label:"Emphatic thin — twice" },
                  { bg:c.white,text:c.midnight,markColor:c.violet,border:true,label:"Tilted — 20° slant" },
                  { bg:c.midnight,text:c.white,markColor:c.spark,label:"Flick exit — pen tail" },
                  { bg:c.flash,text:c.midnight,markColor:c.midnight,label:"Heavy marker — thick" },
                ];
                const ex = configs[v];
                const phrase = ct.marks.circleExamples[v % ct.marks.circleExamples.length].phrase;
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

        {active==="Social" && (
          <div>
            <p className="lbl" style={{ marginBottom:20 }}>09 — Social Cards</p>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:8 }}>
              <p className="lbl" style={{ gridColumn:"1/-1",marginBottom:4 }}>INSTAGRAM · RESULTS 🏹</p>
              {ct.social.igResults.map((card,i)=>(
                <div key={i} style={{ background:card.bg,aspectRatio:"1",borderRadius:3,border:card.bg==="#FFFFFF"?"1px solid rgba(13,13,11,.09)":"none",padding:"10px 12px",display:"flex",flexDirection:"column",justifyContent:"flex-end" }}>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:200,fontSize:14,color:card.fg,opacity:.5,lineHeight:1.1,marginBottom:2,letterSpacing:"-0.01em" }}>{card.sans}</p>
                  <p style={{ fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:16,color:card.acc,lineHeight:1 }}>{card.serif} {card.emoji}</p>
                </div>
              ))}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:8 }}>
              <p className="lbl" style={{ gridColumn:"1/-1",marginBottom:4 }}>INSTAGRAM · MESSAGES 🦊</p>
              {ct.social.igMessages.map((card,i)=>(
                <div key={i} style={{ background:card.bg,aspectRatio:"1",borderRadius:3,border:card.bg==="#FFFFFF"?"1px solid rgba(13,13,11,.09)":"none",padding:"10px 12px",display:"flex",flexDirection:"column",justifyContent:"center" }}>
                  <p style={{ fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:18,color:card.acc,lineHeight:1,marginBottom:2 }}>{card.serif}</p>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:200,fontSize:13,color:card.fg,opacity:.5 }}>{card.sans} {card.emoji}</p>
                </div>
              ))}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:8 }}>
              <p className="lbl" style={{ gridColumn:"1/-1",marginBottom:4 }}>LINKEDIN · RESULTS 📐</p>
              {ct.social.liResults.map((card,i)=>(
                <div key={i} style={{ background:card.bg,aspectRatio:"1.91/1",borderRadius:3,border:card.bg==="#FFFFFF"?"1px solid rgba(13,13,11,.09)":"none",padding:"14px 18px",display:"flex",flexDirection:"column",justifyContent:"center" }}>
                  <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:200,fontSize:15,color:card.fg,opacity:.5,letterSpacing:"-0.01em",marginBottom:2 }}>{card.sans}</p>
                  <p style={{ fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:20,color:card.acc,lineHeight:1 }}>{card.serif} {card.emoji}</p>
                </div>
              ))}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8 }}>
              <p className="lbl" style={{ gridColumn:"1/-1",marginBottom:4 }}>LINKEDIN · MESSAGES 🧨</p>
              {ct.social.liMessages.map((card,i)=>(
                <div key={i} style={{ background:card.bg,aspectRatio:"1.91/1",borderRadius:3,border:card.bg==="#FFFFFF"?"1px solid rgba(13,13,11,.09)":"none",padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div>
                    <p style={{ fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:200,fontSize:13,color:card.fg,opacity:.5,letterSpacing:"-0.01em",marginBottom:2 }}>{card.sans}</p>
                    <p style={{ fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:18,color:card.acc,lineHeight:1 }}>{card.serif}</p>
                  </div>
                  <span style={{ fontSize:28 }}>{card.emoji}</span>
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
