const FALLBACK_RATE = 0.0054; // EUR per 1 JPY, valor inicial aproximat
const STORAGE_KEY = "jpy_eur_rate_cache_v2";

const yenInput = document.querySelector("#yenInput");
const feeInput = document.querySelector("#feeInput");
const eurResult = document.querySelector("#eurResult");
const rateText = document.querySelector("#rateText");
const updatedText = document.querySelector("#updatedText");
const feeText = document.querySelector("#feeText");
const statusBadge = document.querySelector("#statusBadge");
const refreshBtn = document.querySelector("#refreshBtn");
const clearBtn = document.querySelector("#clearBtn");

let state = loadRate();

function parseNumber(value) {
  if (!value) return 0;
  return Number(String(value).replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0;
}

function formatEUR(value) {
  return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatJPY(value) {
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso) {
  if (!iso) return "mai";
  return new Intl.DateTimeFormat("ca-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function relativeTime(iso) {
  if (!iso) return "mai";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "ara mateix";
  if (minutes < 60) return `fa ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `fa ${hours} h`;
  const days = Math.round(hours / 24);
  return `fa ${days} dies`;
}

function loadRate() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem("jpy_eur_rate_cache_v1"));
    if (cached?.rate) return cached;
  } catch (_) {}
  return { rate: FALLBACK_RATE, updatedAt: null, source: "valor inicial" };
}

function saveRate(rate, source = "currency-api") {
  state = { rate, updatedAt: new Date().toISOString(), source };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setStatus(kind, text) {
  statusBadge.className = `badge ${kind}`;
  statusBadge.textContent = text;
}

function focusYen(select = false) {
  window.setTimeout(() => {
    yenInput.focus({ preventScroll: true });
    if (select) yenInput.select();
  }, 50);
}

function render() {
  const yen = parseNumber(yenInput.value);
  const fee = Math.max(0, parseNumber(feeInput.value));
  const eur = yen * state.rate * (1 + fee / 100);

  eurResult.textContent = formatEUR(eur);
  rateText.textContent = `1 ¥ = ${state.rate.toLocaleString("ca-ES", { minimumFractionDigits: 6, maximumFractionDigits: 6 })} €`;
  updatedText.textContent = state.updatedAt
    ? `Actualitzat ${relativeTime(state.updatedAt)} · ${formatDate(state.updatedAt)} · font: ${state.source}`
    : `Valor inicial aproximat. Prem “Actualitza” quan tinguis internet.`;
  feeText.textContent = fee > 0
    ? `Inclou un marge/comissió del ${fee.toLocaleString("ca-ES")}% sobre ${formatJPY(yen)} ¥.`
    : "Sense comissió aplicada.";
}

async function fetchWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getRateFromCurrencyApi() {
  const url = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/jpy.json";
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error("currency-api no disponible");
  const data = await response.json();
  const rate = data?.jpy?.eur;
  if (!rate) throw new Error("Resposta sense canvi EUR");
  return { rate, source: "currency-api · jsDelivr" };
}

async function getRateFromFrankfurter() {
  const response = await fetchWithTimeout("https://api.frankfurter.app/latest?from=JPY&to=EUR");
  if (!response.ok) throw new Error("frankfurter no disponible");
  const data = await response.json();
  const rate = data?.rates?.EUR;
  if (!rate) throw new Error("Resposta sense canvi EUR");
  return { rate, source: "frankfurter.app" };
}

async function updateRate() {
  if (!navigator.onLine) {
    setStatus("offline", "Offline");
    render();
    return;
  }

  setStatus("", "Actualitzant…");
  refreshBtn.disabled = true;

  try {
    // Servei principal: fitxer estàtic via CDN, acostuma a donar menys problemes en mòbil.
    let result;
    try {
      result = await getRateFromCurrencyApi();
    } catch (_) {
      // Pla B, per si el CDN falla.
      result = await getRateFromFrankfurter();
    }
    saveRate(result.rate, result.source);
    setStatus("online", "Online");
  } catch (error) {
    setStatus("offline", "Sense dades noves");
  } finally {
    refreshBtn.disabled = false;
    render();
    focusYen(false);
  }
}

yenInput.addEventListener("input", render);
yenInput.addEventListener("focus", () => yenInput.select());
feeInput.addEventListener("input", render);
refreshBtn.addEventListener("click", updateRate);
clearBtn.addEventListener("click", () => {
  yenInput.value = "";
  render();
  focusYen(false);
});

document.querySelectorAll("[data-yen]").forEach(btn => {
  btn.addEventListener("click", () => {
    yenInput.value = btn.dataset.yen;
    render();
    focusYen(true);
  });
});

window.addEventListener("online", () => { setStatus("online", "Online"); updateRate(); });
window.addEventListener("offline", () => { setStatus("offline", "Offline"); render(); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

setStatus(navigator.onLine ? "online" : "offline", navigator.onLine ? "Online" : "Offline");
render();
focusYen(true);
updateRate();
