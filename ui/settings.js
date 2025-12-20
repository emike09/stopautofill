// settings.js

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
  
  await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: syncData });
}

// Event listeners
el("defaultAutofill").addEventListener("change", saveDefaults);
el("defaultPassword").addEventListener("change", saveDefaults);

el("resetStats").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to reset all statistics? This cannot be undone.")) return;
  
  if (syncData) {
    syncData.stats.totalFormsBlocked = 0;
    await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: syncData });
    await loadSettings();
  }
});

el("exportRules").addEventListener("click", () => {
  if (!syncData) return;
  
  const dataStr = JSON.stringify(syncData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `stop-autofill-rules-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

el("clearAllRules").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to clear ALL rules? This will remove:\n- All site rules\n- All page rules\n- All element rules\n\nThis cannot be undone!")) return;
  
  if (syncData) {
    syncData.rules.site = {};
    syncData.rules.page = {};
    syncData.rules.element = {};
    
    await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: syncData });
    await loadSettings();
    
    alert("All rules have been cleared.");
  }
});

el("viewDocs").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://github.com/yourusername/stop-autofill" });
});

el("reportIssue").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://github.com/yourusername/stop-autofill/issues" });
});

el("privacyLink").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Stop Autofill Privacy Policy:\n\n" +
    "• We do not collect any personal data\n" +
    "• We do not store form values or passwords\n" +
    "• We only store: URLs, CSS selectors, and settings\n" +
    "• All data is stored locally in your browser\n" +
    "• Data syncs via Chrome Sync if you enable it\n" +
    "• You can clear all data anytime from this page");
});

// Initialize
loadSettings();
