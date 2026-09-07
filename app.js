// ===============================
//  LOTTO ANALYTICS ENGINE
// ===============================

// ---------- WEIGHTS ----------
const WEIGHTS = {
  conservative: { structure: 0.35, frequency: 0.30, recency: 0.20, pairs: 0.15 },
  hybrid:       { structure: 0.25, frequency: 0.25, recency: 0.25, pairs: 0.25 },
  aggressive:   { structure: 0.15, frequency: 0.35, recency: 0.30, pairs: 0.20 }
};

// ===============================
//  GLOBAL FREQUENCY CACHE
// ===============================
let frequencyCache = {};

// ===============================
//  STRUCTURAL SCORING
// ===============================

function structuralOddEven(prediction) {
  const odd = prediction.filter(n => n % 2 !== 0).length;
  const even = prediction.length - odd;
  return 1 - Math.abs(odd - even) / prediction.length;
}

function structuralLowHigh(prediction) {
  const low = prediction.filter(n => n <= 24).length;
  const high = prediction.length - low;
  return 1 - Math.abs(low - high) / prediction.length;
}

function structuralDecades(prediction) {
  const buckets = [0, 0, 0, 0, 0];
  prediction.forEach(n => buckets[Math.floor(n / 10)]++);
  const ideal = prediction.length / 5;
  const deviation = buckets.reduce((sum, b) => sum + Math.abs(b - ideal), 0);
  return 1 - deviation / prediction.length;
}

function structuralPrimes(prediction) {
  const primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47];
  const count = prediction.filter(n => primes.includes(n)).length;
  const ideal = prediction.length * 0.3;
  return 1 - Math.abs(count - ideal) / prediction.length;
}

function structuralSum(prediction) {
  const sum = prediction.reduce((a,b) => a + b, 0);
  if (sum < 100 || sum > 180) return 0;
  return 1 - Math.abs(sum - 140) / 140;
}

function structuralPairs(prediction) {
  let pairs = 0;
  const sorted = [...prediction].sort((a,b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i-1] + 1) pairs++;
  }
  return 1 - pairs / prediction.length;
}

function structuralScore(n) {
  const decade = Math.floor(n / 10);
  const primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47];
  let score = 0;

  score += (decade >= 0 && decade <= 4) ? 0.25 : 0;
  score += primes.includes(n) ? 0.25 : 0;
  score += (n >= 10 && n <= 39) ? 0.25 : 0;
  score += (n !== 1 && n !== 49) ? 0.25 : 0;

  return score;
}

// ===============================
//  FREQUENCY / RECENCY / PAIR SCORING
// ===============================

function frequencyScore(n, draws) {
  const count = draws.reduce((sum, d) => sum + (d.numbers.includes(n) ? 1 : 0), 0);
  return count / draws.length;
}

function recencyScore(n, draws) {
  for (let i = draws.length - 1; i >= 0; i--) {
    if (draws[i].numbers.includes(n)) return 1 - i / draws.length;
  }
  return 0;
}

function pairScore(n, draws) {
  let score = 0;
  draws.forEach(d => {
    const sorted = [...d.numbers].sort((a,b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i-1] + 1 && (sorted[i] === n || sorted[i-1] === n)) score++;
    }
  });
  return score / draws.length;
}

// ===============================
//  FEATURE COMPUTATION
// ===============================

function computeFeatures(n, draws) {
  return {
    structure: structuralScore(n),
    frequency: frequencyScore(n, draws),
    recency: recencyScore(n, draws),
    pairs: pairScore(n, draws)
  };
}

// ===============================
//  PREDICTION ENGINE
// ===============================

function generateRankedScores(draws, mode = "hybrid") {
  const weights = WEIGHTS[mode] || WEIGHTS.hybrid;
  const numbers = [...Array(49).keys()].map(i => i + 1);

  const scores = numbers.map(n => {
    const f = computeFeatures(n, draws);
    const score =
      weights.structure * f.structure +
      weights.frequency * f.frequency +
      weights.recency   * f.recency +
      weights.pairs     * f.pairs;

    return { number: n, score };
  });

  return scores.sort((a,b) => b.score - a.score);
}

// ===============================
//  STRUCTURAL BREAKDOWN
// ===============================

function structuralBreakdown(prediction) {
  return {
    oddEven: structuralOddEven(prediction),
    lowHigh: structuralLowHigh(prediction),
    decades: structuralDecades(prediction),
    primes: structuralPrimes(prediction),
    sum: structuralSum(prediction),
    pairs: structuralPairs(prediction)
  };
}

// ===============================
//  HOT / COLD CLASSIFICATION
// ===============================

function classifyFrequency(freq, number) {
  const values = Object.values(freq);
  const max = Math.max(...values);
  const min = Math.min(...values);

  const f = freq[number];

  if (f >= max * 0.75) return "hot";
  if (f <= min * 1.25) return "cold";
  return "warm";
}

// ===============================
//  FREQUENCY TABLE
// ===============================

