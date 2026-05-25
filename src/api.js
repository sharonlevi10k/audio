const ENDPOINT = 'https://backapi.pfabot.com/api/dashboard/transcribe';

export async function transcribe(blob, filename, jwt) {
  const fd = new FormData();
  fd.append('file', blob, filename);

  const headers = {};
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: fd,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {}
    throw new Error(`שגיאת שרת ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
  }

  return res.json(); // { language, text }
}
