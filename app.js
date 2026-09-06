// ===============================
//  LOTTO ANALYTICS ENGINE
// ===============================

// ---------- WEIGHTS ----------
const WEIGHTS = {
  default: {
    structure: 0.25,
    frequency: 0.25,
    recency: 0.25,
    pairs: 0.25
  },
  bonus: {
    structure: 0.35,
    frequency: 0.30,
    recency: 0.20,
    pairs: 0.15
  }
};

// ===============================
//  STRUCTURAL SCORING
// ===============================

// Odd/Even balance
function structuralOddEven(prediction) {
  const odd = prediction.filter(n => n % 2 !== 0).length;
  const even = prediction.length - odd;
  return 1 - Math.abs(odd - even) / prediction.length;
}

// Low/High balance (1–24 low, 25–49 high)
function structuralLowHigh(prediction) {
  const low = prediction.filter(n => n <= 24).length;
  const high = prediction.length - low;
  return 1 - Math.abs(low - high) / prediction.length;
}

// Decade distribution (1–9, 10–19, 20–29, 30–39, 40–49)
function structuralDecades(prediction) {
  const buckets = [0,0,0,0,0];
  prediction.forEach(n => buckets[Math.floor(n / 10)]++);
  const ideal = prediction.length / 5;
  const deviation = buckets.reduce((sum, b) => sum + Math.abs(b - ideal), 0);
  return 1 - deviation / prediction.length;
}

// Prime number balance
function structuralPrimes(prediction) {
  const primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47];
  const count = prediction.filter(n => primes.includes(n)).length;
  const ideal = prediction.length * 0.3;
  return 1 - Math.abs(count - ideal) / prediction.length;
}

// Sum range (ideal 100–180)
function structuralSum(prediction) {
  const sum = prediction.reduce((a,b) => a + b, 0);
  if (sum < 100 || sum > 180) return 0;
  return 1 - Math.abs(sum - 140) / 140;
}

// Pair adjacency (avoid too many consecutive numbers)
function structuralPairs(prediction) {
  let pairs = 0;
  const sorted = [...prediction].sort((a,b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i-1] + 1) pairs++;
  }
  return 1 - pairs / prediction.length;
}

// Combined structural score for a single number
function structuralScore(n) {
  const decade = Math.floor(n / 10);
  const primeList = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47];

  let score = 0;

  score += (decade >= 0 && decade <= 4) ? 0.25 : 0;
  score += primeList.includes(n) ? 0.25 : 0;
  score += (n >= 10 && n <= 39) ? 0.25 : 0;
  score += (n !== 1 && n !== 49) ? 0.25 : 0;

  return score;
}

// ===============================
//  FREQUENCY SCORING
// ===============================

function frequencyScore(n, draws) {
  const count = draws.reduce((sum, d) => sum + (d.numbers.includes(n) ? 1 : 0), 0);
  return count / draws.length;
}

// ===============================
//  RECENCY SCORING
// ===============================

function recencyScore(n, draws) {
  for (let i = draws.length - 1; i >= 0; i--) {
    if (draws[i].numbers.includes(n)) {
      return 1 - i / draws.length;
    }
  }
  return 0;
}

// ===============================
//  PAIR SCORING
// ===============================

function pairScore(n, draws) {
  let score = 0;
  draws.forEach(d => {
    const sorted = [...d.numbers].sort((a,b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i-1] + 1 && (sorted[i] === n || sorted[i-1] === n)) {
        score += 1;
      }
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

function generatePrediction(draws, mode = "default") {
  const weights = WEIGHTS[mode];
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

  return scores.sort((a,b) => b.score - a.score).slice(0, 6);
}

// ===============================
//  STRUCTURAL BREAKDOWN FOR UI
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
//  FREQUENCY TABLE
// ===============================

async function buildFrequencyTable() {
    const response = await fetch('draws.json');
    const data = await response.json();
    const draws = data.draws;

    if (!Array.isArray(draws)) {
        console.error("draws.json format error: expected {draws: []}");
        return {};
    }

    const frequency = {};
    for (let i = 1; i <= 49; i++) frequency[i] = 0;

    draws.forEach(draw => {
        draw.numbers.forEach(num => frequency[num]++);
    });

    return frequency;
}

function renderFrequencyTable(freq) {
    const container = document.getElementById('frequency-table');
    let html = "<table><tr><th>Number</th><th>Count</th></tr>";

    for (let i = 1; i <= 49; i++) {
        html += `<tr><td>${i}</td><td>${freq[i]}</td></tr>`;
    }

    html += "</table>";
    container.innerHTML = html;
}

// ===============================
//  RECENCY CHART
// ===============================

function buildRecencyChart(draws) {
    const ctx = document.getElementById('recencyChart').getContext('2d');

    const recencyValues = [...Array(49).keys()].map(i => recencyScore(i + 1, draws));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [...Array(49).keys()].map(i => i + 1),
            datasets: [{
                label: 'Recency (1 = very recent)',
                data: recencyValues,
                backgroundColor: 'rgba(255, 99, 132, 0.5)'
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
//  LOAD DATA + BUILD ALL CHARTS
// ===============================

async function loadAllCharts() {
    const response = await fetch('draws.json');
    const data = await response.json();
    const draws = data.draws;

    if (!Array.isArray(draws)) {
        console.error("draws.json format error: expected {draws: []}");
        return;
    }

    // ----- FREQUENCY -----
    const frequency = {};
    for (let i = 1; i <= 49; i++) frequency[i] = 0;

    draws.forEach(draw => {
        draw.numbers.forEach(num => frequency[num]++);
    });

    renderFrequencyTable(frequency);

    const freqCtx = document.getElementById('frequencyChart').getContext('2d');
    new Chart(freqCtx, {
        type: 'bar',
        data: {
            labels: [...Array(49).keys()].map(i => i + 1),
            datasets: [{
                label: 'Frequency',
                data: Object.values(frequency),
                backgroundColor: 'rgba(0, 99, 255, 0.5)'
            }]
        }
    });

    // ----- RECENCY -----
    buildRecencyChart(draws);
}

loadAllCharts();

// ===============================
//  PREDICTION BUTTON (FIXED)
// ===============================

async function setupPredictionButton() {
    const btn = document.getElementById("predictBtn");
    const modeSelect = document.getElementById("mode");
    const output = document.querySelector("#prediction .number-badges");

    btn.addEventListener("click", async () => {
        try {
            const response = await fetch("draws.json");
            const data = await response.json();

            // ✅ Safety check
            const draws = Array.isArray(data.draws) ? data.draws : [];
            if (draws.length === 0) {
                console.error("No draws found in draws.json");
                output.innerHTML = "<p style='color:red'>Error: No draws found.</p>";
                return;
            }

            const mode = modeSelect.value;

            // ✅ Generate prediction safely
            const prediction = generatePrediction(draws, mode);

            output.innerHTML = "";
            prediction.forEach(p => {
                const badge = document.createElement("div");
                badge.className = "badge";
                badge.textContent = p.number;
                output.appendChild(badge);
            });
        } catch (err) {
            console.error("Prediction error:", err);
            output.innerHTML = "<p style='color:red'>Prediction failed. Check console.</p>";
        }
    });
}

setupPredictionButton();
