// Shared helpers
function loadDraws() {
  return JSON.parse(localStorage.getItem("draws")) || [];
}

function saveDraws(draws) {
  localStorage.setItem("draws", JSON.stringify(draws));
}

const WEIGHTS = {
  conservative: { structure: 0.60, frequency: 0.20, recency: 0.10, pairs: 0.10 },
  hybrid:       { structure: 0.40, frequency: 0.30, recency: 0.20, pairs: 0.10 },
  aggressive:   { structure: 0.20, frequency: 0.40, recency: 0.30, pairs: 0.10 }
};

// Add Draw page
const addBtn = document.getElementById("addDrawBtn");
if (addBtn) {
  addBtn.addEventListener("click", () => {
    const numbers = [
      +document.getElementById("n1").value,
      +document.getElementById("n2").value,
      +document.getElementById("n3").value,
      +document.getElementById("n4").value,
      +document.getElementById("n5").value,
      +document.getElementById("n6").value
    ];
    const bonus = +document.getElementById("bonus").value;

    const draws = loadDraws();
    draws.push({ numbers, bonus });
    saveDraws(draws);
  });
}

// Dashboard page
const predictBtn = document.getElementById("predictBtn");
if (predictBtn) {
  predictBtn.addEventListener("click", () => {
    const mode = document.getElementById("mode").value;
    const draws = loadDraws();
    const prediction = generatePrediction(draws, mode);
    renderPrediction(prediction, mode);
    updateCharts(draws, prediction);
  });
}

function computeFeatures(n, draws) {
  return {
    structure: structuralScore(n),
    frequency: frequencyScore(n, draws),
    recency:   recencyScore(n, draws),
    pairs:     pairScore(n, draws)
  };
}

function generatePrediction(draws, mode) {
  const weights = WEIGHTS[mode];
  const numbers = Array.from({ length: 49 }, (_, i) => i + 1);

  const scores = numbers.map(n => {
    const f = computeFeatures(n, draws);
    const score =
      weights.structure * f.structure +
      weights.frequency * f.frequency +
      weights.recency   * f.recency +
      weights.pairs     * f.pairs;
    return { number: n, score };
  });

  return scores.sort((a, b) => b.score - a.score).slice(0, 6);
}

function renderPrediction(prediction, mode) {
  const container = document.querySelector("#prediction .number-badges");
  if (!container) return;
  container.innerHTML = prediction
    .map(p => `<span class="badge">${p.number}</span>`)
    .join("");
}

// Charts
function updateCharts(draws, prediction) {
  const numbers = Array.from({ length: 49 }, (_, i) => i + 1);
  const freqData = numbers.map(n => frequencyScore(n, draws));
  const recencyData = numbers.map(n => recencyScore(n, draws));


  const structuralScores = {
    oddEven: structuralOddEven(prediction),
    lowHigh: structuralLowHigh(prediction),
    decades: structuralDecades(prediction),
    primes:  structuralPrimes(prediction),
    sum:     structuralSum(prediction),
    pairs:   structuralPairs(prediction)
  };

  const freqCtx = document.getElementById("frequencyChart");
  const recCtx = document.getElementById("recencyChart");
  const structCtx = document.getElementById("structuralChart");

  if (freqCtx) {
    new Chart(freqCtx, {
      type: "bar",
      data: {
        labels: numbers,
        datasets: [{ data: freqData, backgroundColor: "#1E88E5" }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }

  if (recCtx) {
    new Chart(recCtx, {
      type: "bar",
      data: {
        labels: numbers,
        datasets: [{ data: recencyData, backgroundColor: "#90CAF9" }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }

  if (structCtx) {
    new Chart(structCtx, {
      type: "radar",
      data: {
        labels: ["Odd/Even", "Low/High", "Decades", "Primes", "Sum", "Pairs"],
        datasets: [{
          label: "Structural Score",
          data: Object.values(structuralScores),
          backgroundColor: "rgba(30,136,229,0.2)",
          borderColor: "#1E88E5"
        }]
      }
    });
  }
}
