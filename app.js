const CONFIG = {
  ca: {
    htmlLang: "ca",
    target: "EUR",
    symbol: "€",
    fallbackRate: 0.0054,
    locale: "ca-ES",
    currencyLocale: "ca-ES",
    cacheKey: "jpy_rate_EUR_v3",
    title: "¥ JPY → € EUR",
    eyebrow: "Canvi ràpid",
    amountLabel: "Import en iens",
    resultLabel: "Equivalent aproximat",
    rateLabel: "Canvi utilitzat",
    refresh: "Actualitza",
    feeLabel: "Comissió targeta / marge (%)",
    noFee: "Sense comissió aplicada.",
    initial: "Valor inicial aproximat. Prem “Actualitza” quan tinguis internet.",
    statusChecking: "Comprovant…",
    statusUpdating: "Actualitzant…",
    statusOnline: "Online",
    statusOffline: "Offline",
    statusNoNew: "Sense dades noves",
    never: "mai",
    now: "ara mateix",
    minutesAgo: n => `fa ${n} min`,
    hoursAgo: n => `fa ${n} h`,
    daysAgo: n => `fa ${n} dies`,
    updated: (rel, date, source) => `Actualitzat ${rel} · ${date} · font: ${source}`,
    feeApplied: (fee, yen) => `Inclou un marge/comissió del ${fee}% sobre ${yen} ¥.`,
    note: "<strong>Funciona offline:</strong> si no hi ha internet, calcula amb l’últim canvi guardat i t’indica quan es va actualitzar.",
    sourceInitial: "valor inicial"
  },
  en: {
    htmlLang: "en",
    target: "MYR",
    symbol: "RM",
    fallbackRate: 0.0269,
    locale: "en-GB",
    currencyLocale: "en-MY",
    cacheKey: "jpy_rate_MYR_v3",
    title: "¥ JPY → RM MYR",
    eyebrow: "Quick exchange",
    amountLabel: "Amount in yen",
    resultLabel: "Approximate equivalent",
    rateLabel: "Rate used",
    refresh: "Refresh",
    feeLabel: "Card fee / margin (%)",
    noFee: "No fee applied.",
    initial: "Approximate initial value. Tap “Refresh” when you have internet.",
    statusChecking: "Checking…",
    statusUpdating: "Updating…",
    statusOnline: "Online",
    statusOffline: "Offline",
    statusNoNew: "No new data",
    never: "never",
    now: "just now",
    minutesAgo: n => `${n} min ago`,
    hoursAgo: n => `${n} h ago`,
    daysAgo: n => `${n} days ago`,
    updated: (rel, date, source) => `Updated ${rel} · ${date} · source: ${source}`,
    feeApplied: (fee, yen) => `Includes a ${fee}% card fee/margin on ¥${yen}.`,
    note: "<strong>Works offline:</strong> if there is no internet, it uses the last saved exchange rate and shows when it was updated.",
    sourceInitial: "initial value"
  }
};

const LANG_KEY = "jpy_converter_lang_v3";
const yenInput = document.querySelector("#yenInput");
const feeInput = document.querySelector("#feeInput");
const resultValue = document.querySelector("#resultValue");
const rateText = document.querySelector("#rateText");
const updatedText = document.querySelector("#updatedText");
const feeText = document.querySelector("#feeText");
const statusBadge = document.querySelector("#statusBadge");
const refreshBtn = document.querySelector("#refreshBtn");
const clearBtn = document.querySelector("#clearBtn");
const langSelect = document.querySelector("#langSelect");

let lang = localStorage.getItem(LANG_KEY) || (((navigator.language || "").toLowerCase().startsWith("en")) ? "en" : "ca");
let state;

function cfg() { return CONFIG[lang]; }

