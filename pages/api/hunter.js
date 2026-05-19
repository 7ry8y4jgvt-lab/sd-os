export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'No domain' });
  const key = process.env.HUNTER_API_KEY;
  const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${key}&limit=5`;
  const r = await fetch(url);
  const data = await r.json();
  res.status(200).json(data);
}
