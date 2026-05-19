export default async function handler(req, res) {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return res.json({ emails: [], error: 'Gmail not configured' });
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: GMAIL_CLIENT_ID, client_secret: GMAIL_CLIENT_SECRET, refresh_token: GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token' }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Token refresh failed');
    const token = tokenData.access_token;
    const now = new Date();
    const after = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
    const before = Math.floor(new Date(now.getFullYear(), now.getMonth() + 2, 1).getTime() / 1000);
    const q = `(allstars OR "allstars sports" OR allstarssportsbar) after:${after} before:${before}`;
    const searchRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=15`, { headers: { Authorization: `Bearer ${token}` } });
    const { messages = [] } = await searchRes.json();
    if (!messages.length) return res.json({ emails: [] });
    const emails = await Promise.all(messages.slice(0, 12).map(async ({ id }) => {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${token}` } });
      const msg = await msgRes.json();
      const hdrs = msg.payload?.headers || [];
      const h = (n) => hdrs.find((x) => x.name === n)?.value || '';
      return { id, from: h('From'), subject: h('Subject') || '(no subject)', date: h('Date'), snippet: msg.snippet || '' };
    }));
    res.json({ emails });
  } catch (e) {
    res.status(500).json({ emails: [], error: e.message });
  }
}
