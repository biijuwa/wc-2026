import { getAuthenticatedUser } from './auth.js';
import { loadMyPredictions } from './predictions.js';

export const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8787' 
    : ''; 

// Helper to reliably get the active userId
async function getActiveUserId(user = null) {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('user');
    if (urlId) return urlId;
    
    // Fallback to authenticated user object
    if (!user) {
        try {
            const authUser = await getAuthenticatedUser();
            return authUser?.id;
        } catch (e) {
            return null;
        }
    }
    return user.id;
}

window.savePrediction = async function(matchId) {
    const card = document.querySelector(`[data-match-id="${matchId}"]`);
    if (!card) return;

    const score1 = parseInt(card.querySelector('.score-input-1')?.value);
    const score2 = parseInt(card.querySelector('.score-input-2')?.value);
    
    const penaltyCheckbox = document.getElementById(`penalty-check-${matchId}`);
    const isPenalty = penaltyCheckbox?.checked ? 1 : 0;
    
    const penScore1 = parseInt(card.querySelector('.pen-score-1')?.value || "0");
    const penScore2 = parseInt(card.querySelector('.pen-score-2')?.value || "0");
    
    const userId = await getActiveUserId();

    if (!userId) {
        alert("Error: User session not found.");
        return;
    }

    // Validation 1: Ensure fields are filled and not negative
    if (isNaN(score1) || isNaN(score2)) {
        alert("Please enter both scores.");
        return;
    }
    if (score1 < 0 || score2 < 0) {
        alert("Scores cannot be negative.");
        return;
    }

    // RULE: No 0-0 in full-time
    if (score1 === 0 && score2 === 0) {
        alert("Full-time score cannot be 0-0.");
        return;
    }

    // RULE: Handle Draws
    if (score1 === score2) {
        if (!penaltyCheckbox.checked) {
            alert("This match is a draw. You must include a penalty shootout prediction.");
            return;
        }
        if (isNaN(penScore1) || isNaN(penScore2) || penScore1 < 0 || penScore2 < 0) {
            alert("Please provide valid penalty scores.");
            return;
        }
        // RULE: No equal scores in penalties
        if (penScore1 === penScore2) {
            alert("Penalty scores cannot be equal; someone must win the shootout.");
            return;
        }
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/save-matchday-prediction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: parseInt(userId),
                matchId: parseInt(matchId), 
                score1, 
                score2,
                isPenalty,
                pen1: isPenalty ? penScore1 : null,
                pen2: isPenalty ? penScore2 : null
            })
        });

        if (response.ok) {
            alert('Prediction saved successfully!');
            loadMyPredictions(userId);
        } else {
            const errorData = await response.json();
            alert('Error: ' + (errorData.error || 'Failed to save.'));
        }
    } catch (error) {
        console.error("Save error:", error);
        alert('Failed to connect to the server.');
    }
};

window.checkPenalty = function(matchId) {
    const card = document.querySelector(`[data-match-id="${matchId}"]`);
    if (!card) return;

    // Use optional chaining and default to empty string if not found
    const s1 = card.querySelector('.score-input-1')?.value || "";
    const s2 = card.querySelector('.score-input-2')?.value || "";
    const pBox = document.getElementById(`penalty-box-${matchId}`);
    
    // Only proceed if pBox actually exists
    if (!pBox) return; 
    
    if (s1 !== "" && s2 !== "" && s1 === s2) {
        pBox.classList.remove('hidden');
    } else {
        pBox.classList.add('hidden');
        const checkbox = document.getElementById(`penalty-check-${matchId}`);
        if (checkbox) {
            checkbox.checked = false;
            window.togglePenaltyInputs(matchId);
        }
    }
};

window.togglePenaltyInputs = function(matchId) {
    const checkbox = document.getElementById(`penalty-check-${matchId}`);
    const inputDiv = document.getElementById(`penalty-inputs-${matchId}`);
    if (inputDiv && checkbox) {
        checkbox.checked ? inputDiv.classList.remove('hidden') : inputDiv.classList.add('hidden');
    }
};

export async function loadGlobalComponents() {
    const globalComponents = [
        { id: 'navbar-container', url: '/component/navbar.html' },
        { id: 'banner-container', url: '/component/banner.html' }
    ];

    for (const comp of globalComponents) {
        try {
            const res = await fetch(comp.url);
            if (res.ok) document.getElementById(comp.id).innerHTML = await res.text();
        } catch (err) { console.error(`Failed to load ${comp.url}`, err); }
    }

    try {
        const user = await getAuthenticatedUser();
        if (user && user.first_name) {
            const userId = await getActiveUserId(user);
            const nameEl = document.getElementById('user-name');
            
            if (nameEl) {
                nameEl.innerText = `Hello, ${user.first_name}`;
                nameEl.setAttribute('href', `/my_page.html?user=${userId}`);
            }
            
            document.getElementById('login-view')?.classList.add('hidden');
            document.getElementById('dashboard-view')?.classList.remove('hidden');
            document.getElementById('dashboard-widgets')?.classList.remove('hidden');
            document.getElementById('logout-btn')?.classList.remove('hidden');
            
            // Now correctly calling the imported function
            loadMyPredictions(userId);
            return user;
        }
    } catch (err) { console.warn("Auth check failed", err); }
    return null;
}