function parseNumber(value) {
  if (!value) return 0;
  return Number(String(value).replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0;
}

function formatTarget(value) {
  return new Intl.NumberFormat(cfg().currencyLocale, {
    style: "currency",
    currency: cfg().target,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatJPY(value) {
  return new Intl.NumberFormat(cfg().locale, { maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso) {
  if (!iso) return cfg().never;
  return new Intl.DateTimeFormat(cfg().locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function relativeTime(iso) {
  if (!iso) return cfg().never;
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return cfg().now;
  if (minutes < 60) return cfg().minutesAgo(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return cfg().hoursAgo(hours);
  const days = Math.round(hours / 24);
  return cfg().daysAgo(days);
}

function loadRate() {
  try {
    const cached = JSON.parse(localStorage.getItem(cfg().cacheKey));
    if (cached?.rate) return cached;
  } catch (_) {}
  // Compatibility with the original EUR app cache.
  if (cfg().target === "EUR") {
    try {
      const old = JSON.parse(localStorage.getItem("jpy_eur_rate_cache_v2") || localStorage.getItem("jpy_eur_rate_cache_v1"));
      if (old?.rate) return old;
    } catch (_) {}
  }
  return { rate: cfg().fallbackRate, updatedAt: null, source: cfg().sourceInitial };
}

function saveRate(rate, source = "currency-api") {
  state = { rate, updatedAt: new Date().toISOString(), source };
  localStorage.setItem(cfg().cacheKey, JSON.stringify(state));
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

function applyLanguage() {
  const c = cfg();
  document.documentElement.lang = c.htmlLang;
  document.title = c.title;
  document.querySelector("#title").textContent = c.title;
  document.querySelector("#eyebrow").textContent = c.eyebrow;
  document.querySelector("#amountLabel").textContent = c.amountLabel;
  document.querySelector("#resultLabel").textContent = c.resultLabel;
  document.querySelector("#rateLabel").textContent = c.rateLabel;
  document.querySelector("#feeLabel").textContent = c.feeLabel;
  document.querySelector("#noteText").innerHTML = c.note;
  refreshBtn.textContent = c.refresh;
  clearBtn.setAttribute("aria-label", lang === "ca" ? "Esborra" : "Clear");
  langSelect.value = lang;
  setStatus(navigator.onLine ? "online" : "offline", navigator.onLine ? c.statusOnline : c.statusOffline);
}

function render() {
  const yen = parseNumber(yenInput.value);
  const fee = Math.max(0, parseNumber(feeInput.value));
  const targetValue = yen * state.rate * (1 + fee / 100);
  const rateFormatted = state.rate.toLocaleString(cfg().locale, { minimumFractionDigits: 6, maximumFractionDigits: 6 });

  resultValue.textContent = formatTarget(targetValue);
  rateText.textContent = `1 ¥ = ${rateFormatted} ${cfg().symbol}`;
  updatedText.textContent = state.updatedAt
    ? cfg().updated(relativeTime(state.updatedAt), formatDate(state.updatedAt), state.source)
    : cfg().initial;
  feeText.textContent = fee > 0
    ? cfg().feeApplied(fee.toLocaleString(cfg().locale), formatJPY(yen))
    : cfg().noFee;
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
  const targetLower = cfg().target.toLowerCase();
  const url = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/jpy.json";
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error("currency-api unavailable");
  const data = await response.json();
  const rate = data?.jpy?.[targetLower];
  if (!rate) throw new Error(`Response without ${cfg().target} rate`);
  return { rate, source: "currency-api · jsDelivr" };
}

async function getRateFromFrankfurter() {
  if (cfg().target !== "EUR") throw new Error("Frankfurter only used here for EUR fallback");
  const response = await fetchWithTimeout("https://api.frankfurter.app/latest?from=JPY&to=EUR");
  if (!response.ok) throw new Error("frankfurter unavailable");
  const data = await response.json();
  const rate = data?.rates?.EUR;
  if (!rate) throw new Error("Response without EUR rate");
  return { rate, source: "frankfurter.app" };
}

async function updateRate() {
  if (!navigator.onLine) {
    setStatus("offline", cfg().statusOffline);
    render();
    return;
  }

  setStatus("", cfg().statusUpdating);
  refreshBtn.disabled = true;

  try {
    let result;
    try {
      result = await getRateFromCurrencyApi();
    } catch (_) {
      result = await getRateFromFrankfurter();
    }
    saveRate(result.rate, result.source);
    setStatus("online", cfg().statusOnline);
  } catch (error) {
    setStatus("offline", cfg().statusNoNew);
  } finally {
    refreshBtn.disabled = false;
    render();
    focusYen(false);
  }
}

function switchLanguage(newLang) {
  lang = newLang;
  localStorage.setItem(LANG_KEY, lang);
  state = loadRate();
  applyLanguage();
  render();
  updateRate();
}

yenInput.addEventListener("input", render);
yenInput.addEventListener("focus", () => yenInput.select());
feeInput.addEventListener("input", render);
refreshBtn.addEventListener("click", updateRate);
langSelect.addEventListener("change", event => switchLanguage(event.target.value));
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

window.addEventListener("online", () => { setStatus("online", cfg().statusOnline); updateRate(); });
window.addEventListener("offline", () => { setStatus("offline", cfg().statusOffline); render(); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

state = loadRate();
applyLanguage();
render();
focusYen(true);
updateRate();
