/* ============================================================
   LOTTO ANALYTICS ENGINE — MERGED VERSION
   Includes:
   - Original prediction engine
   - New numeric histogram with annotation lines
   - Sorted prediction numbers
   - 3 ranked sets (Option A)
============================================================ */

/* ============================================================
   WEIGHTS
============================================================ */

const WEIGHTS = {
  conservative: { structure: 0.35, frequency: 0.30, recency: 0.20, pairs: 0.15, julian: 0.05 },
  hybrid:       { structure: 0.25, frequency: 0.25, recency: 0.25, pairs: 0.25, julian: 0.10 },
  aggressive:   { structure: 0.15, frequency: 0.35, recency: 0.30, pairs: 0.20, julian: 0.15 }
};

/* ============================================================
   GLOBAL STATE
============================================================ */

let frequencyCache = {};

let structuralChartInstance = null;
let frequencyChartInstance = null;
let recencyChartInstance = null;
let distributionChartInstance = null;

/* ============================================================
   JULIAN DATE HELPERS
============================================================ */

function getJulianDay(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

function getJulianDigits(dateStr) {
  const j = getJulianDay(dateStr).toString();
  return new Set(j.split("").map(Number));
}

/* ============================================================
   TEMPORAL BIAS STATE
============================================================ */

let julianDigitCounts = Array.from({ length: 10 }, () => Array(50).fill(0));
let julianTotalByDigit = Array(10).fill(0);

/* ============================================================
   STRUCTURAL SCORING
============================================================ */

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

/* ============================================================
   FREQUENCY / RECENCY / PAIR SCORING
============================================================ */

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

/* ============================================================
   FEATURE COMPUTATION
============================================================ */

/* ============================================================
   JULIAN DIGIT → NUMBER CORRELATION
============================================================ */

function processDrawsForJulian(draws) {
  julianDigitCounts = Array.from({ length: 10 }, () => Array(50).fill(0));
  julianTotalByDigit = Array(10).fill(0);

  for (const draw of draws) {
    const digits = getJulianDigits(draw.date);

    for (const d of digits) {
      julianTotalByDigit[d]++;

      for (const num of draw.numbers) {
        julianDigitCounts[d][num]++; // num is 1–49
      }
    }
  }
}

function computeFeatures(n, draws) {
  return {
    structure: structuralScore(n),
    frequency: frequencyScore(n, draws),
    recency: recencyScore(n, draws),
    pairs: pairScore(n, draws)
  };
}

/* ============================================================
   JULIAN BIAS SCORING
============================================================ */

function julianBiasScore(n) {
  let score = 0;
  let activeDigits = 0;

  for (let d = 0; d <= 9; d++) {
    const total = julianTotalByDigit[d];
    if (total === 0) continue;

    const count = julianDigitCounts[d][n] || 0;
    const freq = count / total;

    score += freq;
    activeDigits++;
  }

  return activeDigits === 0 ? 0 : score / activeDigits;
}

/* ============================================================
   PREDICTION ENGINE
============================================================ */

function generateRankedScores(draws, mode = "hybrid") {
  const weights = WEIGHTS[mode] || WEIGHTS.hybrid;
  const numbers = [...Array(49).keys()].map(i => i + 1);

  const scores = numbers.map(n => {
    const f = computeFeatures(n, draws);
    const score =
      weights.structure * f.structure +
      weights.frequency * f.frequency +
      weights.recency   * f.recency +
      weights.pairs     * f.pairs +
      weights.julian    * julianBiasScore(n);

    return { number: n, score };
  });

  return scores.sort((a,b) => b.score - a.score);
}

/* ============================================================
   STRUCTURAL BREAKDOWN
============================================================ */

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

/* ============================================================
   HOT / COLD CLASSIFICATION
============================================================ */

function classifyFrequency(freq, number) {
  const values = Object.values(freq);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const f = freq[number];

  // Define thresholds relative to range
  const hotThreshold = max - range * 0.15;   // top 15%
  const coldThreshold = min + range * 0.15;  // bottom 15%

  if (f >= hotThreshold) return "hot";
  if (f <= coldThreshold) return "cold";
  return "warm";
}

/* ============================================================
   FREQUENCY TABLE
============================================================ */

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

/* ============================================================
   FREQUENCY CHART
============================================================ */

function renderFrequencyChart(freq) {
  const canvas = document.getElementById("frequencyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = Array.from({ length: 49 }, (_, i) => i + 1);
  const data = labels.map(i => freq[i]);

  if (frequencyChartInstance) frequencyChartInstance.destroy();

  frequencyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Frequency",
        data,
        backgroundColor: "rgba(25, 118, 210, 0.6)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: { size: 13, family: "Segoe UI" }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" }
        },
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 90,
            minRotation: 45,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

/* ============================================================
   RECENCY CHART
============================================================ */

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

  if (recencyChartInstance) recencyChartInstance.destroy();

  recencyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Recency (draws since last hit)",
        data,
        backgroundColor: "rgba(244, 81, 108, 0.6)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: { size: 13, family: "Segoe UI" }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" }
        },
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 90,
            minRotation: 45,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

