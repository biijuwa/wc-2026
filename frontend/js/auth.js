// js/auth.js

/**
 * Fetches the user data if a valid session exists.
 * Returns the user object or null if not authenticated.
 */
export async function getAuthenticatedUser() {
    const userId = localStorage.getItem('userId') || new URLSearchParams(window.location.search).get('user');
    
    if (!userId) return null;

    try {
        localStorage.setItem('userId', userId);
        const res = await fetch(`http://127.0.0.1:8787/api/me?id=${userId}`);
        
        if (!res.ok) {
            localStorage.removeItem('userId'); // Clear invalid session
            return null;
        }

        const user = await res.json();
        return user.first_name ? user : null;
    } catch (err) {
        console.error("Auth check failed:", err);
        return null;
    }
}

/**
 * Simply logs the user out and resets the state.
 */
export function logout() {
    localStorage.removeItem('userId');
    window.location.href = '/';
}
window.logout = logout;