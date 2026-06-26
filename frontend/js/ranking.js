import { API_BASE } from './app.js';

let allUsers = []; 
let currentPage = 1;
const itemsPerPage = 10;

// --- 1. Top 5 Sidebar Load ---
export async function loadRanking() {
    const list = document.getElementById('ranking-list');
    const viewFullLink = document.getElementById('view-full-ranking');
    if (!list) return;

    try {
        const res = await fetch(`${API_BASE}/api/ranking`);
        const users = await res.json();
        const top5 = users.slice(0, 5); 
        
        list.innerHTML = top5.map((user, index) => `
            <li class="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <span class="font-medium text-slate-700">#${index + 1} ${user.first_name}</span>
                <span class="font-bold text-[#0A7C6E]">${user.points} pts</span>
            </li>
        `).join('');

        if (viewFullLink) viewFullLink.classList.toggle('hidden', users.length <= 5);
    } catch (err) { 
        list.innerHTML = '<li class="text-red-400 text-sm py-2">Unable to load rankings.</li>';
    }
}

// --- 2. Full Page Ranking with Numeric Pagination ---
export async function loadFullRanking() {
    const tbody = document.getElementById('full-ranking-body');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/api/ranking`);
        allUsers = await res.json(); 

        if (!Array.isArray(allUsers) || allUsers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400">No data available.</td></tr>`;
            return;
        }

        renderPage(1); // Start on page 1
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-red-400">Error loading data.</td></tr>`;
    }
}

// Render specific page
function renderPage(page) {
    currentPage = page;
    const tbody = document.getElementById('full-ranking-body');
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = allUsers.slice(start, end);

    tbody.innerHTML = pageData.map((user, index) => `
        <tr class="border-b border-slate-50 hover:bg-slate-50">
            <td class="py-4 px-2 font-bold text-slate-400">#${start + index + 1}</td>
            <td class="py-4 px-2 font-semibold text-slate-700">
                ${user.first_name} ${user.last_name || ''}
            </td>
            <td class="py-4 px-2 text-right font-bold text-[#0A7C6E]">${user.points}</td>
        </tr>
    `).join('');

    renderPagination();
}

// Render pagination buttons
function renderPagination() {
    const container = document.getElementById('pagination-controls');
    if (!container) return;
    
    const totalPages = Math.ceil(allUsers.length / itemsPerPage);
    
    container.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1)
        .map(page => `
            <button onclick="window.renderPage(${page})" 
                class="px-3 py-1 text-sm font-bold rounded border ${page === currentPage ? 'bg-[#0A7C6E] text-white' : 'bg-white text-[#0A7C6E] border-[#0A7C6E]'} transition">
                ${page}
            </button>
        `).join('');
}

// Expose to window for onclick handlers
window.renderPage = renderPage;