function renderFrequencyTable(freq) {
  const container = document.getElementById("frequency-table");
  if (!container) return;

  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "freq-table";

  for (let i = 1; i <= 49; i++) {
    const row = document.createElement("tr");
    const numCell = document.createElement("td");
    const freqCell = document.createElement("td");

    numCell.textContent = i;
    freqCell.textContent = freq[i];

    row.appendChild(numCell);
    row.appendChild(freqCell);
    table.appendChild(row);
  }

  container.appendChild(table);
}

// ===============================
//  FREQUENCY CHART
// ===============================

function renderFrequencyChart(freq) {
  const canvas = document.getElementById("frequencyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = Array.from({ length: 49 }, (_, i) => i + 1);
  const data = labels.map(i => freq[i]);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Frequency",
        data,
        backgroundColor: "rgba(0, 99, 255, 0.5)"
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// ===============================
//  RECENCY CHART
// ===============================

function buildRecencyChart(draws) {
  const canvas = document.getElementById("recencyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = Array.from({ length: 49 }, (_, i) => i + 1);

  const data = labels.map(n => {
    for (let i = draws.length - 1; i >= 0; i--) {
      if (draws[i].numbers.includes(n)) {
        return draws.length - i;
      }
    }
    return 0;
  });

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Recency (draws since last hit)",
        data,
        backgroundColor: "rgba(255, 99, 132, 0.5)"
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// ===============================
//  RENDER RANKED SETS (2–10)
// ===============================

function renderRankedSets(scores) {
  const container = document.getElementById("ranked-sets");
  if (!container) return;

  container.innerHTML = "";

  for (let setIndex = 1; setIndex < 10; setIndex++) {
    const start = setIndex * 6;
    const end = Math.min(start + 6, scores.length);
    const setNumbers = scores.slice(start, end).map(s => s.number);

    if (setNumbers.length === 0) break;

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = `Set ${setIndex + 1}`;
    card.appendChild(title);

    const badgeContainer = document.createElement("div");
    badgeContainer.className = "number-badges";

    setNumbers.forEach(num => {
      const badge = document.createElement("div");
      badge.className = "badge";

      const category = classifyFrequency(frequencyCache, num);
      badge.classList.add(category);

      badge.textContent = num;
      badgeContainer.appendChild(badge);
    });

    card.appendChild(badgeContainer);
    container.appendChild(card);
  }
}

// ===============================
//  STRUCTURAL RADAR CHART
// ===============================

let structuralChartInstance = null;

function buildStructuralChart(prediction) {
  const canvas = document.getElementById('structuralChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const breakdown = structuralBreakdown(prediction);

  const labels = ['Odd/Even', 'Low/High', 'Decades', 'Primes', 'Sum', 'Pairs'];
  const data = [
    breakdown.oddEven,
    breakdown.lowHigh,
    breakdown.decades,
    breakdown.primes,
    breakdown.sum,
    breakdown.pairs
  ];

  if (structuralChartInstance) structuralChartInstance.destroy();

  structuralChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Structural Balance',
        data: data,
        backgroundColor: 'rgba(0, 99, 255, 0.3)',
        borderColor: 'rgba(0, 99, 255, 0.8)',
        pointBackgroundColor: 'rgba(0, 99, 255, 1)'
      }]
    },
    options: {
      scales: {
        r: {
          beginAtZero: true,
          max: 1,
          ticks: { stepSize: 0.2 }
        }
      }
    }
  });
}

// ===============================
//  LOAD ALL CHARTS
// ===============================

async function loadAllCharts() {
  const response = await fetch('draws.json');
  const data = await response.json();
  const draws = Array.isArray(data.draws) ? data.draws : data;

  const frequency = {};
  for (let i = 1; i <= 49; i++) frequency[i] = 0;

  draws.forEach(draw => {
    draw.numbers.forEach(num => frequency[num]++);
  });

  frequencyCache = frequency;

  renderFrequencyTable(frequency);
  renderFrequencyChart(frequency);
  buildRecencyChart(draws);
}

// ===============================
//  PREDICTION BUTTON
// ===============================

function setupPredictionButton() {
  const btn = document.getElementById("predictBtn");
  const modeSelect = document.getElementById("mode");
  const output = document.querySelector("#prediction .number-badges");

  if (!btn || !modeSelect || !output) return;

  btn.addEventListener("click", async () => {
    const response = await fetch("draws.json");
    const data = await response.json();
    const draws = Array.isArray(data.draws) ? data.draws : data;

    const mode = modeSelect.value;
    const scores = generateRankedScores(draws, mode);

    const set1 = scores.slice(0, 6).map(s => s.number);

    output.innerHTML = "";
    set1.forEach(num => {
      const badge = document.createElement("div");
      badge.className = "badge";

      const category = classifyFrequency(frequencyCache, num);
      badge.classList.add(category);

      badge.textContent = num;
      output.appendChild(badge);
    });

    buildStructuralChart(set1);
    renderRankedSets(scores);
  });
}

// ===============================
//  INITIALIZE DASHBOARD
// ===============================

window.addEventListener("DOMContentLoaded", () => {
  loadAllCharts();
  setupPredictionButton();
});
