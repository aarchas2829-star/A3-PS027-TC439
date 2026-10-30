// ─── Ensure Chart.js is loaded if HTML CDN link returned 404 ───────────────────
if (typeof Chart === "undefined") {
  const chartScript = document.createElement("script");
  chartScript.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  chartScript.onload = () => {
    if (lastDeps !== null) renderChart(lastDeps);
  };
  document.head.appendChild(chartScript);
}

// ─── Theme toggle (system preference + localStorage with try/catch) ───────────
(function initTheme() {
  const html = document.documentElement;
  let stored = null;
  try {
    stored = localStorage.getItem("theme");
  } catch (_) {}

  if (stored === "dark" || stored === "light") {
    html.setAttribute("data-theme", stored);
  } else {
    // Default to system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }

  updateToggleIcon();
})();

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch (_) {}
  updateToggleIcon();
  // Re-render chart with correct legend colors if it exists
  if (lastDeps !== null) renderChart(lastDeps);
}

function updateToggleIcon() {
  const icon = document.getElementById("themeIcon");
  if (!icon) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  // Clean SVG icons (no emojis)
  if (isDark) {
    // Sun icon to switch to light
    icon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>`;
  } else {
    // Moon icon to switch to dark
    icon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>`;
  }
}

document.getElementById("themeToggle").addEventListener("click", toggleTheme);

// ─── Chart instance & cache ──────────────────────────────────────────────────
let depsChart = null;
let lastDeps = null;

// ─── Main handler ───────────────────────────────────────────────────────────
async function handleScan() {
  const input = document.getElementById("urlInput");
  const url = input.value.trim();
  if (!url) {
    input.focus();
    return;
  }

  const btn = document.getElementById("scanBtn");
  const btnText = document.getElementById("scanBtnText") || btn;
  btn.disabled = true;
  btnText.textContent = "Scanning…";

  // Hide any previous error & show loading spinner
  hideError();
  showLoading();

  try {
    const res = await fetch(
      `http://localhost:8000/scan?url=${encodeURIComponent(url)}`
    );
    if (!res.ok) {
      throw new Error(`Server responded with HTTP status ${res.status}`);
    }
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    console.error("Scan failed:", err);
    const detail = err && err.message ? err.message : String(err);
    showError(detail);
  } finally {
    hideLoading();
    btn.disabled = false;
    btnText.textContent = "Scan";
  }
}

// ─── State Helpers ───────────────────────────────────────────────────────────
function showLoading() {
  const loading = document.getElementById("loadingState");
  if (loading) loading.classList.remove("hidden");
  const results = document.getElementById("results");
  if (results) results.classList.add("hidden");
}

function hideLoading() {
  const loading = document.getElementById("loadingState");
  if (loading) loading.classList.add("hidden");
}

function showError(message) {
  console.error("Audit error:", message);
  let el = document.getElementById("errorMsg");
  let textEl = document.getElementById("errorText");
  if (textEl) {
    textEl.textContent = message;
  } else if (el) {
    el.textContent = message;
  }
  if (el) el.classList.remove("hidden");

  // Hide results and loading state
  const results = document.getElementById("results");
  if (results) results.classList.add("hidden");
  hideLoading();
}

function hideError() {
  const el = document.getElementById("errorMsg");
  if (el) el.classList.add("hidden");
}

