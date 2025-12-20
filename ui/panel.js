const el = (id) => document.getElementById(id);

let current = {
  url: null,
  origin: null,
  sync: null,
  activeScope: "site",
  tabId: null
};

let dirty = false;

/* ---------------- Helpers ---------------- */

function dotSet(button, on) {
  if (!button) return;
  button.classList.toggle("on", !!on);
}

function setDirty(on) {
  dirty = !!on;
  const refreshCard = el("refreshCard");
  const statsCard = el("statsCard");
  if (refreshCard && statsCard) {
    refreshCard.classList.toggle("hidden", !dirty);
    statsCard.classList.toggle("hidden", dirty);
  }
}

async function getTargetTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function computeGlobalOn(data, url, origin) {
  if (!data || !url || !origin) return false;
  return !!(data.rules.page[url]?.enabled || data.rules.site[origin]?.enabled);
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

function getActiveRule(data, url, origin) {
  // Page rule takes precedence if enabled
  if (data.rules.page[url]?.enabled) {
    return { scope: "page", rule: data.rules.page[url] };
  }
  
  // Then site rule
  if (data.rules.site[origin]?.enabled) {
    return { scope: "site", rule: data.rules.site[origin] };
  }
  
  // No active rule
  return null;
}

/* ---------------- State management ---------------- */

async function saveSync() {
  await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: current.sync });
  
  if (current.tabId) {
    try {
      await chrome.tabs.sendMessage(current.tabId, { type: "STATE_UPDATED" });
    } catch {}
  }
}

async function loadState() {
  try {
    const tab = await getTargetTab();
    if (!tab?.url) return;

    current.tabId = tab.id;
    const url = tab.url;

    const resp = await chrome.runtime.sendMessage({ type: "GET_STATE", url });
    if (!resp?.ok) return;

    current.url = resp.url;
    current.origin = resp.origin;
    current.sync = resp.data;

    // UI updates
    el("origin").textContent = current.origin ?? "—";
    const urlObj = current.url ? new URL(current.url) : null;
    el("page").textContent = urlObj ? urlObj.pathname : "—";

    const siteRule = current.sync.rules.site[current.origin];
    const pageRule = current.sync.rules.page[current.url];

    const siteOn = !!siteRule?.enabled;
    const pageOn = !!pageRule?.enabled;

    dotSet(el("toggleSite"), siteOn);
    dotSet(el("togglePage"), pageOn);
		if (siteOn) {
		  dotSet(el("togglePage"), true);
		  el("togglePage")?.classList.add("locked");
		} else {
		  el("togglePage")?.classList.remove("locked");
		}

    // Determine active scope based on precedence
    const activeRuleInfo = getActiveRule(current.sync, current.url, current.origin);
    current.activeScope = activeRuleInfo?.scope || "site";

    const globalOn = computeGlobalOn(current.sync, current.url, current.origin);
    const hasElems = hasElementsForThisPage(current.sync, current.origin, current.url);
    const elementOnlyMode = hasElems && !globalOn;
    
    const globalStateEl = el("globalState");
    if (globalStateEl) {
      if (elementOnlyMode) {
        // Element blocking is active but no site/page rules
        globalStateEl.textContent = "ELEMENTS";
        globalStateEl.style.background = "#cc0202";
        globalStateEl.style.color = "white";
        globalStateEl.classList.add("element-only");
      } else if (globalOn) {
        // Normal ON state (site or page rule active)
        globalStateEl.textContent = "ON";
        globalStateEl.style.background = "#4caf50";
        globalStateEl.style.color = "white";
        globalStateEl.classList.remove("element-only");
      } else {
        // OFF state
        globalStateEl.textContent = "OFF";
        globalStateEl.style.background = "#e0e0e0";
        globalStateEl.style.color = "#666";
        globalStateEl.classList.remove("element-only");
      }
    }

    // Feature toggles show the active rule's settings
    if (activeRuleInfo) {
      dotSet(el("toggleAutofill"), !!activeRuleInfo.rule.disableAutofill);
      dotSet(el("togglePwd"), !!activeRuleInfo.rule.disablePasswordManager);
    } else {
      dotSet(el("toggleAutofill"), false);
      dotSet(el("togglePwd"), false);
    }

    // Elements row (hasElems calculated above)
    el("elementsRow")?.classList.toggle("hidden", !hasElems);

    // Stats
    el("blockedTotal").textContent = String(current.sync.stats.totalFormsBlocked ?? 0);

    // Per-page counter
    const pageResp = await chrome.runtime.sendMessage({ 
      type: "GET_PAGE_COUNT", 
      tabId: current.tabId, 
      url: current.url 
    });
    el("blockedHere").textContent = String(pageResp?.count ?? 0);

    // Check refresh state
    const refreshResp = await chrome.runtime.sendMessage({ 
      type: "GET_PENDING_REFRESH", 
      tabId: current.tabId 
    });
    setDirty(!!refreshResp?.value);

  } catch (err) {
    console.error("Error loading state:", err);
  }
}

/* ---------------- Event Handlers ---------------- */

el("toggleSite").addEventListener("click", async () => {
  const data = current.sync;
  const origin = current.origin;
  const url = current.url;
  if (!data || !origin || !url) return;

  // Ensure site rule exists
  if (!data.rules.site[origin]) {
    data.rules.site[origin] = {
      enabled: false,
      disableAutofill: data.defaults.disableAutofill,
      disablePasswordManager: data.defaults.disablePasswordManager
    };
  }

  // Ensure page rule exists (so we can toggle it on when site is enabled)
  if (!data.rules.page[url]) {
    data.rules.page[url] = {
      enabled: false,
      disableAutofill: data.defaults.disableAutofill,
      disablePasswordManager: data.defaults.disablePasswordManager
    };
  }

  const siteRule = data.rules.site[origin];
  const pageRule = data.rules.page[url];

  // Toggle site
  siteRule.enabled = !siteRule.enabled;

  if (siteRule.enabled) {
    // Enabling site rule: force both features on
    siteRule.disableAutofill = true;
    siteRule.disablePasswordManager = true;
    current.activeScope = "site";

    // ALSO enable this page (your requested behavior)
    pageRule.enabled = true;
    pageRule.disableAutofill = true;
    pageRule.disablePasswordManager = true;
  } else {
    // Disabling site rule: do NOT change pageRule (or disable it if you prefer)
    // If you want disabling site to also disable page, uncomment:
    // pageRule.enabled = false;
  }

  await chrome.runtime.sendMessage({
    type: "SET_PENDING_REFRESH",
    tabId: current.tabId,
    value: true
  });

  await saveSync();
  await loadState();
});


el("togglePage").addEventListener("click", async () => {
  const data = current.sync;
  const url = current.url;
  if (!data || !url) return;
const siteRule = data.rules.site[current.origin];
	if (siteRule?.enabled) {
	  // Site rule is on, so page can't be turned off (no exceptions supported)
	  // Optional: show a small message instead of silent return
	  // alert("This page can't be disabled while 'This website' is enabled.");
	  return;
	}
  // Initialize if doesn't exist
  if (!data.rules.page[url]) {
    data.rules.page[url] = {
      enabled: false,
      disableAutofill: data.defaults.disableAutofill,
      disablePasswordManager: data.defaults.disablePasswordManager
    };
  }

  const rule = data.rules.page[url];
  rule.enabled = !rule.enabled;

   await chrome.runtime.sendMessage({ 
    type: "SET_PENDING_REFRESH", 
    tabId: current.tabId, 
    value: true 
  });

  await saveSync();
  await loadState();
});

el("toggleAutofill").addEventListener("click", async () => {
  const data = current.sync;
  if (!data || !current.url || !current.origin) return;

  // Get the currently active rule
  const activeRuleInfo = getActiveRule(data, current.url, current.origin);
  
  if (!activeRuleInfo) {
    // No rule is active - enable page rule with autofill disabled
    data.rules.page[current.url] = {
      enabled: true,
      disableAutofill: true,
      disablePasswordManager: false
    };
    current.activeScope = "page";
  } else {
    // Toggle autofill on the active rule
    const rule = activeRuleInfo.rule;
    rule.disableAutofill = !rule.disableAutofill;
    
    // If both features are now off, disable the rule entirely
    if (!rule.disableAutofill && !rule.disablePasswordManager) {
      rule.enabled = false;
    }
  }

  await chrome.runtime.sendMessage({ 
    type: "SET_PENDING_REFRESH", 
    tabId: current.tabId, 
    value: true 
  });

  await saveSync();
  await loadState();
});

el("togglePwd").addEventListener("click", async () => {
  const data = current.sync;
  if (!data || !current.url || !current.origin) return;

  // Get the currently active rule
  const activeRuleInfo = getActiveRule(data, current.url, current.origin);
  
  if (!activeRuleInfo) {
    // No rule is active - enable page rule with password manager disabled
    data.rules.page[current.url] = {
      enabled: true,
      disableAutofill: false,
      disablePasswordManager: true
    };
    current.activeScope = "page";
  } else {
    // Toggle password manager on the active rule
    const rule = activeRuleInfo.rule;
    rule.disablePasswordManager = !rule.disablePasswordManager;
    
    // If both features are now off, disable the rule entirely
    if (!rule.disableAutofill && !rule.disablePasswordManager) {
      rule.enabled = false;
    }
  }

  await chrome.runtime.sendMessage({ 
    type: "SET_PENDING_REFRESH", 
    tabId: current.tabId, 
    value: true 
  });

  await saveSync();
  await loadState();
});

el("blockElement")?.addEventListener("click", async () => {
  if (!current.tabId) return;

  const btn = el("blockElement");
  const oldText = btn.textContent;

  btn.classList.add("picking");
  btn.textContent = "🧱 Select element…";

  try {
    // Try to send message first
    await chrome.tabs.sendMessage(current.tabId, { type: "PICKER_START" });
  } catch (err) {
    // If content script not injected, inject it now
    try {
      await chrome.scripting.executeScript({
        target: { tabId: current.tabId },
        files: ["content/picker.js"]
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: current.tabId },
        files: ["content/picker.css"]
      });
      
      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try again
      await chrome.tabs.sendMessage(current.tabId, { type: "PICKER_START" });
    } catch (injectErr) {
      console.error("Failed to inject and start picker:", injectErr);
      alert("Could not start element picker. Please refresh the page and try again.");
      btn.classList.remove("picking");
      btn.textContent = oldText;
      return;
    }
  }

  // Reset button after 20 seconds
  setTimeout(() => {
    btn.classList.remove("picking");
    btn.textContent = oldText;
  }, 20000);
});

el("refreshPage")?.addEventListener("click", async () => {
  if (!current.tabId) return;

  await chrome.runtime.sendMessage({ 
    type: "CLEAR_PENDING_REFRESH", 
    tabId: current.tabId 
  });

  try {
    await chrome.tabs.reload(current.tabId);
  } catch {}

  window.close();
});

el("clearElements")?.addEventListener("click", async () => {
  const data = current.sync;
  const origin = current.origin;
  if (!data || !origin) return;

  if (!confirm("Clear all element rules for this site?")) return;

  if (data.rules.element && data.rules.element[origin]) {
    delete data.rules.element[origin];
  }

  await chrome.runtime.sendMessage({ 
    type: "SET_PENDING_REFRESH", 
    tabId: current.tabId, 
    value: true 
  });

  await saveSync();
  await loadState();
});

el("settingsBtn")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("ui/settings.html") });
});

// ---- Report Issue dropdown ----
(function setupReportIssueMenu() {
  const btn = document.getElementById("reportIssueBtn");
  const menu = document.getElementById("reportMenu");
  const email = document.getElementById("reportEmail");
  const gh = document.getElementById("reportGithub");

  if (!btn || !menu || !email || !gh) return;

  function openMenu() {
    menu.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    menu.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    const isHidden = menu.classList.contains("hidden");
    if (isHidden) openMenu();
    else closeMenu();
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  // Close menu if you click anywhere else inside the popup
  document.addEventListener("click", () => closeMenu());

  // Email option
  email.addEventListener("click", async (e) => {
    e.preventDefault();
    closeMenu();
    const url = "mailto:contact@stopautofill.com?subject=" + encodeURIComponent("Stop Autofill - Issue");
    try {
      await chrome.tabs.create({ url });
    } catch {
      // fallback
      window.open(url, "_blank");
    }
  });

  // GitHub option
  gh.addEventListener("click", async (e) => {
    e.preventDefault();
    closeMenu();
    const url = "https://github.com/emike09/stopautofill/issues";
    try {
      await chrome.tabs.create({ url });
    } catch {
      window.open(url, "_blank");
    }
  });

  // ESC closes menu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
})();

/* ---------------- Init ---------------- */

(async () => {
  await loadState();
})();