/* ============================================================
   DISTRIBUTION (NUMERIC HISTOGRAM WITH ANNOTATIONS)
============================================================ */

function buildDistributionChart(draws) {
  const canvas = document.getElementById("distributionChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const sums = draws.map(d => d.numbers.reduce((a, b) => a + b, 0));

  const sorted = [...sums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;

  const binWidth = 10;
  const min = Math.min(...sums);
  const max = Math.max(...sums);
  const bins = Math.ceil((max - min) / binWidth);

  const histogram = new Array(bins).fill(0);

  sums.forEach(sum => {
    let index = Math.floor((sum - min) / binWidth);
    if (index >= bins) index = bins - 1;
    histogram[index]++;
  });

  const binCenters = histogram.map((_, i) => min + i * binWidth + binWidth / 2);

  const histogramData = histogram.map((count, i) => ({
    x: binCenters[i],
    y: count
  }));

  if (distributionChartInstance) distributionChartInstance.destroy();

  distributionChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      datasets: [
        {
          label: "Sum Distribution",
          data: histogramData,
          backgroundColor: "rgba(25, 118, 210, 0.25)",
          borderColor: "rgba(25, 118, 210, 0.8)",
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: "linear",
          min: min,
          max: max,
          ticks: {
            stepSize: binWidth,
            font: { size: 10 }
          }
        },
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          labels: {
            font: { size: 13, family: "Segoe UI" }
          }
        },
        annotation: {
          annotations: {
            medianLine: {
              type: 'line',
              scaleID: 'x',
              value: median,
              borderColor: '#e63946',
              borderWidth: 3,
              label: {
                enabled: true,
                content: `Median (${median})`,
                position: 'start',
                backgroundColor: 'rgba(230,57,70,0.8)',
                color: '#fff'
              }
            },
            leftCluster: {
              type: 'line',
              scaleID: 'x',
              value: 120,
              borderColor: '#1976d2',
              borderWidth: 3,
              label: {
                enabled: true,
                content: '120',
                position: 'start',
                backgroundColor: 'rgba(25,118,210,0.8)',
                color: '#fff'
              }
            },
            rightCluster: {
              type: 'line',
              scaleID: 'x',
              value: 160,
              borderColor: '#1976d2',
              borderWidth: 3,
              label: {
                enabled: true,
                content: '160',
                position: 'start',
                backgroundColor: 'rgba(25,118,210,0.8)',
                color: '#fff'
              }
            }
          }
        }
      }
    }
  });
}

/* ============================================================
   JULIAN HEATMAP
============================================================ */

