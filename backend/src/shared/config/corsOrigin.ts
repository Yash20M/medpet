/** CLIENT_URL may be "*" or a comma-separated list of allowed browser origins. */
export function corsOrigin(): string | string[] {
  const raw = process.env.CLIENT_URL?.trim();
  if (!raw || raw === '*') return '*';
  const list = raw.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  return list.length === 1 ? list[0] : list;
}
