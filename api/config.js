// ========================================================================
// CALENDEY — Vercel Serverless Function: Environment Configuration
// Melindungi kredensial agar tidak di-hardcode di kode JavaScript frontend
// ========================================================================

export default function handler(req, res) {
  // Hanya melayani GET request
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set Cache Control untuk performa instan (cache di CDN Vercel 1 jam)
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  // Baca kredensial dari Vercel Environment Variables
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
}