function buildJulianHeatmap() {
  const canvas = document.getElementById("julianHeatmap");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const labelsX = Array.from({ length: 49 }, (_, i) => i + 1);
  const labelsY = Array.from({ length: 10 }, (_, i) => `Digit ${i}`);

  const dataMatrix = julianDigitCounts.map(row =>
    row.slice(1, 50) // remove index 0
  );

  new Chart(ctx, {
    type: "heatmap",
    data: {
      labels: labelsX,
      datasets: labelsY.map((label, i) => ({
        label,
        data: dataMatrix[i],
        backgroundColor: dataMatrix[i].map(v =>
          `rgba(123, 31, 162, ${v === 0 ? 0.05 : v / Math.max(...dataMatrix[i])})`
        )
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}
/* ============================================================
   DIGIT CLUSTER TABLE
============================================================ */

function renderDigitClusterTable() {
  const container = document.getElementById("digitClusterTable");
  if (!container) return;

  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "freq-table";

  for (let d = 0; d <= 9; d++) {
    const row = document.createElement("tr");

    const digitCell = document.createElement("td");
    digitCell.textContent = `Digit ${d}`;

    const topNumbers = [...Array(49).keys()]
      .map(i => i + 1)
      .sort((a, b) => julianDigitCounts[d][b] - julianDigitCounts[d][a])
      .slice(0, 3);

    const numbersCell = document.createElement("td");
    numbersCell.textContent = topNumbers.join(", ");

    row.appendChild(digitCell);
    row.appendChild(numbersCell);
    table.appendChild(row);
  }

  container.appendChild(table);
}

/* ============================================================
   JULIAN-WEIGHTED PREDICTION
============================================================ */

function julianWeightedPrediction(scores, nextDrawDate) {
  if (!nextDrawDate) return scores;

  const digits = getJulianDigits(nextDrawDate);

  return scores.map(s => {
    let boost = 0;

    digits.forEach(d => {
      boost += julianDigitCounts[d][s.number] || 0;
    });

    return {
      number: s.number,
      score: s.score + boost * 0.01 // small temporal boost
    };
  }).sort((a, b) => b.score - a.score);
}

/* ============================================================
   RENDER 3 RANKED SETS (SORTED ASCENDING)
============================================================ */

function renderRankedSets(scores) {
  const container = document.getElementById("ranked-sets");
  if (!container) return;

  container.innerHTML = "";

  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h3");
  title.textContent = "Prediction Sets";
  card.appendChild(title);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Three ranked sets based on the scoring model.";
  card.appendChild(hint);

  const setsWrapper = document.createElement("div");
  setsWrapper.className = "sets-wrapper";

  for (let setIndex = 0; setIndex < 3; setIndex++) {
    const start = setIndex * 6;
    const end = Math.min(start + 6, scores.length);
    const setNumbers = scores.slice(start, end).map(s => s.number);

    if (setNumbers.length < 6) break;

    const sortedSet = [...setNumbers].sort((a, b) => a - b);

    const setBlock = document.createElement("div");
    setBlock.className = "set-block";

    const setTitle = document.createElement("h4");
    setTitle.textContent = `Set ${setIndex + 1}`;
    setBlock.appendChild(setTitle);

    const badgeContainer = document.createElement("div");
    badgeContainer.className = "number-badges";

    sortedSet.forEach(num => {
      const badge = document.createElement("div");
      badge.className = "badge";

      const category = classifyFrequency(frequencyCache, num);
      badge.classList.add(category);

      badge.textContent = num;
      badgeContainer.appendChild(badge);
    });

    setBlock.appendChild(badgeContainer);
    setsWrapper.appendChild(setBlock);
  }

  card.appendChild(setsWrapper);
  container.appendChild(card);
}

/* ============================================================
   STRUCTURAL RADAR CHART
============================================================ */

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
        backgroundColor: 'rgba(25, 118, 210, 0.25)',
        borderColor: 'rgba(25, 118, 210, 0.8)',
        pointBackgroundColor: 'rgba(25, 118, 210, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: { size: 13, family: "Segoe UI" }
          }
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 1,
          ticks: { stepSize: 0.2 },
          grid: { color: "rgba(0,0,0,0.05)" }
        }
      }
    }
  });
}

