import { API_BASE } from "./app.js";

// Add your team mapping here
const TEAM_MAP = {
  1: { name: "Mexico", code: "MEX" },
  2: { name: "South Africa", code: "RSA" },
  3: { name: "South Korea", code: "KOR" },
  4: { name: "Czech Republic", code: "CZE" },
  5: { name: "Canada", code: "CAN" },
  6: { name: "Bosnia and Herzegovina", code: "BIH" },
  7: { name: "Qatar", code: "QAT" },
  8: { name: "Switzerland", code: "SUI" },
  9: { name: "Brazil", code: "BRA" },
  10: { name: "Morocco", code: "MAR" },
  11: { name: "Haiti", code: "HAI" },
  12: { name: "Scotland", code: "SCO" },
  13: { name: "United States", code: "USA" },
  14: { name: "Paraguay", code: "PAR" },
  15: { name: "Australia", code: "AUS" },
  16: { name: "Turkey", code: "TUR" },
  17: { name: "Germany", code: "GER" },
  18: { name: "Curaçao", code: "CUW" },
  19: { name: "Ivory Coast", code: "CIV" },
  20: { name: "Ecuador", code: "ECU" },
  21: { name: "Netherlands", code: "NED" },
  22: { name: "Japan", code: "JPN" },
  23: { name: "Sweden", code: "SWE" },
  24: { name: "Tunisia", code: "TUN" },
  25: { name: "Belgium", code: "BEL" },
  26: { name: "Egypt", code: "EGY" },
  27: { name: "Iran", code: "IRN" },
  28: { name: "New Zealand", code: "NZL" },
  29: { name: "Spain", code: "ESP" },
  30: { name: "Cape Verde", code: "CPV" },
  31: { name: "Saudi Arabia", code: "KSA" },
  32: { name: "Uruguay", code: "URU" },
  33: { name: "France", code: "FRA" },
  34: { name: "Senegal", code: "SEN" },
  35: { name: "Iraq", code: "IRQ" },
  36: { name: "Norway", code: "NOR" },
  37: { name: "Argentina", code: "ARG" },
  38: { name: "Algeria", code: "ALG" },
  39: { name: "Austria", code: "AUT" },
  40: { name: "Jordan", code: "JOR" },
  41: { name: "Portugal", code: "POR" },
  42: { name: "DR Congo", code: "CON" },
  43: { name: "Uzbekistan", code: "UZB" },
  44: { name: "Colombia", code: "COL" },
  45: { name: "England", code: "ENG" },
  46: { name: "Croatia", code: "CRO" },
  47: { name: "Ghana", code: "GHA" },
  48: { name: "Panama", code: "PAN" },
};

export function getTeamDetails(name) {
  const entry = Object.entries(TEAM_MAP).find(
    ([id, data]) => data.name === name,
  );
  if (!entry)
    return {
      url: null,
      code: name ? name.substring(0, 3).toUpperCase() : "TBD",
    };
  return {
    url: `https://raw.githubusercontent.com/biijuwa/wc-2026/main/frontend/assests/flags/${entry[0]}.png`,
    code: entry[1].code,
  };
}

// Helper to check 30m lock
function isLocked(matchDate, matchTime) {
  const now = new Date();
  const kickOff = new Date(`${matchDate}T${matchTime}:00`);
  return (kickOff.getTime() - now.getTime()) < (30 * 60 * 1000);
}

window.currentPage = 0;
const ITEMS_PER_PAGE = 5;

