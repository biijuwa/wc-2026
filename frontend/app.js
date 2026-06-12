// frontend/app.js

// Determine the API base URL
// In development, the worker runs on port 8787. 
// In production, the worker shares the same origin as the frontend.
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8787' 
    : ''; 

async function loadMatches() {
    try {
        const response = await fetch(`${API_BASE}/api/matches`);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const matches = await response.json();
        const list = document.getElementById('matches-list');
        
        // Clear previous content
        list.innerHTML = '';

        // Generate HTML for each match
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'match-card';
            div.innerHTML = `
                <h3>${m.home_label || 'TBD'} vs ${m.away_label || 'TBD'}</h3>
                <p><strong>Date:</strong> ${m.match_date} | <strong>Venue:</strong> ${m.stadium_name}</p>
                <small>Stage: ${m.stage}</small>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        console.error("Failed to load matches:", err);
        const list = document.getElementById('matches-list');
        list.innerHTML = `<p style="color: red;">Error loading matches. Ensure the worker is running.</p>`;
    }
}

// Call the function on load
document.addEventListener('DOMContentLoaded', loadMatches);