/* ============================================================
   JULIAN CORRELATION CHART
============================================================ */

function buildJulianChart() {
  const canvas = document.getElementById("julianChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const labels = Array.from({ length: 49 }, (_, i) => i + 1);
  const data = labels.map(n => julianBiasScore(n));

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Julian Bias Score",
        data,
        backgroundColor: "rgba(123, 31, 162, 0.6)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 90,
            minRotation: 45
          }
        }
      }
    }
  });
}

/* ============================================================
   DOWNLOAD CSV BUTTON
============================================================ */

async function setupDownloadButton() {
  const btn = document.getElementById("downloadCsvBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const response = await fetch("draws.json");
    const data = await response.json();
    const draws = Array.isArray(data.draws) ? data.draws : data;

    let csv = "date,n1,n2,n3,n4,n5,n6,bonus\n";

    draws.forEach(draw => {
      csv += [
        draw.date,
        draw.numbers[0],
        draw.numbers[1],
        draw.numbers[2],
        draw.numbers[3],
        draw.numbers[4],
        draw.numbers[5],
        draw.bonus
      ].join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "lotto_draw_history.csv";
    a.click();

    URL.revokeObjectURL(url);
  });
}

/* ============================================================
   UNIVERSAL RESIZE HANDLER
============================================================ */

window.addEventListener("resize", () => {
  if (structuralChartInstance) structuralChartInstance.resize();
  if (frequencyChartInstance) frequencyChartInstance.resize();
  if (recencyChartInstance) recencyChartInstance.resize();
  if (distributionChartInstance) distributionChartInstance.resize();
});

/* ============================================================
   LOAD ALL CHARTS
============================================================ */

async function loadAllCharts() {
  const response = await fetch('draws.json');
  const data = await response.json();
  const draws = Array.isArray(data.draws) ? data.draws : data;

  processDrawsForJulian(draws);
   
  const frequency = {};
  for (let i = 1; i <= 49; i++) frequency[i] = 0;

  draws.forEach(draw => {
    draw.numbers.forEach(num => frequency[num]++);
  });

  frequencyCache = frequency;

  renderFrequencyTable(frequency);
  renderFrequencyChart(frequency);
  buildRecencyChart(draws);
  buildDistributionChart(draws);
  buildJulianChart();
  buildJulianHeatmap();
  renderDigitClusterTable();
}

/* ============================================================
   PREDICTION BUTTON
============================================================ */

function setupPredictionButton() {
  const btn = document.getElementById("predictBtn");
  const modeSelect = document.getElementById("mode");
  const output = document.querySelector("#prediction .number-badges");

  console.log("FREQUENCY CACHE:", frequencyCache);
 
  if (!btn || !modeSelect || !output) return;

  btn.addEventListener("click", async () => {
    const response = await fetch("draws.json");
    const data = await response.json();
    const draws = Array.isArray(data.draws) ? data.draws : data;

    const mode = modeSelect.value;
    let scores = generateRankedScores(draws, mode);

    const temporalMode = document.getElementById("temporalMode").value;
    const nextDrawDate = document.getElementById("nextDrawDate").value;

    if (temporalMode === "julian") {
      scores = julianWeightedPrediction(scores, nextDrawDate);
    }

    if (temporalMode === "hybrid") {
      scores = julianWeightedPrediction(scores, nextDrawDate);
    }

    const set1 = scores.slice(0, 6).map(s => s.number).sort((a, b) => a - b);

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

/* ============================================================
   INFO TIP COLLAPSIBLE TOGGLES
============================================================ */

function setupInfoToggles() {
  document.querySelectorAll(".info-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const content = btn.nextElementSibling;
      const isOpen = content.style.display === "block";
      content.style.display = isOpen ? "none" : "block";
    });
  });
}

/* ============================================================
   INITIALIZE DASHBOARD
============================================================ */

window.addEventListener("DOMContentLoaded", () => {
  loadAllCharts();
  setupPredictionButton();
  setupDownloadButton();
  setupInfoToggles();
});
