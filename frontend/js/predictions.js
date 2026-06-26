import { getTeamDetails } from "./matchday.js";
import { API_BASE } from "./app.js";

let currentPredPage = 0;
const PRED_ITEMS_PER_PAGE = 5;

export async function loadMyPredictions(userId) {
    const container = document.getElementById("my-predictions-list");
    const countEl = document.getElementById("prediction-count");
    if (!container) return;

    const finalUserId = userId || new URLSearchParams(window.location.search).get("user");
    if (!finalUserId) {
        container.innerHTML = '<p class="text-slate-400 text-sm italic">User not identified.</p>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/my-predictions?userId=${finalUserId}`);
        const data = await res.json();
        
        window.myPredictionsData = data; 
        if (countEl) countEl.innerText = `${data.length} Prediction${data.length === 1 ? '' : 's'}`;
        
        renderPredictionPage(0);
    } catch (err) {
        container.innerHTML = '<p class="text-red-400 text-sm text-center">Unable to load predictions.</p>';
    }
}

window.renderPredictionPage = (page) => {
    const container = document.getElementById("my-predictions-list");
    const data = window.myPredictionsData || [];
    currentPredPage = page;
    
    const start = currentPredPage * PRED_ITEMS_PER_PAGE;
    const paginated = data.slice(start, start + PRED_ITEMS_PER_PAGE);

    if (data.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-sm italic text-center py-4">No predictions saved yet.</p>';
        return;
    }

    const html = paginated.map((p) => {
        const t1 = getTeamDetails(p.team_1 || "TBD");
        const t2 = getTeamDetails(p.team_2 || "TBD");
        const p1Score = p.pen_team_1_score ?? 0;
        const p2Score = p.pen_team_2_score ?? 0;

        // Validation logic
        let statusText = "Pending";
        let statusClass = "text-slate-400";
        if (p.result) {
            const isCorrect = p.team_1_score === p.result.team_1_score && 
                              p.team_2_score === p.result.team_2_score;
            statusText = isCorrect ? "Correct" : "Wrong";
            statusClass = isCorrect ? "text-emerald-600" : "text-red-500";
        }

        return `
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex justify-between items-center mb-4">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Match #${p.match_id}</span>
                <span class="text-[10px] font-bold uppercase ${statusClass}">Prediction: ${statusText}</span>
            </div>

            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3 flex-1">
                    ${t1.url ? `<img src="${t1.url}" class="w-8 h-5 rounded shadow-sm object-cover">` : ""}
                    <span class="font-bold text-sm uppercase text-slate-800">${t1.code}</span>
                </div>

                <div class="flex flex-col items-center gap-2 shrink-0">
                    <div class="flex items-center gap-2">
                        <span class="w-8 text-center font-bold text-lg text-slate-800">${p.team_1_score}</span>
                        <span class="text-[10px] font-bold text-slate-300">VS</span>
                        <span class="w-8 text-center font-bold text-lg text-slate-800">${p.team_2_score}</span>
                    </div>
                    ${p.is_penalty ? `
                        <div class="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded">
                            <span>P:</span><span>${p1Score} - ${p2Score}</span>
                        </div>` : ""}
                </div>

                <div class="flex items-center justify-end gap-3 flex-1">
                    <span class="font-bold text-sm uppercase text-slate-800">${t2.code}</span>
                    ${t2.url ? `<img src="${t2.url}" class="w-8 h-5 rounded shadow-sm object-cover">` : ""}
                </div>
            </div>

            ${p.updated_at ? `<div class="mt-4 pt-3 border-t border-slate-50 text-[9px] text-slate-400">Predicted at: ${new Date(p.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>` : ""}
        </div>`;
    }).join("");

    const totalPages = Math.ceil(data.length / PRED_ITEMS_PER_PAGE);
    const paginationButtons = Array.from({ length: totalPages }, (_, i) => i)
        .map(pageIndex => `
            <button onclick="renderPredictionPage(${pageIndex})" 
                class="px-3 py-1 text-sm font-bold rounded border transition ${
                    pageIndex === currentPredPage 
                    ? 'bg-[#0A7C6E] text-white border-[#0A7C6E]' 
                    : 'bg-white text-[#0A7C6E] border-[#0A7C6E]'
                }">
                ${pageIndex + 1}
            </button>
        `).join('');

    container.innerHTML = html + (totalPages > 1 ? `<div class="flex justify-center flex-wrap gap-2 mt-6">${paginationButtons}</div>` : "");
};