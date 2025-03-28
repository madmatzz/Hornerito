import { handleUpdate } from '../../lib/bot';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await handleUpdate(req.body);
    res.status(200).json({ message: 'OK' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 