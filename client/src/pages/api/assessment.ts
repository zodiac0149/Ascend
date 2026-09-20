import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5001';

/**
 * Next.js API proxy for all /api/assessment/* endpoints.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path, ...query } = req.query;
  const subPath = Array.isArray(path) ? path.join('/') : (path ?? '');

  const targetUrl = `${BACKEND}/api/assessment/${subPath}`;

  try {
    const response = await axios({
      method: req.method as 'GET' | 'POST',
      url: targetUrl,
      params: req.method === 'GET' ? query : undefined,
      data: req.method !== 'GET' ? req.body : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      timeout: 60_000,
    });
    return res.status(response.status).json(response.data);
  } catch (err) {
    const status = axios.isAxiosError(err) ? (err.response?.status ?? 500) : 500;
    const data = axios.isAxiosError(err) ? err.response?.data : { error: 'Proxy error' };
    return res.status(status).json(data);
  }
}
