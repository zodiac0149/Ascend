import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export const config = { api: { bodyParser: false } };

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5001';

/**
 * Next.js API proxy for resume upload.
 * Pipes the raw multipart request body directly to the Express backend.
 * This avoids needing formidable on the client side.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Collect the raw body chunks
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const response = await axios.post(`${BACKEND}/api/resume/analyze`, rawBody, {
      headers: {
        'Content-Type': req.headers['content-type'] ?? 'multipart/form-data',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      timeout: 60_000,
    });
    return res.status(200).json(response.data);
  } catch (err) {
    const status = axios.isAxiosError(err) ? (err.response?.status ?? 500) : 500;
    const data = axios.isAxiosError(err) ? err.response?.data : { error: 'Proxy error' };
    return res.status(status).json(data);
  }
}
