// ─── Mock Data (swap with real API call later) ─────────────────────────────
const mockData = {
  site: "example.com",
  score: 62,
  dns_ipv6: true,
  reachable_ipv6: true,
  dependencies: [
    { host: "cdn.example.net", ipv6: true },
    { host: "fonts.example.org", ipv6: false },
    { host: "analytics.example.com", ipv6: false },
    { host: "images.example.io", ipv6: true },
  ],
};

// ─── Chart instance (so we can destroy & recreate) ──────────────────────────
let depsChart = null;

// ─── Main handler ───────────────────────────────────────────────────────────
async function handleScan() {
  const input = document.getElementById("urlInput");
  const url = input.value.trim();
  if (!url) {
    input.focus();
    return;
  }

  const btn = document.getElementById("scanBtn");
  btn.disabled = true;
  btn.textContent = "Scanning…";

  // ────────────────────────────────────────────────────────────────────────
  // TODO: Replace the mockData usage below with a real fetch call:
  //
  //   const res  = await fetch(`http://localhost:8000/scan?url=${encodeURIComponent(url)}`);
  //   const data = await res.json();
  //
  // Then pass `data` to renderResults(data) instead of mockData.
  // ────────────────────────────────────────────────────────────────────────

  // Simulate a short network delay for realism
  await new Promise((resolve) => setTimeout(resolve, 600));

  const data = { ...mockData, site: url };
  renderResults(data);

  btn.disabled = false;
  btn.textContent = "Scan";
}

// ─── Render everything ──────────────────────────────────────────────────────
function renderResults(data) {
  // Show the results section
  document.getElementById("results").classList.remove("hidden");

  renderScore(data.score);
  renderStatusCards(data.dns_ipv6, data.reachable_ipv6);
  renderDepsTable(data.dependencies);
  renderChart(data.dependencies);

  // Smooth-scroll results into view on mobile
  document.getElementById("results").scrollIntoView({ behavior: "smooth" });
}

// ─── Score ───────────────────────────────────────────────────────────────────
function renderScore(score) {
  const circle = document.getElementById("scoreCircle");
  const value = document.getElementById("scoreValue");

  // Remove old color class
  circle.classList.remove("green", "orange", "red");

  // Apply color based on score
  if (score >= 80) circle.classList.add("green");
  else if (score >= 50) circle.classList.add("orange");
  else circle.classList.add("red");

  // Animate the number counting up
  animateNumber(value, 0, score, 500);
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(from + (to - from) * progress);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── Status Cards ────────────────────────────────────────────────────────────
function renderStatusCards(dnsIpv6, reachableIpv6) {
  setCard("dnsCard", "dnsIcon", "dnsStatus", dnsIpv6);
  setCard("reachCard", "reachIcon", "reachStatus", reachableIpv6);
}

function setCard(cardId, iconId, statusId, isYes) {
  const card = document.getElementById(cardId);
  const icon = document.getElementById(iconId);
  const status = document.getElementById(statusId);

  card.classList.remove("yes", "no");
  status.classList.remove("yes", "no");

  if (isYes) {
    card.classList.add("yes");
    icon.textContent = "✅";
    status.textContent = "Yes";
    status.classList.add("yes");
  } else {
    card.classList.add("no");
    icon.textContent = "❌";
    status.textContent = "No";
    status.classList.add("no");
  }
}

// ─── Dependencies Table ─────────────────────────────────────────────────────
function renderDepsTable(deps) {
  const tbody = document.getElementById("depsBody");
  tbody.innerHTML = "";

  deps.forEach((dep) => {
    const tr = document.createElement("tr");
    const badgeClass = dep.ipv6 ? "ok" : "fail";
    const badgeText = dep.ipv6 ? "IPv6 OK" : "IPv4 only";

    tr.innerHTML = `
      <td>${escapeHtml(dep.host)}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Chart ───────────────────────────────────────────────────────────────────
function renderChart(deps) {
  const ipv6Count = deps.filter((d) => d.ipv6).length;
  const ipv4Count = deps.length - ipv6Count;

  // Destroy the old chart if it exists
  if (depsChart) {
    depsChart.destroy();
  }

  const ctx = document.getElementById("depsChart").getContext("2d");
  depsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["IPv6 Ready", "IPv4 Only"],
      datasets: [
        {
          data: [ipv6Count, ipv4Count],
          backgroundColor: ["#22c55e", "#ef4444"],
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 16,
            usePointStyle: true,
            font: { size: 13 },
          },
        },
      },
    },
  });
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Allow pressing Enter in the input to trigger scan
document.getElementById("urlInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleScan();
});
