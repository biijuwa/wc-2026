export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const REDIRECT_URI = "http://127.0.0.1:8787/callback";
    const FRONTEND_URL = "http://127.0.0.1:3000";

    const corsHeaders = {
      "Access-Control-Allow-Origin": FRONTEND_URL,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Content-Type": "application/json",
    };

    // Handle Pre-flight OPTIONS request
    if (request.method === "OPTIONS")
      return new Response(null, { headers: corsHeaders });

    // 1. Initiate Login
    if (url.pathname === "/login") {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=email profile`;
      return Response.redirect(authUrl, 302);
    }

    // 2. Handle Google Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token)
        return new Response("Auth failed", { status: 400 });

      const userRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );
      const user = await userRes.json();

      await env.DB.prepare(
        "INSERT INTO users (google_id, email, first_name, last_name) VALUES (?, ?, ?, ?) ON CONFLICT(google_id) DO UPDATE SET first_name=excluded.first_name, last_name=excluded.last_name, email=excluded.email",
      )
        .bind(user.id, user.email, user.given_name, user.family_name)
        .run();

      const internalUser = await env.DB.prepare(
        "SELECT id FROM users WHERE google_id = ?",
      )
        .bind(user.id)
        .first();

      return Response.redirect(`${FRONTEND_URL}/?user=${internalUser.id}`, 302);
    }

    // 3. API Routes
    if (url.pathname === "/api/matches") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM knockout_matches ORDER BY match_id ASC",
      ).all();
      return Response.json(results, { headers: corsHeaders });
    }

    if (url.pathname === "/api/me") {
      const idParam = url.searchParams.get("id");
      const user = await env.DB.prepare(
        "SELECT id, first_name FROM users WHERE id = ? OR google_id = ?",
      )
        .bind(idParam, idParam)
        .first();
      return Response.json(user || { error: "Not found" }, {
        headers: corsHeaders,
      });
    }

    if (url.pathname === "/api/quiz") {
      if (request.method === "POST") {
        const data = await request.json();
        await env.DB.prepare(
          `
          INSERT OR REPLACE INTO tournament_quiz 
          (user_id, red_cards, golden_boot_goals, knockout_goals, winner_goals, penalties, hat_tricks, extra_time_matches, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+5 hours', '+45 minutes'))
        `,
        )
          .bind(
            data.userId,
            data.red_cards,
            data.golden_boot_goals,
            data.knockout_goals,
            data.winner_goals,
            data.penalties,
            data.hat_tricks,
            data.extra_time_matches,
          )
          .run();
        return Response.json({ status: "success" }, { headers: corsHeaders });
      } else {
        const userId = url.searchParams.get("userId");
        const prediction = await env.DB.prepare(
          "SELECT * FROM tournament_quiz WHERE user_id = ?",
        )
          .bind(userId)
          .first();
        return Response.json(prediction || {}, { headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/ranking") {
      const { results } = await env.DB.prepare(
        "SELECT id, first_name, last_name, points FROM users ORDER BY points DESC",
      ).all();
      return Response.json(results || [], { headers: corsHeaders });
    }

    if (url.pathname === "/api/knockout-matches") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM knockout_matches ORDER BY match_id ASC",
      ).all();
      return Response.json(results || [], { headers: corsHeaders });
    }

    if (url.pathname === "/api/save-predictions" && request.method === "POST") {
      const LOCKDOWN_TIME = new Date("2026-06-28T00:15:00").getTime();
      if (Date.now() >= LOCKDOWN_TIME)
        return Response.json(
          { error: "Locked" },
          { status: 403, headers: corsHeaders },
        );

      const { userId, predictions } = await request.json();
      const stmt = env.DB.prepare(
        "INSERT INTO user_full_knockout_prediction (user_id, match_id, winner_team, stage, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id, match_id) DO UPDATE SET winner_team = excluded.winner_team, updated_at = CURRENT_TIMESTAMP",
      );
      await env.DB.batch(
        predictions.map((p) => stmt.bind(userId, p.matchId, p.winner, p.stage)),
      );
      return Response.json({ status: "success" }, { headers: corsHeaders });
    }

    if (
      url.pathname === "/api/save-matchday-prediction" &&
      request.method === "POST"
    ) {
      const { userId, matchId, score1, score2, isPenalty, pen1, pen2 } =
        await request.json();

      // 1. Fetch match details to check the time
      const match = await env.DB.prepare(
        "SELECT match_date, match_time FROM knockout_matches WHERE match_id = ?",
      )
        .bind(matchId)
        .first();

      if (!match)
        return Response.json(
          { error: "Match not found" },
          { status: 404, headers: corsHeaders },
        );

      // 2. Validate Lock (30 minutes before kick-off)
      const kickOff = new Date(`${match.match_date}T${match.match_time}:00`);
      const now = new Date();
      const THIRTY_MINUTES = 30 * 60 * 1000;

      if (kickOff.getTime() - now.getTime() < THIRTY_MINUTES) {
        return Response.json(
          { error: "Match is locked for predictions" },
          { status: 403, headers: corsHeaders },
        );
      }

      // 3. If passed, proceed with update
      await env.DB.prepare(
        `
        INSERT OR REPLACE INTO matchday_prediction 
        (user_id, match_id, team_1_score, team_2_score, is_penalty, pen_team_1_score, pen_team_2_score) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
        .bind(userId, matchId, score1, score2, isPenalty, pen1, pen2)
        .run();

      return Response.json({ status: "success" }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/my-predictions") {
      const userId = url.searchParams.get("userId");
      const { results } = await env.DB.prepare(
        `
        SELECT 
            p.*, 
            m.team_1, 
            m.team_2,
            r.team_1_score AS res_t1,
            r.team_2_score AS res_t2,
            r.is_penalty AS res_is_pen,
            r.pen_team_1_score AS res_pen_t1,
            r.pen_team_2_score AS res_pen_t2
        FROM matchday_prediction p
        JOIN knockout_matches m ON p.match_id = m.match_id
        LEFT JOIN matchday_results r ON p.match_id = r.match_id
        WHERE p.user_id = ? 
        ORDER BY p.match_id DESC
      `,
      )
        .bind(parseInt(userId))
        .all();

      // Format results into a nested structure for the frontend
      const formatted = results.map((p) => ({
        ...p,
        result:
          p.res_t1 !== null
            ? {
                team_1_score: p.res_t1,
                team_2_score: p.res_t2,
                is_penalty: p.res_is_pen,
                pen_team_1_score: p.res_pen_t1,
                pen_team_2_score: p.res_pen_t2,
              }
            : null,
      }));
      return Response.json(formatted, { headers: corsHeaders });
    }

    if (url.pathname === "/api/full-tournament-prediction") {
      // GET: Fetch existing predictions
      if (request.method === "GET") {
        const userId = url.searchParams.get("userId");
        if (!userId)
          return Response.json(
            { error: "Missing userId" },
            { status: 400, headers: corsHeaders },
          );

        const { results } = await env.DB.prepare(
          "SELECT * FROM user_full_knockout_prediction WHERE user_id = ?",
        )
          .bind(userId)
          .all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // POST: Save predictions
      if (request.method === "POST") {
        // LOCKDOWN LOGIC:
        // First match is 2026-06-28T00:15:00
        // We lock 30 minutes before that.
        const FIRST_MATCH_TIME = new Date("2026-06-28T00:15:00").getTime();
        const THIRTY_MINUTES_MS = 30 * 60 * 1000;
        const LOCKDOWN_TIME = FIRST_MATCH_TIME - THIRTY_MINUTES_MS;

        if (Date.now() >= LOCKDOWN_TIME) {
          return Response.json(
            {
              error:
                "Predictions are locked! Submissions closed 30 minutes before the first match.",
            },
            { status: 403, headers: corsHeaders },
          );
        }

        const { userId, predictions } = await request.json();
        if (!userId || !Array.isArray(predictions)) {
          return Response.json(
            { error: "Invalid data" },
            { status: 400, headers: corsHeaders },
          );
        }

        // Using batch to handle multiple inserts efficiently
        const stmt = env.DB.prepare(`
      INSERT INTO user_full_knockout_prediction 
      (user_id, match_id, winner_team, stage, updated_at) 
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) 
      ON CONFLICT(user_id, match_id) 
      DO UPDATE SET winner_team = excluded.winner_team, updated_at = CURRENT_TIMESTAMP
    `);

        await env.DB.batch(
          predictions.map((p) =>
            stmt.bind(userId, p.matchId, p.winner, p.stage),
          ),
        );

        return Response.json({ status: "success" }, { headers: corsHeaders });
      }
    }
  },
};
