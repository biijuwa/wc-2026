export async function initQuizHandler() {
    const form = document.getElementById('quiz-form');
    if (!form) return;

    // Get wrapper elements
    const container = document.getElementById('quiz-container');
    const content = document.getElementById('collapsible-content');
    const viewMoreBtn = document.getElementById('view-more-btn');

    const userId = localStorage.getItem('userId');

    // Create status note element
    let statusNote = document.getElementById('status-note');
    if (!statusNote) {
        statusNote = document.createElement('div');
        statusNote.id = 'status-note';
        statusNote.className = 'hidden text-center p-2 mb-4 bg-amber-50 text-amber-700 rounded-lg text-xs border border-amber-200';
        form.prepend(statusNote);
    }

    // 1. Load existing predictions
    if (userId) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/quiz?userId=${userId}`);
            const data = await res.json();

            if (data && Object.keys(data).length > 0) {
                statusNote.classList.remove('hidden');
                statusNote.innerText = 'Predictions submitted. You may update them for 24 hours.';

                Object.keys(data).forEach(key => {
                    const input = form.querySelector(`input[name="${key}"][value="${data[key]}"]`);
                    if (input) input.checked = true;
                });

                // 2. Lock logic & Collapsible UI
                if (data.updated_at) {
                    const lastSub = new Date(data.updated_at).getTime();
                    const now = new Date().getTime();
                    const twentyFourHours = 24 * 60 * 60 * 1000;

                    if (now - lastSub > twentyFourHours) {
                        // Collapse the form using layout-preserving classes
                        content.classList.add('invisible', 'absolute', 'opacity-0');
                        viewMoreBtn.classList.remove('hidden');
                        
                        // Update UI state
                        statusNote.innerText = "Predictions locked (24h cooldown passed).";
                    }
                }
            }
        } catch (err) { console.error("Error loading predictions:", err); }
    }

    // Toggle logic for "View My Predictions"
    if (viewMoreBtn) {
        viewMoreBtn.addEventListener('click', () => {
            const isHidden = content.classList.contains('invisible');
            if (isHidden) {
                content.classList.remove('invisible', 'absolute', 'opacity-0');
                viewMoreBtn.innerText = "Hide Predictions";
            } else {
                content.classList.add('invisible', 'absolute', 'opacity-0');
                viewMoreBtn.innerText = "View My Predictions";
            }
        });
    }

    // 3. Handle Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        data.userId = userId;

        const res = await fetch('http://127.0.0.1:8787/api/quiz', { 
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            alert('Predictions saved successfully!');
            window.location.reload();
        } else {
            const error = await res.json();
            alert(error.error || 'Failed to save. Please try again.');
        }
    });
}