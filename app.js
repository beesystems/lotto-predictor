/* ============================================================
   GLOBAL STATE
============================================================ */

let structuralChartInstance = null;
let frequencyChartInstance = null;
let recencyChartInstance = null;
let distributionChartInstance = null;

let frequencyCache = {};

/* ============================================================
   LOAD ALL CHARTS
============================================================ */

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
  buildDistributionChart(draws);
}

/* ============================================================
   FREQUENCY TABLE
============================================================ */

function renderFrequencyTable(freq) {
  const container = document.getElementById("frequency-table");
  if (!container) return;

  let html = `<table class="freq-table">`;

  for (let i = 1; i <= 49; i++) {
    html += `
      <tr>
        <td>${i}</td>
        <td>${freq[i]}</td>
      </tr>
    `;
  }

  html += `</table>`;
  container.innerHTML = html;
}

/* ============================================================
   FREQUENCY CHART
============================================================ */

function renderFrequencyChart(freq) {
  const canvas = document.getElementById("frequencyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (frequencyChartInstance) frequencyChartInstance.destroy();

  frequencyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Array.from({ length: 49 }, (_, i) => i + 1),
      datasets: [{
        label: "Frequency",
        data: Array.from({ length: 49 }, (_, i) => freq[i + 1]),
        backgroundColor: "rgba(25, 118, 210, 0.25)",
        borderColor: "rgba(25, 118, 210, 0.8)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 90,
            minRotation: 45,
            font: { size: 10 }
          }
        },
        y: {
          beginAtZero: true
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

  const lastSeen = {};
  for (let i = 1; i <= 49; i++) lastSeen[i] = null;

  draws.forEach((draw, index) => {
    draw.numbers.forEach(num => {
      lastSeen[num] = index;
    });
  });

  const recency = [];
  const totalDraws = draws.length;

  for (let i = 1; i <= 49; i++) {
    recency.push(lastSeen[i] === null ? totalDraws : totalDraws - lastSeen[i]);
  }

  if (recencyChartInstance) recencyChartInstance.destroy();

  recencyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Array.from({ length: 49 }, (_, i) => i + 1),
      datasets: [{
        label: "Recency",
        data: recency,
        backgroundColor: "rgba(25, 118, 210, 0.25)",
        borderColor: "rgba(25, 118, 210, 0.8)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 90,
            minRotation: 45,
            font: { size: 10 }
          }
        },
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

/* ============================================================
   DISTRIBUTION (BELL CURVE) HISTOGRAM
============================================================ */

function buildDistributionChart(draws) {
  const canvas = document.getElementById("distributionChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // Compute sums (excluding bonus)
  const sums = draws.map(d => d.numbers.reduce((a, b) => a + b, 0));

  // Compute median
  const sorted = [...sums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;

  // Bin width = 10
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

  // Compute bin centers
  const binCenters = histogram.map((_, i) => min + i * binWidth + binWidth / 2);

  // Prepare dataset with numeric x-values
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
   RESIZE LISTENER
============================================================ */

window.addEventListener("resize", () => {
  if (structuralChartInstance) structuralChartInstance.resize();
  if (frequencyChartInstance) frequencyChartInstance.resize();
  if (recencyChartInstance) recencyChartInstance.resize();
  if (distributionChartInstance) distributionChartInstance.resize();
});

/* ============================================================
   INITIAL LOAD
============================================================ */

loadAllCharts();
