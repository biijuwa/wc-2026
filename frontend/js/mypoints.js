import { API_BASE } from './app.js';

export async function loadUserPoints(userId) {
    const pointsEl = document.getElementById("user-total-points");
    const rankEl = document.getElementById("user-rank");
    
    try {
        const res = await fetch(`${API_BASE}/api/ranking`);
        const users = await res.json();
        
        // Find user by matching ID
        const userIndex = users.findIndex(u => u.id == userId);
        
        if (userIndex !== -1) {
            const user = users[userIndex];
            if (pointsEl) pointsEl.innerText = user.points || 0;
            if (rankEl) rankEl.innerText = `#${userIndex + 1}`;
        }
    } catch (err) {
        console.error("Error loading points:", err);
    }
}