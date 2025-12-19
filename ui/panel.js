const el = (id) => document.getElementById(id);

let current = {
  url: null,
  origin: null,
  sync: null,
  activeScope: "site"
};

let dirty = false;

/* ---------------- Target tab resolution (popup vs window mode) ---------------- */

const params = new URLSearchParams(location.search);
const TARGET_TAB_ID = params.has("tabId") ? Number(params.get("tabId")) : null;

async function getTargetTab() {
  if (Number.isFinite(TARGET_TAB_ID)) {
    try { return await chrome.tabs.get(TARGET_TAB_ID); } catch { /* ignore */ }
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function getActiveTabUrl() {
  const tab = await getTargetTab();
  return tab?.url ?? null;
}

/* ---------------- Refresh card UI ---------------- */

function setDirty(on) {
  dirty = !!on;
  const refreshCard = document.getElementById("refreshCard");
  const statsCard = document.getElementById("statsCard");
  if (!refreshCard || !statsCard) return;

  refreshCard.classList.toggle("hidden", !dirty);
  statsCard.classList.toggle("hidden", dirty);
}

async function setPendingRefresh(value) {
  const tab = await getTargetTab();
  if (!tab?.id) return;
  await chrome.runtime.sendMessage({ type: "SET_PENDING_REFRESH", tabId: tab.id, value });
  setDirty(value);
}

async function loadPendingRefresh() {
  const tab = await getTargetTab();
  if (!tab?.id) return setDirty(false);

  const resp = await chrome.runtime.sendMessage({ type: "GET_PENDING_REFRESH", tabId: tab.id });
  setDirty(!!resp?.value);
}

/* ---------------- Helpers ---------------- */

function dotSet(button, on) {
  if (!button) return;
  button.classList.toggle("on", !!on);
}

function computeGlobalOn(data, url, origin) {
  if (!data || !url || !origin) return false;
  return !!(data.rules.page[url]?.enabled || data.rules.site[origin]?.enabled);
}

function anyScopeEnabled(data, url, origin) {
  return !!(data?.rules?.page?.[url]?.enabled || data?.rules?.site?.[origin]?.enabled);
}

function ensureRule(data, scope, url, origin) {
  if (scope === "page") {
    data.rules.page[url] ??= {
      enabled: true,
      disableAutofill: data.defaults.disableAutofill,
      disablePasswordManager: data.defaults.disablePasswordManager
    };
    return data.rules.page[url];
  }

  data.rules.site[origin] ??= {
    enabled: true,
    disableAutofill: data.defaults.disableAutofill,
    disablePasswordManager: data.defaults.disablePasswordManager
  };
  return data.rules.site[origin];
}

function enforceRuleHasEffect(scope) {
  const data = current.sync;
  if (!data || !current.url || !current.origin) return;

  const rule =
    scope === "page"
      ? data.rules.page[current.url]
      : data.rules.site[current.origin];

  if (!rule) return;

  const hasEffect = !!rule.disableAutofill || !!rule.disablePasswordManager;
  if (!hasEffect) rule.enabled = false;
}

function enforceFeaturesOffWhenNoScopes(data, url, origin) {
  const siteEnabled = !!data?.rules?.site?.[origin]?.enabled;
  const pageEnabled = !!data?.rules?.page?.[url]?.enabled;

  if (!siteEnabled && !pageEnabled) {
    if (data.rules.site[origin]) {
      data.rules.site[origin].disableAutofill = false;
      data.rules.site[origin].disablePasswordManager = false;
    }
    if (data.rules.page[url]) {
      data.rules.page[url].disableAutofill = false;
      data.rules.page[url].disablePasswordManager = false;
    }
  }
}

function hasElementsForThisPage(data, origin, url) {
  const arr = data?.rules?.element?.[origin];
  if (!Array.isArray(arr)) return false;

  return arr.some(r =>
    r &&
    r.enabled &&
    r.selector &&
    (r.scope === "site" || (r.scope === "page" && r.url === url))
  );
}

function enforcePageOnWhenOnlyElements(data, origin, url) {
  const hasElems = hasElementsForThisPage(data, origin, url);
  const siteOn = !!data?.rules?.site?.[origin]?.enabled;
  const pageOn = !!data?.rules?.page?.[url]?.enabled;

  if (hasElems && !siteOn && !pageOn) {
    data.rules.page[url] ??= {
      enabled: true,
      disableAutofill: false,
      disablePasswordManager: false
    };
    data.rules.page[url].enabled = true;
    data.rules.page[url].disableAutofill = false;
    data.rules.page[url].disablePasswordManager = false;
  }
}

/* ---------------- State load/save ---------------- */

async function saveSync() {
  await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: current.sync });

  const tab = await getTargetTab();
  if (tab?.id) {
    try { await chrome.tabs.sendMessage(tab.id, { type: "STATE_UPDATED" }); } catch {}
  }
}

async function loadState() {
  const url = await getActiveTabUrl();
  if (!url) return;

  const resp = await chrome.runtime.sendMessage({ type: "GET_STATE", url });
  if (!resp?.ok) return;

  current.url = resp.url;
  current.origin = resp.origin;
  current.sync = resp.data;

  // If element blocks exist for this page and no scopes are enabled, light up "This page"
  enforcePageOnWhenOnlyElements(current.sync, current.origin, current.url);

  // Persist enforcement so it survives reopening panel
  await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: current.sync });

  const siteRule = current.sync.rules.site[current.origin];
  const pageRule = current.sync.rules.page[current.url];

  el("origin").textContent = current.origin ?? "—";
  el("page").textContent = (current.url ? new URL(current.url).pathname : "—");

  const siteOn = !!siteRule?.enabled;
  const pageOn = !!pageRule?.enabled;

  dotSet(el("toggleSite"), siteOn);
  dotSet(el("togglePage"), pageOn);

  current.activeScope = siteOn ? "site" : (pageOn ? "page" : "site");

  const globalOn = computeGlobalOn(current.sync, current.url, current.origin);
  el("globalState").textContent = globalOn ? "ON" : "OFF";
  el("globalState").style.color = globalOn ? "#2ecc71" : "#ff3b3b";

  const activeRule =
    current.activeScope === "page"
      ? current.sync.rules.page[current.url]
      : current.sync.rules.site[current.origin];

  if (!siteOn && !pageOn) {
    dotSet(el("toggleAutofill"), false);
    dotSet(el("togglePwd"), false);
  } else {
    const disableAutofill = activeRule?.disableAutofill ?? current.sync.defaults.disableAutofill;
    const disablePwd = activeRule?.disablePasswordManager ?? current.sync.defaults.disablePasswordManager;

    dotSet(el("toggleAutofill"), !!disableAutofill);
    dotSet(el("togglePwd"), !!disablePwd);
  }

  // Elements Blocked row only if element rules apply to this page
  const hasElemsHere = hasElementsForThisPage(current.sync, current.origin, current.url);
  const elementsRow = document.getElementById("elementsRow");
  if (elementsRow) elementsRow.classList.toggle("hidden", !hasElemsHere);

  // Total counter
  el("blockedTotal").textContent = String(current.sync.stats.totalFormsBlocked ?? 0);

  // Per-page counter (session per tab)
  const tab = await getTargetTab();
  const tabId = tab?.id;

  let here = 0;
  if (tabId && current.url) {
    const r = await chrome.runtime.sendMessage({ type: "GET_PAGE_COUNT", tabId, url: current.url });
    here = Number(r?.count ?? 0);
  }
  el("blockedHere").textContent = String(here);
}

/* ---------------- UI event handlers ---------------- */

el("toggleSite").addEventListener("click", async () => {
  const data = current.sync;
  const origin = current.origin;
  if (!data || !origin) return;

  data.rules.site[origin] ??= {
    enabled: false,
    disableAutofill: data.defaults.disableAutofill,
    disablePasswordManager: data.defaults.disablePasswordManager
  };

  data.rules.site[origin].enabled = !data.rules.site[origin].enabled;

  if (data.rules.site[origin].enabled) {
    data.rules.site[origin].disableAutofill = true;
    data.rules.site[origin].disablePasswordManager = true;
  }

  current.activeScope = "site";
  enforceFeaturesOffWhenNoScopes(data, current.url, current.origin);
  await setPendingRefresh(true);

  await saveSync();
  await loadState();
});