// ─── Render everything ──────────────────────────────────────────────────────
function renderResults(data) {
  // Show results dashboard
  const results = document.getElementById("results");
  results.classList.remove("hidden");

  renderScore(data.score);
  renderStatusCards(data.dns_ipv6, data.reachable_ipv6);
  renderDepsTable(data.dependencies);
  renderChart(data.dependencies);

  // Smooth-scroll results into view
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Score Progress Ring ─────────────────────────────────────────────────────
function renderScore(score) {
  const circle = document.getElementById("scoreCircle");
  const value = document.getElementById("scoreValue");
  const ring = document.getElementById("scoreProgress");
  const badge = document.getElementById("scoreBadge");
  const scoreText = document.getElementById("scoreText");

  // Remove old classes
  if (circle) circle.classList.remove("green", "orange", "red");
  if (ring) ring.classList.remove("green", "orange", "red");
  if (badge) badge.classList.remove("green", "orange", "red");

  const numScore = Number(score) || 0;
  let statusClass = "red";
  let statusLabel = "Not Ready";
  let statusDesc = "Low IPv6 readiness. Immediate adoption recommended.";

  if (numScore >= 80) {
    statusClass = "green";
    statusLabel = "IPv6 Ready";
    statusDesc = "Excellent! Fully prepared for IPv6 traffic.";
  } else if (numScore >= 50) {
    statusClass = "orange";
    statusLabel = "Partially Ready";
    statusDesc = "Moderate support. Some dependencies still IPv4 only.";
  }

  if (circle) circle.classList.add(statusClass);
  if (ring) ring.classList.add(statusClass);
  if (badge) {
    badge.classList.add(statusClass);
    badge.textContent = statusLabel;
  }
  if (scoreText) {
    scoreText.textContent = statusDesc;
  }

  // Update SVG circular progress ring (radius=56, circumference=351.86)
  if (ring) {
    const circumference = 2 * Math.PI * 56;
    const clampedScore = Math.max(0, Math.min(100, numScore));
    const offset = circumference - (clampedScore / 100) * circumference;
    ring.style.strokeDashoffset = offset;
  }

  // Animate number counting up
  animateNumber(value, 0, numScore, 500);
}

function animateNumber(el, from, to, duration) {
  if (!el) return;
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
  setCard("dnsCard", "dnsIcon", "dnsStatus", "dnsPill", "dnsDesc", dnsIpv6, "dns");
  setCard("reachCard", "reachIcon", "reachStatus", "reachPill", "reachDesc", reachableIpv6, "reach");
}

function setCard(cardId, iconId, statusId, pillIdOrBool, descId, isYes, type) {
  let isBool = Boolean(isYes);
  let pillId = pillIdOrBool;
  let cardType = type;

  // Handle both 4-argument call: setCard(cardId, iconId, statusId, isYes)
  // and 7-argument call: setCard(cardId, iconId, statusId, pillId, descId, isYes, type)
  if (typeof pillIdOrBool === "boolean") {
    isBool = pillIdOrBool;
    pillId = cardId.startsWith("dns") ? "dnsPill" : "reachPill";
    descId = cardId.startsWith("dns") ? "dnsDesc" : "reachDesc";
    cardType = cardId.startsWith("dns") ? "dns" : "reach";
  }

  const card = document.getElementById(cardId);
  const icon = document.getElementById(iconId);
  const status = document.getElementById(statusId);
  const pill = document.getElementById(pillId);
  const desc = document.getElementById(descId);

  if (card) {
    card.classList.remove("yes", "no");
    card.classList.add(isBool ? "yes" : "no");
  }

  if (status) {
    status.classList.remove("yes", "no");
    status.textContent = isBool ? "Yes" : "No";
    status.classList.add(isBool ? "yes" : "no");
  }

  if (icon) {
    icon.classList.remove("yes", "no");
    icon.classList.add(isBool ? "yes" : "no");
    // Clean SVGs (no emojis)
    if (isBool) {
      icon.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;
    } else {
      icon.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;
    }
  }

  if (pill) {
    pill.classList.remove("yes", "no");
    pill.classList.add(isBool ? "yes" : "no");
    pill.textContent = isBool ? "Pass" : "Fail";
  }

  if (desc) {
    if (cardType === "dns") {
      desc.textContent = isBool
        ? "AAAA record resolves to an active IPv6 address"
        : "No IPv6 AAAA record detected for this host";
    } else {
      desc.textContent = isBool
        ? "Direct network connection established over IPv6"
        : "Could not establish an IPv6 connection to host";
    }
  }
}

// ─── Dependencies Table ─────────────────────────────────────────────────────
function renderDepsTable(deps) {
  const tbody = document.getElementById("depsBody");
  const summary = document.getElementById("depsSummary");
  tbody.innerHTML = "";

  const total = deps ? deps.length : 0;
  const ipv6ReadyCount = deps ? deps.filter((d) => d && Boolean(d.ipv6)).length : 0;

  if (summary) {
    if (total === 0) {
      summary.textContent = "0 third-party dependencies detected";
    } else {
      summary.textContent = `${total} ${total === 1 ? "dependency" : "dependencies"} found, ${ipv6ReadyCount} IPv6-ready`;
    }
  }

  if (!deps || deps.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="2">
        <div class="empty-deps-box">
          <div class="empty-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <p class="empty-title">No third-party dependencies found</p>
          <p class="empty-subtitle">This site does not load external domains, or dependencies could not be extracted.</p>
        </div>
      </td>`;
    tbody.appendChild(tr);
    return;
  }

  deps.forEach((dep) => {
    const isOk = dep && Boolean(dep.ipv6);
    const tr = document.createElement("tr");
    const badgeClass = isOk ? "ok" : "fail";
    const badgeText = isOk ? "IPv6 OK" : "IPv4 only";

    tr.innerHTML = `
      <td class="dep-host">${escapeHtml(dep.host || "")}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Chart ───────────────────────────────────────────────────────────────────
function renderChart(deps) {
  lastDeps = deps;

  // Destroy old chart if it exists
  if (depsChart) {
    try {
      depsChart.destroy();
    } catch (_) {}
    depsChart = null;
  }

  const canvas = document.getElementById("depsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const centerPercent = document.getElementById("chartCenterPercent");
  const centerSub = document.querySelector(".chart-center-sub");

  // Read theme color from CSS variable
  const legendColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--chart-legend")
    .trim() || "#334155";

  if (!deps || deps.length === 0) {
    if (centerPercent) centerPercent.textContent = "0%";
    if (centerSub) centerSub.textContent = "NO DEPS";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = legendColor;
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No dependencies to chart", canvas.width / 2, canvas.height / 2);
    ctx.restore();
    return;
  }

  const ipv6Count = deps.filter((d) => d && Boolean(d.ipv6)).length;
  const ipv4Count = deps.length - ipv6Count;
  const pct = Math.round((ipv6Count / deps.length) * 100);

  if (centerPercent) centerPercent.textContent = `${pct}%`;
  if (centerSub) centerSub.textContent = "IPV6 READY";

  // If Chart.js library is available, use it
  if (typeof Chart !== "undefined") {
    try {
      depsChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["IPv6 Ready", "IPv4 Only"],
          datasets: [
            {
              data: [ipv6Count, ipv4Count],
              backgroundColor: ["#10B981", "#EF4444"],
              borderWidth: 0,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: "74%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                padding: 18,
                usePointStyle: true,
                pointStyle: "circle",
                color: legendColor,
                font: {
                  family: "'Inter', sans-serif",
                  size: 13,
                  weight: 500,
                },
              },
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const count = context.parsed;
                  const total = deps.length;
                  const p = Math.round((count / total) * 100);
                  return ` ${context.label}: ${count} (${p}%)`;
                },
              },
            },
          },
        },
      });
      return;
    } catch (chartErr) {
      console.warn("Chart.js constructor failed, using 2D canvas fallback:", chartErr);
    }
  }

  // Direct canvas 2D fallback when Chart is not yet loaded or unavailable
  drawCanvasDoughnut(ctx, canvas, ipv6Count, ipv4Count, legendColor);
}

