export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const REDIRECT_URI = 'http://127.0.0.1:8787/callback';
    const FRONTEND_URL = 'http://127.0.0.1:3000';

    const corsHeaders = {
      'Access-Control-Allow-Origin': FRONTEND_URL,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // 1. Initiate Login (Redirect to Google, not the frontend)
    if (url.pathname === '/login') {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=email profile`;
      return Response.redirect(authUrl, 302);
    }

    // 2. Handle Google Callback
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) return new Response("Auth failed", { status: 400 });

      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const user = await userRes.json();

      // Store user; using last_insert_rowid() or storing ID in a cookie is better for production
      await env.DB.prepare(
        "INSERT INTO users (google_id, email, first_name, last_name, avatar_url) VALUES (?, ?, ?, ?, ?) ON CONFLICT(google_id) DO UPDATE SET first_name=excluded.first_name, email=excluded.email"
      ).bind(user.id || null, user.email || null, user.given_name || null, user.family_name || null, user.picture || null).run();

      // Redirect to frontend (with a URL param for user identification if needed)
      return Response.redirect(`${FRONTEND_URL}/?user=${user.id}`, 302);
    }

    // 3. API Routes
    if (url.pathname === '/api/matches') {
      const { results } = await env.DB.prepare("SELECT * FROM matches").all();
      return Response.json(results, { headers: corsHeaders });
    }

    if (url.pathname === '/api/me') {
      const userId = url.searchParams.get('id');
      const user = await env.DB.prepare("SELECT first_name FROM users WHERE google_id = ?").bind(userId).first();
      return Response.json(user || { error: "Not found" }, { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404 });
  }
};