// content/apply.js
// NOTE: This is a "drop-in" pattern. If your existing file is different,
// copy the countedElementRuleKeys + INCR_PAGE logic into your element-rule loop.

let currentState = null;
const countedElementRuleKeys = new Set();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "STATE_UPDATED") {
    refresh().catch(() => {});
  }
});

async function getSyncState() {
  // You likely already have a GET_STATE call or similar; keep yours if so.
  // This placeholder expects you have a way to resolve the active rule state.
  // If your existing apply.js already fetches state, do not duplicate it.
  return currentState;
}

function ruleAppliesToThisPage(rule, url, origin) {
  if (!rule?.enabled) return false;
  if (rule.scope === "site") return true;
  if (rule.scope === "page") return rule.url === url;
  return false;
}

async function refresh() {
  // If you compute state on each refresh, also clear rule match tracking
  countedElementRuleKeys.clear();

  // ---- Your existing evaluation logic goes here ----
  // Below is only the element-rule matching + counter increment pattern.

  const url = location.href;
  const origin = location.origin;

  // Replace this with however you pull element rules:
  const data = await chrome.runtime.sendMessage({ type: "GET_STATE", url });
  if (!data?.ok) return;

  const sync = data.data;
  const rules = sync?.rules?.element?.[origin] ?? [];

  for (const r of rules) {
    if (!ruleAppliesToThisPage(r, url, origin)) continue;

    let nodes = [];
    try {
      nodes = Array.from(document.querySelectorAll(r.selector));
    } catch {
      continue;
    }

    // Count 1 per rule per page load when it matches something
    const ruleKey = `${r.scope}|${r.url || ""}|${r.selector}`;
    if (nodes.length > 0 && !countedElementRuleKeys.has(ruleKey)) {
      countedElementRuleKeys.add(ruleKey);
      try { chrome.runtime.sendMessage({ type: "INCR_PAGE", delta: 1 }); } catch {}
    }

    // Your existing "disable autofill/password manager" application for the matched nodes goes here
    // (e.g., setting autocomplete="off", readonly tricks, etc.)
  }
}

// initial load
refresh().catch(() => {});
