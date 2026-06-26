import { loadGlobalComponents } from "./app.js";
import { loadRanking, loadFullRanking } from "./ranking.js";
import { initQuizHandler } from "./quiz.js";
import { loadMyPredictions } from "./predictions.js";
import { loadBracket } from "./bracket.js";
import { initMatchday } from "./matchday.js";
import { loadUserPoints } from "./mypoints.js";

async function loadComponent(id, url) {
  const container = document.getElementById(id);
  if (!container) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);
    container.innerHTML = await res.text();
  } catch (err) {
    console.error(`Failed to load ${url}:`, err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Get user session 
  const user = await loadGlobalComponents(); 

  // If user is null, we stop the component loading
  if (!user || !user.id) {
    console.warn("User not authenticated. Skipping component load.");
    return;
  }

  const tasks = [];

  // --- NEW: Load Points Header ---
  if (document.getElementById("mypoints-container")) {
    tasks.push(
      loadComponent("mypoints-container", "/component/mypoints.html")
        .then(() => loadUserPoints(user.id))
    );
  }

  // 2. Load My Predictions
  if (document.getElementById("my-predictions-container")) {
    tasks.push(
      loadComponent("my-predictions-container", "/component/my_predictions.html")
        .then(() => loadMyPredictions(user.id))
    );
  }
  
  // 3. Load other components
  if (document.getElementById("matchday-container")) {
    tasks.push(loadComponent("matchday-container", "/component/matchday.html").then(initMatchday));
  }

  if (document.getElementById("knockout-prediction-container")) {
    tasks.push(loadComponent("knockout-prediction-container", "/component/knockout_bracket.html").then(loadBracket));
  }

  if (document.getElementById("football-quiz-container")) {
    tasks.push(loadComponent("football-quiz-container", "/component/football_quiz.html").then(initQuizHandler));
  }

  if (document.getElementById("full-ranking-container")) {
    tasks.push(loadComponent("full-ranking-container", "/component/full_ranking.html").then(loadFullRanking));
  }

  if (document.getElementById("prediction-ranking-container")) {
    tasks.push(loadComponent("prediction-ranking-container", "/component/prediction_ranking.html").then(loadRanking));
  }

  // 4. Run all loads simultaneously
  await Promise.all(tasks);
});