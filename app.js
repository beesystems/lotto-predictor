// ===============================
//  LOTTO ANALYTICS ENGINE
// ===============================

// ---------- WEIGHTS ----------
const WEIGHTS = {
  conservative: { structure: 0.35, frequency: 0.30, recency: 0.20, pairs: 0.15 },
  hybrid: { structure: 0.25, frequency: 0.25, recency: 0.25, pairs: 0.25 },
  aggressive: { structure: 0.15, frequency: 0.35, recency: 0.30, pairs: 0.20 }
};

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
  const primeList = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47];
  let score = 0;
  score += (decade >= 0 && decade <= 4) ? 0.25 : 0;
  score += primeList.includes(n) ? 0.25 : 0;
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
  if (!Array.isArray(draws)) {
    console.error("Invalid draws data passed to computeFeatures:", draws);
    return { structure: 0, frequency: 0, recency: 0, pairs: 0 };
  }
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

function generatePrediction(draws, mode = "hybrid") {
  if (!Array.isArray(draws)) {
    console.error("generatePrediction received invalid draws:", draws);
    return [];
  }

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

  return scores.sort((a,b) => b.score - a.score).slice(0, 6);
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
//  FREQUENCY TABLE + CHART
// ===============================

let frequencyChartInstance = null;

function renderFrequencyChart(frequency) {
  const ctx = document.getElementById('frequencyChart').getContext('2d');
  if (frequencyChartInstance) frequencyChartInstance.destroy();

  frequencyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [...Array(49).keys()].map(i => i + 1),
      datasets: [{
        label: 'Frequency',
        data: Object.values(frequency),
        backgroundColor: 'rgba(0, 99, 255, 0.5)'
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function renderFrequencyTable(freq) {
  const container = document.getElementById('frequency-table');
  let html = "<table><tr><th>Number</th><th>Count</th></tr>";
  for (let i = 1; i <= 49; i++) html += `<tr><td>${i}</td><td>${freq[i]}</td></tr>`;
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
    options: { scales: { y: { beginAtZero: true } } }
  });
}

// ===============================
//  STRUCTURAL RADAR CHART
// ===============================

let structuralChartInstance = null;

function buildStructuralChart(prediction) {
  const ctx = document.getElementById('structuralChart').getContext('2d');
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
      scales:
