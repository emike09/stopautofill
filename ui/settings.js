// settings.js
const SYNC_KEY = "saf";

function isObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}
const el = (id) => document.getElementById(id);

let syncData = null;

// Load settings
async function loadSettings() {
  try {
    // Get version from manifest
    const manifest = chrome.runtime.getManifest();
    el("versionNumber").textContent = manifest.version;
    
    const resp = await chrome.runtime.sendMessage({ type: "GET_STATE", url: "" });
    if (!resp?.ok) return;
    
    syncData = resp.data;
    
    // Default settings
    el("defaultAutofill").checked = !!syncData.defaults.disableAutofill;
    el("defaultPassword").checked = !!syncData.defaults.disablePasswordManager;
	el("defaultRightClick").checked = !!syncData.defaults.disableRightClick;
    
    // Statistics
    el("totalBlocked").textContent = String(syncData.stats.totalFormsBlocked ?? 0);
    
    // Rule counts
    const siteRules = Object.keys(syncData.rules.site || {}).filter(k => syncData.rules.site[k]?.enabled).length;
    const pageRules = Object.keys(syncData.rules.page || {}).filter(k => syncData.rules.page[k]?.enabled).length;
    
    let elementRules = 0;
    if (syncData.rules.element) {
      for (const origin in syncData.rules.element) {
        const rules = syncData.rules.element[origin];
        if (Array.isArray(rules)) {
          elementRules += rules.filter(r => r?.enabled).length;
        }
      }
    }
    
    el("siteRuleCount").textContent = String(siteRules);
    el("pageRuleCount").textContent = String(pageRules);
    el("elementRuleCount").textContent = String(elementRules);
    
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

// Save defaults
async function saveDefaults() {
  if (!syncData) return;
  
  syncData.defaults.disableAutofill = el("defaultAutofill").checked;
  syncData.defaults.disablePasswordManager = el("defaultPassword").checked;
  syncData.defaults.disableRightClick = el("defaultRightClick").checked;
  
  await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: syncData });
}

function looksLikeSafData(d) {
  return (
    isObject(d) &&
    isObject(d.defaults) &&
    isObject(d.rules) &&
    isObject(d.stats)
  );
}

async function importSafDataFromFile(file) {
  // Read + parse
  const text = await file.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    alert("That file is not valid JSON.");
    return;
  }

  // Accept either:
  // A) full export: { defaults, rules, stats }
  // B) rules-only: { rules: {...} }  (we merge into current)
  let next = parsed;

  if (!looksLikeSafData(next)) {
    // rules-only fallback
    if (isObject(parsed) && isObject(parsed.rules) && syncData) {
      next = structuredClone(syncData);
      next.rules = parsed.rules;
    } else {
      alert("That JSON doesn't look like a Stop Autofill export.");
      return;
    }
  }

  // Ensure required defaults exist (for older exports)
  next.defaults = next.defaults || {};
  if (typeof next.defaults.disableAutofill !== "boolean") next.defaults.disableAutofill = true;
  if (typeof next.defaults.disablePasswordManager !== "boolean") next.defaults.disablePasswordManager = true;
  if (typeof next.defaults.disableRightClick !== "boolean") next.defaults.disableRightClick = false;

  // Make sure rules containers exist
  next.rules = next.rules || {};
  next.rules.site = next.rules.site || {};
  next.rules.page = next.rules.page || {};
  next.rules.element = next.rules.element || {};

  // Save via your existing background message path (keeps behavior consistent)
  await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: next });

  // Update local copy + refresh UI
  syncData = next;
  await loadSettings();

  alert("Rules imported successfully!");
}


// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  el("defaultAutofill")?.addEventListener("change", saveDefaults);
  el("defaultPassword")?.addEventListener("change", saveDefaults);
  el("defaultRightClick")?.addEventListener("change", saveDefaults);

  el("resetStats")?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset all statistics? This cannot be undone.")) return;
    if (syncData) {
      syncData.stats.totalFormsBlocked = 0;
      await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: syncData });
      await loadSettings();
    }
  });

  el("exportRules")?.addEventListener("click", () => {
    if (!syncData) return;

    const dataStr = JSON.stringify(syncData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `stop-autofill-rules-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Import button opens file picker
  el("importRules")?.addEventListener("click", () => {
    if (!syncData) return;
    const f = el("importFile");
    if (!f) return;
    f.value = ""; // allow re-importing same file twice
    f.click();
  });

  // File selection triggers import
el("importFile")?.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  // Let the event finish, then do the heavier work
  setTimeout(async () => {
    try {
      await importSafDataFromFile(file);
    } catch (err) {
      console.error("Import failed:", err);
      alert("Import failed. See console for details.");
    }
  }, 0);
});


el("clearAllRules")?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to clear ALL rules? This cannot be undone!")) return;
    if (syncData) {
      syncData.rules.site = {};
      syncData.rules.page = {};
      syncData.rules.element = {};
      await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: syncData });
      await loadSettings();
      alert("All rules have been cleared.");
    }
  });

  el("viewDocs")?.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/emike09/stopautofill" });
  });

  el("reportIssue")?.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/emike09/stopautofill/issues" });
  });

 el("tutorialLink")?.addEventListener("click", (e) => {
  const url = chrome.runtime.getURL("ui/tutorial.html");
    chrome.tabs.create({ url });
});

el("privacyLink")?.addEventListener("click", (e) => {
  e.preventDefault();
  
  const msg =
    "Stop Autofill Privacy Summary:\n\n" +
    "• Stop Autofill does not collect or transmit personal data.\n" +
    "• Your settings/rules are stored locally in your browser.\n" +
    "• If you have browser sync enabled, your settings may sync across your devices via your browser account.\n" +
    "• You can clear all stored rules anytime from this page.\n\n" +
    "Open the full privacy policy?";

  if (confirm(msg)) {
    const url = chrome.runtime.getURL("ui/privacy.html");
    chrome.tabs.create({ url });
  }
});

  loadSettings();
});
