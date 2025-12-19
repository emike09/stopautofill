const qs = new URLSearchParams(location.search);
const token = qs.get("token");

const meta = document.getElementById("meta");
const disablePwd = document.getElementById("disablePwd");
const disableAutofill = document.getElementById("disableAutofill");

let pick = null;
let sync = null;

async function load() {
  const resp = await chrome.runtime.sendMessage({ type: "GET_PENDING_PICK", token });
  pick = resp?.pick;

  if (!pick) {
    meta.textContent = "Selection expired. Please try again.";
    document.getElementById("save").disabled = true;
    return;
  }

  meta.textContent = `${pick.origin}\n${pick.selector ?? "(no selector)"}\n(tag: ${pick.tag})`;

  // Load sync state for defaults
  const st = await chrome.runtime.sendMessage({ type: "GET_STATE", url: pick.url });
  sync = st?.data;

  disablePwd.checked = !!(sync?.defaults?.disablePasswordManager);
  disableAutofill.checked = !!(sync?.defaults?.disableAutofill);
}

function selectedScope() {
  return document.querySelector('input[name="scope"]:checked')?.value ?? "site";
}

document.getElementById("cancel").addEventListener("click", () => window.close());

document.getElementById("save").addEventListener("click", async () => {
  if (!pick || !sync) return;

  const scope = selectedScope();

  // Store element rule under origin
  const list = (sync.rules.element[pick.origin] ??= []);
  list.push({
    enabled: true,
    selector: pick.selector,
    scope,
    url: scope === "page" ? pick.url : undefined,
    disablePasswordManager: !!disablePwd.checked,
    disableAutofill: !!disableAutofill.checked
  });

  await chrome.runtime.sendMessage({ type: "SET_SYNC", payload: sync });

  // Find the real page tab (confirm window is its own window)
  const tabs = await chrome.tabs.query({ url: pick.url });
  const targetTab = tabs?.[0];

  if (targetTab?.id) {
    // Persist “refresh required” UI until reload completes
// Clear pending refresh (we're about to refresh for them)
// Count this as 1 "blocked" action globally (tiny synced counter)
await chrome.runtime.sendMessage({ type: "INCR_TOTAL", delta: 1 });

await chrome.runtime.sendMessage({
  type: "SET_PENDING_REFRESH",
  tabId: targetTab.id,
  value: false
});

// Reload the page so the change takes effect immediately
try {
  await chrome.tabs.reload(targetTab.id);
} catch {
  // Fallback: if reload fails (rare), mark pending refresh
  await chrome.runtime.sendMessage({
    type: "SET_PENDING_REFRESH",
    tabId: targetTab.id,
    value: true
  });
}

  }

  window.close();
});


load();