function drawCanvasDoughnut(ctx, canvas, ipv6Count, ipv4Count, legendColor) {
  const total = ipv6Count + ipv4Count;
  if (total === 0) return;

  const width = canvas.width || 280;
  const height = canvas.height || 220;
  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height * 0.42;
  const radius = Math.min(width, height) * 0.36;
  const lineWidth = 18;

  const ipv6Angle = (ipv6Count / total) * 2 * Math.PI;

  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  // Red (IPv4) ring
  ctx.strokeStyle = "#EF4444";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.stroke();

  // Green (IPv6) arc
  if (ipv6Count > 0) {
    ctx.strokeStyle = "#10B981";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + ipv6Angle);
    ctx.stroke();
  }
  ctx.restore();

  // Legend at bottom
  ctx.save();
  ctx.font = "500 12px Inter, sans-serif";
  ctx.textBaseline = "middle";

  const legendY = height - 16;
  const item1X = width * 0.14;
  const item2X = width * 0.58;

  // IPv6
  ctx.fillStyle = "#10B981";
  ctx.beginPath();
  ctx.arc(item1X, legendY, 5, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = legendColor;
  ctx.textAlign = "left";
  ctx.fillText(`IPv6 (${ipv6Count})`, item1X + 10, legendY);

  // IPv4
  ctx.fillStyle = "#EF4444";
  ctx.beginPath();
  ctx.arc(item2X, legendY, 5, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = legendColor;
  ctx.textAlign = "left";
  ctx.fillText(`IPv4 (${ipv4Count})`, item2X + 10, legendY);

  ctx.restore();
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