export async function initMatchday() {
  const list = document.getElementById("matchday-list");
  if (!list) return;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("user");
    const [matchesRes, predsRes] = await Promise.all([
      fetch(`${API_BASE}/api/matches`),
      userId
        ? fetch(`${API_BASE}/api/my-predictions?userId=${userId}`)
        : Promise.resolve({ json: () => [] }),
    ]);

    const matches = await matchesRes.json();
    const existingPredictions = userId ? await predsRes.json() : [];
    const today = new Date().toISOString().split("T")[0];
    const filtered = matches.filter(
      (m) =>
        (m.match_date || m.MATCH_DATE || "").split(" ")[0].split("T")[0] ===
        today,
    );

    // Global helper for pagination
    window.renderMatchPage = (page) => {
      currentPage = page;
      const start = currentPage * ITEMS_PER_PAGE;
      const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);

      const html = paginated
        .map((m) => {
          const matchId = String(m.match_id || m.MATCH_ID);
          const pred = existingPredictions.find(
            (p) => String(p.match_id) === matchId,
          );
          const t1 = getTeamDetails(m.team_1 || m.TEAM_1);
          const t2 = getTeamDetails(m.team_2 || m.TEAM_2);
          const time =
            (m.match_time || m.MATCH_TIME || "").substring(0, 5) || "TBD";

          return `
<div class="p-4 bg-white border border-gray-100 rounded-xl shadow-sm w-full mb-4" data-match-id="${matchId}">
    <div class="flex justify-between items-center mb-3">
        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Match #${matchId}</span>
        <span class="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase tracking-wider">Kick-off: ${time}</span>
    </div>
    
    <div class="text-center mb-2">
        <span class="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Full Time Score</span>
    </div>

    <div class="flex items-center justify-between gap-4 mb-4">
        <div class="flex items-center gap-3 flex-1">
            ${t1.url ? `<img src="${t1.url}" class="w-8 h-5 rounded shadow-sm object-cover">` : ""}
            <span class="font-bold text-sm uppercase text-gray-800">${t1.code}</span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <input type="number" min="0" value="${pred?.team_1_score ?? ""}" class="score-input-1 w-12 text-center border border-gray-200 rounded-lg py-1.5 text-base font-bold outline-none" oninput="checkPenalty('${matchId}')">
            <span class="text-xs font-bold text-gray-400">vs</span>
            <input type="number" min="0" value="${pred?.team_2_score ?? ""}" class="score-input-2 w-12 text-center border border-gray-200 rounded-lg py-1.5 text-base font-bold outline-none" oninput="checkPenalty('${matchId}')">
        </div>

        <div class="flex items-center justify-end gap-3 flex-1">
            <span class="font-bold text-sm uppercase text-gray-800">${t2.code}</span>
            ${t2.url ? `<img src="${t2.url}" class="w-8 h-5 rounded shadow-sm object-cover">` : ""}
        </div>
    </div>

    <div id="penalty-box-${matchId}" class="${pred?.is_penalty || (pred?.team_1_score === pred?.team_2_score && pred?.team_1_score !== undefined) ? "" : "hidden"} pt-3 border-t border-gray-100">
        <label class="flex flex-col items-center gap-2 cursor-pointer mb-3">
            <div class="flex items-center gap-2">
                <input type="checkbox" id="penalty-check-${matchId}" ${pred?.is_penalty ? "checked" : ""} onchange="window.togglePenaltyInputs('${matchId}')" class="w-4 h-4 text-red-600">
                <span class="text-[10px] font-bold text-red-600 uppercase tracking-widest">Penalty Shootout Score?</span>
            </div>
            
            <div id="penalty-inputs-${matchId}" class="${pred?.is_penalty ? "flex" : "hidden"} items-center justify-center gap-3">
                <input type="number" min="0" placeholder="0" value="${pred?.pen_team_1_score ?? ""}" class="pen-score-1 w-12 text-center border border-red-200 bg-red-50 rounded-lg py-1 text-sm font-bold text-red-700">
                <span class="text-xs font-bold text-gray-400">P</span>
                <input type="number" min="0" placeholder="0" value="${pred?.pen_team_2_score ?? ""}" class="pen-score-2 w-12 text-center border border-red-200 bg-red-50 rounded-lg py-1 text-sm font-bold text-red-700">
            </div>
        </label>
    </div>
    
    <button onclick="window.savePrediction('${matchId}')" class="w-full mt-3 ${pred ? "bg-emerald-600" : "bg-blue-600"} text-white text-sm font-bold py-2.5 rounded-xl transition uppercase tracking-wide">
        ${pred ? "Update Prediction" : "Submit Prediction"}
    </button>
</div>`;
        })
        .join("");

      const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
      const nav =
        totalPages > 1
          ? `
        <div class="flex justify-center gap-4 mt-2 mb-4">
            <button onclick="renderMatchPage(${currentPage - 1})" ${currentPage === 0 ? 'disabled class="opacity-30"' : 'class="text-blue-600 font-bold"'}>Prev</button>
            <span class="text-xs font-bold">${currentPage + 1} / ${totalPages}</span>
            <button onclick="renderMatchPage(${currentPage + 1})" ${currentPage >= totalPages - 1 ? 'disabled class="opacity-30"' : 'class="text-blue-600 font-bold"'}>Next</button>
        </div>`
          : "";

      list.innerHTML = html + nav;
    };

    window.renderMatchPage(0);
  } catch (err) {
    console.error(err);
    list.innerHTML =
      '<p class="text-xs text-red-500 italic text-center py-2">Failed to load matches.</p>';
  }
}