el("togglePage").addEventListener("click", async () => {
  const data = current.sync;
  const url = current.url;
  if (!data || !url) return;

  data.rules.page[url] ??= {
    enabled: false,
    disableAutofill: data.defaults.disableAutofill,
    disablePasswordManager: data.defaults.disablePasswordManager
  };

  data.rules.page[url].enabled = !data.rules.page[url].enabled;

  if (data.rules.page[url].enabled) {
    data.rules.page[url].disableAutofill = true;
    data.rules.page[url].disablePasswordManager = true;
  }

  current.activeScope = "page";
  enforceFeaturesOffWhenNoScopes(data, current.url, current.origin);
  await setPendingRefresh(true);

  await saveSync();
  await loadState();
});

el("togglePwd").addEventListener("click", async () => {
  const data = current.sync;
  if (!data || !current.url || !current.origin) return;

  const rule = ensureRule(data, current.activeScope, current.url, current.origin);
  rule.disablePasswordManager = !rule.disablePasswordManager;

  if (rule.disablePasswordManager && !anyScopeEnabled(data, current.url, current.origin)) {
    data.rules.page[current.url] ??= {
      enabled: true,
      disableAutofill: data.defaults.disableAutofill,
      disablePasswordManager: data.defaults.disablePasswordManager
    };
    data.rules.page[current.url].enabled = true;
    data.rules.page[current.url].disablePasswordManager = true;
    data.rules.page[current.url].disableAutofill = !!rule.disableAutofill;
    current.activeScope = "page";
  }

  enforceRuleHasEffect(current.activeScope);
  await setPendingRefresh(true);

  await saveSync();
  await loadState();
});

el("toggleAutofill").addEventListener("click", async () => {
  const data = current.sync;
  if (!data || !current.url || !current.origin) return;

  const rule = ensureRule(data, current.activeScope, current.url, current.origin);
  rule.disableAutofill = !rule.disableAutofill;

  if (rule.disableAutofill && !anyScopeEnabled(data, current.url, current.origin)) {
    data.rules.page[current.url] ??= {
      enabled: true,
      disableAutofill: data.defaults.disableAutofill,
      disablePasswordManager: data.defaults.disablePasswordManager
    };
    data.rules.page[current.url].enabled = true;
    data.rules.page[current.url].disableAutofill = true;
    data.rules.page[current.url].disablePasswordManager = !!rule.disablePasswordManager;
    current.activeScope = "page";
  }

  enforceRuleHasEffect(current.activeScope);
  await setPendingRefresh(true);

  await saveSync();
  await loadState();
});

el("blockElement").addEventListener("click", async () => {
  const tab = await getTargetTab();
  if (!tab?.id) return;

  const btn = el("blockElement");
  const oldText = btn.textContent;

  btn.classList.add("picking");
  btn.textContent = "🧱 Select an element…";

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PICKER_START" });
  } catch {}

  setTimeout(() => {
    btn.classList.remove("picking");
    btn.textContent = oldText;
  }, 20000);
});

document.getElementById("refreshPage")?.addEventListener("click", async () => {
  const tab = await getTargetTab();
  if (tab?.id) {
    await chrome.runtime.sendMessage({ type: "CLEAR_PENDING_REFRESH", tabId: tab.id });
    await chrome.tabs.reload(tab.id);
  }
  window.close();
});

document.getElementById("clearElements")?.addEventListener("click", async () => {
  const data = current.sync;
  const origin = current.origin;
  if (!data || !origin) return;

  if (data.rules.element && data.rules.element[origin]) {
    delete data.rules.element[origin];
  }

  // If page was only enabled for element-only mode (features false), turn it OFF
  const siteOn = !!data.rules.site?.[origin]?.enabled;
  const pageRule = data.rules.page?.[current.url];

  if (!siteOn && pageRule?.enabled && !pageRule.disableAutofill && !pageRule.disablePasswordManager) {
    pageRule.enabled = false;
  }

  await setPendingRefresh(true);
  await saveSync();
  await loadState();
});

/* ---------------- Startup ---------------- */

(async () => {
  await loadState();
  await loadPendingRefresh();
})();
