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

  // Balanced decade distribution
  score += (decade >= 0 && decade <= 4) ? 0.25 : 0;

  // Prime bonus
  score += primeList.includes(n) ? 0.25 : 0;

  // Middle-range bonus
  score += (n >= 10 && n <= 39) ? 0.25 : 0;

  // Avoid extremes
  score += (n !== 1 && n !== 49) ? 0.25 : 0;

  return score;
}

// ===============================
//  FREQUENCY SCORING
// ===============================

function frequencyScore(n, draws) {
  const count = draws.reduce((sum, d) => sum + (d.main.includes(n) ? 1 : 0), 0);
  return count / draws.length;
}

// ===============================
//  RECENCY SCORING
// ===============================

function recencyScore(n, draws) {
  for (let i = draws.length - 1; i >= 0; i--) {
    if (draws[i].main.includes(n)) {
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
    const sorted = [...d.main].sort((a,b) => a - b);
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
//  CHART DATA GENERATION
// ===============================

function generateCharts(draws) {
  const numbers = [...Array(49).keys()].map(i => i + 1);

  return {
    frequency: numbers.map(n => frequencyScore(n, draws)),
    recency: numbers.map(n => recencyScore(n, draws)),
    pairs: numbers.map(n => pairScore(n, draws))
  };
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
//  EXPORT (if using modules)
// ===============================

if (typeof module !== "undefined") {
  module.exports = {
    generatePrediction,
    generateCharts,
    structuralBreakdown
  };
}

// ===============================
//  Build Frequency Table
// ===============================

buildFrequencyTable().then(freq => {
    const ctx = document.getElementById('frequencyChart').getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [...Array(49).keys()].map(i => i + 1),
            datasets: [{
                label: 'Frequency',
                data: Object.values(freq),
                backgroundColor: 'rgba(0, 99, 255, 0.5)'
            }]
        }
    });
});

async function buildFrequencyTable() {
    const response = await fetch('draws.json');
    const draws = await response.json();

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

buildFrequencyTable().then(renderFrequencyTable);
