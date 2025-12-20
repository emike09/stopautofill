const qs = new URLSearchParams(location.search);
const token = qs.get("token");

const meta = document.getElementById("meta");
const disablePwd = document.getElementById("disablePwd");
const disableAutofill = document.getElementById("disableAutofill");
const saveBtn = document.getElementById("save");
const originDisplay = document.getElementById("originDisplay");

let pick = null;
let sync = null;

async function load() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "GET_PENDING_PICK", token });
    pick = resp?.pick;

    if (!pick) {
      meta.textContent = "Selection expired. Please try again.";
      saveBtn.disabled = true;
      return;
    }

    meta.textContent = `Selector: ${pick.selector || "(no selector)"}\nTag: ${pick.tag}`;
    
    if (originDisplay) {
      originDisplay.textContent = pick.origin;
    }

    // Load sync state for defaults
    const st = await chrome.runtime.sendMessage({ type: "GET_STATE", url: pick.url });
    sync = st?.data;

    // Default to enabled
    disablePwd.checked = true;
    disableAutofill.checked = true;
  } catch (err) {
    meta.textContent = "Error loading selection: " + err.message;
    saveBtn.disabled = true;
  }
}

document.getElementById("cancel").addEventListener("click", () => window.close());

document.getElementById("save").addEventListener("click", async () => {
  if (!pick || !sync) return;

  // Always use site scope for element rules
  const scope = "site";

  // Store element rule under origin
  const list = (sync.rules.element[pick.origin] ??= []);
  list.push({
    enabled: true,
    selector: pick.selector,
    scope: scope,
    disablePasswordManager: !!disablePwd.checked,
    disableAutofill: !!disableAutofill.checked
  });

  await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: sync });

  // Increment total counter
  await chrome.runtime.sendMessage({ type: "INCR_TOTAL", delta: 1 });

  // Find the page tab and reload it
  try {
    const tabs = await chrome.tabs.query({ url: pick.url });
    const targetTab = tabs?.[0];

    if (targetTab?.id) {
      await chrome.runtime.sendMessage({
        type: "SET_PENDING_REFRESH",
        tabId: targetTab.id,
        value: false
      });

      await chrome.tabs.reload(targetTab.id);
    }
  } catch (err) {
    console.error("Could not reload tab:", err);
  }

  window.close();
});

load();
