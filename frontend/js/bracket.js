import { API_BASE } from "./app.js";

let allMatches = [];
let predictions = {};

const MATCH_TREE = {
  89: [74, 77],
  90: [73, 75],
  91: [76, 78],
  92: [79, 80],
  93: [83, 84],
  94: [81, 82],
  95: [86, 88],
  96: [85, 87],
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  101: [97, 98],
  102: [99, 100],
  104: [101, 102],
  105: [101, 102],
};

const STAGE_MAP = {
  RO32: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
  RO16: [89, 90, 91, 92, 93, 94, 95, 96],
  QF: [97, 98, 99, 100],
  SF: [101, 102],
  "3rdPlace": [105],
  Final: [104],
};

const leftSideIds = [
  73, 74, 75, 77, 81, 82, 83, 84, 89, 90, 93, 94, 97, 98, 101,
];
const formatMatchDate = (d) => (d ? d.replace(/^[A-Za-z]+, /, "") : "");
const formatMatchTime = (t) => (t ? t.replace(/ [A-Za-z]+$/, "") : "");

// --- LOCKDOWN CONFIGURATION ---
// Set the official start time of Match #73 in ISO format
const MATCH_73_START_TIME = new Date("2026-06-28T13:00:00+05:45").getTime(); 
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function isLocked() {
  // Use Date.now() which is platform-agnostic
  const now = Date.now();
  const deadline = MATCH_73_START_TIME - THIRTY_MINUTES_MS;
  return now >= deadline;
}

// SYNC Helper: Get User ID
function getUserId() {
  const urlParams = new URLSearchParams(window.location.search);
  let userId = urlParams.get("user");
  if (userId) {
    localStorage.setItem("wc_user_id", userId);
    return userId;
  }
  return localStorage.getItem("wc_user_id");
}

export async function loadBracket() {
  try {
    const userId = getUserId();
    const [matchesRes, predsRes] = await Promise.all([
      fetch(`${API_BASE}/api/knockout-matches`),
      userId
        ? fetch(`${API_BASE}/api/full-tournament-prediction?userId=${userId}`)
        : Promise.resolve({ json: () => [] }),
    ]);

    const data = await matchesRes.json();
    let existing = userId && predsRes.ok ? await predsRes.json() : [];

    predictions = {};
    existing.forEach((p) => {
      predictions[p.match_id] = p.winner_team;
    });

    allMatches = data.map((m) => ({ ...m, match_id: parseInt(m.match_id) }));
    Object.entries(STAGE_MAP).forEach(([stage, ids]) => {
      ids.forEach((id) => {
        if (!allMatches.find((m) => m.match_id === id)) {
          allMatches.push({
            match_id: id,
            stage,
            team_1: "TBD",
            team_2: "TBD",
          });
        }
      });
    });

    renderBracket();
  } catch (err) {
    console.error("Error loading bracket:", err);
  }
}

function renderBracket() {
  const container = document.getElementById("bracket-content");

  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.gap = "4px";

  const stages = [
    "RO32_LEFT",
    "RO16_LEFT",
    "QF_LEFT",
    "SF_LEFT",
    "Final",
    "SF_RIGHT",
    "QF_RIGHT",
    "RO16_RIGHT",
    "RO32_RIGHT",
  ];

  container.innerHTML = stages
    .map((stage) => {
      const base = stage.replace("_LEFT", "").replace("_RIGHT", "");
      let matches = allMatches.filter((m) => {
        if (stage === "Final") return m.match_id === 104 || m.match_id === 105;
        if (m.stage !== base) return false;
        return stage.includes("_LEFT")
          ? leftSideIds.includes(m.match_id)
          : !leftSideIds.includes(m.match_id);
      });

      // Reorder: If stage is Final, sort so 104 appears before 105
      if (stage === "Final") {
        matches.sort((a, b) => a.match_id - b.match_id);
      }

      return `<div class="stage-column flex-1">
      <h3 class="text-[8px] font-bold text-slate-500 uppercase text-center">${stage === "Final" ? "Final/3rd" : base}</h3>
      ${matches
        .map((m) => {
          const parents = MATCH_TREE[m.match_id] || [];
          let t1 = (parents[0] && predictions[parents[0]]) || m.team_1;
          let t2 = (parents[1] && predictions[parents[1]]) || m.team_2;

          if (m.match_id === 105) {
            parents.forEach((pId, i) => {
              const winner = predictions[pId];
              const pT1 =
                predictions[MATCH_TREE[pId] ? MATCH_TREE[pId][0] : 0] || "TBD";
              const pT2 =
                predictions[MATCH_TREE[pId] ? MATCH_TREE[pId][1] : 0] || "TBD";

              if (winner && pT1 !== "TBD" && pT2 !== "TBD") {
                const loser = winner === pT1 ? pT2 : pT1;
                i === 0 ? (t1 = loser) : (t2 = loser);
              } else {
                i === 0 ? (t1 = "TBD") : (t2 = "TBD");
              }
            });
          }

          return `<div class="bracket-card-small mb-1 p-1 bg-slate-800 rounded border border-slate-700">
          <div class="text-[7px] text-slate-400 font-bold uppercase text-center">
            ${m.match_id === 104 ? "FINAL" : m.match_id === 105 ? "THIRD PLACE" : "Match #" + m.match_id}
          </div>
          <button class="w-full text-left truncate ${predictions[m.match_id] === t1 ? "text-blue-400 font-bold" : "text-slate-200"}" 
                  onclick="window.selectWinner(${m.match_id}, '${t1}')">◉ ${t1}</button>
          <button class="w-full text-left truncate ${predictions[m.match_id] === t2 ? "text-blue-400 font-bold" : "text-slate-200"}" 
                  onclick="window.selectWinner(${m.match_id}, '${t2}')">◉ ${t2}</button>
        </div>`;
        })
        .join("")}
    </div>`;
    })
    .join("");
}

window.selectWinner = (id, team) => {
  if (team !== "TBD") {
    predictions[id] = team;
    renderBracket();
  }
};

async function submitPredictions() {
  if (isLocked()) {
    alert("Predictions are locked! Submissions closed 30 minutes before Match #73.");
    return;
  }

  // Enforce Lockdown
  if (Date.now() >= getLockdownThreshold()) {
    console.warn("Lockdown check failed: Deadline passed.");
    alert(
      "Predictions are locked! Submissions closed 30 minutes before the first match.",
    );
    return;
  }

  const userId = getUserId();
  if (!userId) {
    console.error("Auth check failed: No User ID.");
    alert("Please log in to save predictions.");
    return;
  }

  const formatted = Object.entries(predictions).map(([matchId, winner]) => ({
    matchId: parseInt(matchId),
    winner,
    stage:
      allMatches.find((m) => m.match_id === parseInt(matchId))?.stage ||
      "UNKNOWN",
  }));

  try {
    const res = await fetch(`${API_BASE}/api/full-tournament-prediction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: parseInt(userId),
        predictions: formatted,
      }),
    });

    if (res.ok) alert("Bracket saved successfully!");
    else {
      const errorData = await res.json().catch(() => ({}));
      alert(errorData.error || "Failed to save.");
    }
  } catch (err) {
    alert("An error occurred while saving.");
  }
}

// UI Initialization
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("submit-bracket");
  if (btn) {
    if (isLocked()) {
      btn.disabled = true;
      btn.innerText = "Submissions Locked";
      btn.classList.add("opacity-50", "cursor-not-allowed");
    }
  }
});

