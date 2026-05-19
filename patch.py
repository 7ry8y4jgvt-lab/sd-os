import os
p = os.path.expanduser('~/Desktop/sd-os/pages/index.jsx')
with open(p, 'r') as f:
    c = f.read()
assert 'const _months = ' in c, 'anchor 1 missing'
c = c.replace('const _months = ',
    'const [openEmails, setOpenEmails] = useState(false);\n'
    '  const [aEmails, setAEmails] = useState([]);\n'
    '  const [emailsLoading, setEmailsLoading] = useState(false);\n'
    '  const [emailsFetched, setEmailsFetched] = useState(false);\n'
    '  const _months = ', 1)
print('1 ok')
assert '}, [di, _allCi]);' in c, 'anchor 2 missing'
c = c.replace('}, [di, _allCi]);',
    '}, [di, _allCi]);\n'
    '  const fetchEmails = useCallback(async () => {\n'
    '    if (emailsFetched) return;\n'
    '    setEmailsLoading(true);\n'
    '    try {\n'
    "      const r = await fetch('/api/allstars-emails');\n"
    '      const d = await r.json();\n'
    '      setAEmails(d.emails || []);\n'
    '      setEmailsFetched(true);\n'
    '    } catch (e) { setAEmails([]); }\n'
    '    finally { setEmailsLoading(false); }\n'
    '  }, [emailsFetched]);', 1)
print('2 ok')
WB = ('{openWebsite && wb.map((item, i) => '
      '<IRow key={i} item={item} showDate '
      'last={i === wb.length - 1} />)}')
assert WB in c, 'anchor 3 missing'
EM = (
    '\n            <div onClick={() => {'
    ' setOpenEmails(o => !o);'
    ' if (!openEmails && !emailsFetched) fetchEmails(); }}'
    " style={{ fontSize: '10px', color: T.txT,"
    " fontFamily: T.mono, textTransform: 'uppercase',"
    " letterSpacing: '0.08em', margin: '16px 0 10px',"
    " paddingTop: '16px', borderTop: `0.5px solid ${T.bd}`,"
    " cursor: 'pointer', userSelect: 'none' }}"
    ">{openEmails ? '\u25bc' : '\u25ba'} Emails</div>\n"
    '            {openEmails && (emailsLoading\n'
    "              ? <div style={{ fontSize: '12px',"
    " color: T.txT, padding: '8px 0' }}>Loading\u2026</div>\n"
    '              : aEmails.length === 0\n'
    "                ? <div style={{ fontSize: '12px',"
    " color: T.txT, padding: '8px 0' }}"
    ">No Allstars emails found for May / June.</div>\n"
    '                : aEmails.map((em, i) => (\n'
    "                    <div key={i} style={{ padding: '10px 0',"
    ' borderBottom: i < aEmails.length - 1'
    " ? `0.5px solid ${T.bd}` : 'none' }}>\n"
    "                      <div style={{ fontSize: '10px',"
    " color: T.txT, fontFamily: T.mono,"
    " marginBottom: '2px', overflow: 'hidden',"
    " textOverflow: 'ellipsis',"
    " whiteSpace: 'nowrap' }}>{em.from}</div>\n"
    "                      <div style={{ fontSize: '13px',"
    " fontWeight: '500', color: T.tx,"
    " marginBottom: '3px' }}>{em.subject}</div>\n"
    "                      <div style={{ fontSize: '11px',"
    " color: T.txT, fontFamily: T.mono,"
    " marginBottom: '4px' }}"
    ">{new Date(em.date).toLocaleDateString("
    "'en-GB',{day:'numeric',month:'short'})}</div>\n"
    "                      <div style={{ fontSize: '12px',"
    " color: T.txT, lineHeight: '1.5' }}"
    ">{em.snippet}</div>\n"
    '                    </div>\n'
    '                  ))\n'
    '            )}'
)
c = c.replace(WB, WB + EM, 1)
print('3 ok')
with open(p, 'w') as f:
    f.write(c)
print('done')
