// sw.js
const SYNC_KEY = "saf"; // all sync data under one key to stay within per-item limits

const DEFAULTS = {
  defaults: {
    disableAutofill: true,
    disablePasswordManager: true
  },
  rules: {
    site: {},   // origin -> { disableAutofill, disablePasswordManager, enabled: true }
    page: {},   // url -> { disableAutofill, disablePasswordManager, enabled: true }
    element: {} // origin -> [ { selector, scope: "site"|"page", url?, disableAutofill, disablePasswordManager, enabled:true } ]
  },
  stats: {
    totalFormsBlocked: 0
  }
};

async function getSync() {
  const obj = await chrome.storage.sync.get(SYNC_KEY);
  return obj[SYNC_KEY] ?? structuredClone(DEFAULTS);
}

async function setSync(data) {
  await chrome.storage.sync.set({ [SYNC_KEY]: data });
}

function safeUrl(tab) {
  try { return tab?.url ? new URL(tab.url) : null; } catch { return null; }
}

function getOriginHref(u) {
  return u?.origin ?? null;
}

function isRestrictedUrl(u) {
  if (!u) return true;
  return ["chrome:", "edge:", "about:", "chrome-extension:"].includes(u.protocol);
}

/* ---------------- Pending refresh per tab ---------------- */

function tabKey(tabId) {
  return `pendingRefresh:${tabId}`;
}

async function setPendingRefresh(tabId, value) {
  const key = tabKey(tabId);
  if (value) {
    await chrome.storage.session.set({ [key]: true });
  } else {
    await chrome.storage.session.remove(key);
  }
}

async function getPendingRefresh(tabId) {
  const key = tabKey(tabId);
  const got = await chrome.storage.session.get(key);
  return !!got[key];
}

/* ---------------- Per-tab "blocked on this page" counter ---------------- */

function pageCountKey(tabId) { return `pageBlockedCount:${tabId}`; }
function pageUrlKey(tabId) { return `pageBlockedUrl:${tabId}`; }

async function resetPageCount(tabId, url) {
  if (typeof tabId !== "number") return;
  await chrome.storage.session.set({
    [pageCountKey(tabId)]: 0,
    [pageUrlKey(tabId)]: url ?? ""
  });
}

async function incrPageCount(tabId, url, delta) {
  if (typeof tabId !== "number") return 0;

  const keys = [pageCountKey(tabId), pageUrlKey(tabId)];
  const got = await chrome.storage.session.get(keys);

  const prevUrl = got[pageUrlKey(tabId)] ?? "";
  let count = Number(got[pageCountKey(tabId)] ?? 0);

  if (prevUrl !== url) {
    count = 0;
  }

  count += delta;

  await chrome.storage.session.set({
    [pageCountKey(tabId)]: count,
    [pageUrlKey(tabId)]: url
  });

  return count;
}

async function getPageCount(tabId, url) {
  if (typeof tabId !== "number") return 0;

  const keys = [pageCountKey(tabId), pageUrlKey(tabId)];
  const got = await chrome.storage.session.get(keys);

  const storedUrl = got[pageUrlKey(tabId)] ?? "";
  if (storedUrl !== url) return 0;

  return Number(got[pageCountKey(tabId)] ?? 0);
}

/* ---------------- Windows ---------------- */

async function openPanelWindow(openerTabId) {
  const url = chrome.runtime.getURL(`ui/panel.html?mode=window&tabId=${encodeURIComponent(openerTabId)}`);
  await chrome.windows.create({
    url,
    type: "popup",
    width: 420,
    height: 640
  });
}

async function openConfirmWindow(token) {
  await chrome.windows.create({
    url: chrome.runtime.getURL(`ui/confirm.html?token=${encodeURIComponent(token)}`),
    type: "popup",
    width: 520,
    height: 380
  });
}

/* ---------------- Picker state (session) ---------------- */

async function setPendingPick(pick) {
  const token = crypto.randomUUID();
  await chrome.storage.session.set({ ["pendingPick:" + token]: pick });
  return token;
}

async function takePendingPick(token) {
  const key = "pendingPick:" + token;
  const got = await chrome.storage.session.get(key);
  const pick = got[key];
  await chrome.storage.session.remove(key);
  return pick;
}

/* ---------------- Tab lifecycle ---------------- */

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    // Page finished loading = any pending refresh is now satisfied
    await setPendingRefresh(tabId, false);

    // Reset per-page count for this tab + url
    await resetPageCount(tabId, tab?.url ?? "");
  }
});

/* ---------------- Context menu ---------------- */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open_panel",
    title: "Stop Autofill settings…",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "block_element",
    title: "Stop Autofill: Block element…",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const u = safeUrl(tab);
  if (!u || isRestrictedUrl(u)) return;

  if (info.menuItemId === "open_panel") {
    await openPanelWindow(tab.id);
  }

  if (info.menuItemId === "block_element") {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "PICKER_START" });
    } catch {}
  }
});

/* ---------------- Messages ---------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    // Panel asks for current state for a URL
    if (msg?.type === "GET_STATE") {
      const data = await getSync();
      const u = msg.url ? new URL(msg.url) : safeUrl(sender?.tab);
      const origin = getOriginHref(u);

      const pageRule = u ? data.rules.page[u.href] : null;
      const siteRule = origin ? data.rules.site[origin] : null;

      sendResponse({
        ok: true,
        data,
        url: u?.href ?? null,
        origin,
        pageRule: pageRule ?? null,
        siteRule: siteRule ?? null
      });
      return;
    }

    if (msg?.type === "SET_SYNC") {
      await setSync(msg.payload);
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "SET_PENDING_REFRESH") {
      const tabId = msg.tabId ?? sender?.tab?.id;
      if (typeof tabId === "number") {
        await setPendingRefresh(tabId, !!msg.value);
      }
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "GET_PENDING_REFRESH") {
      const tabId = msg.tabId ?? sender?.tab?.id;
      const value = (typeof tabId === "number") ? await getPendingRefresh(tabId) : false;
      sendResponse({ ok: true, value });
      return;
    }

    if (msg?.type === "CLEAR_PENDING_REFRESH") {
      const tabId = msg.tabId ?? sender?.tab?.id;
      if (typeof tabId === "number") {
        await setPendingRefresh(tabId, false);
      }
      sendResponse({ ok: true });
      return;
    }

    // Increment total counter (sync across devices)
    if (msg?.type === "INCR_TOTAL") {
      const delta = Number(msg.delta || 0);
      if (!Number.isFinite(delta) || delta <= 0) {
        sendResponse({ ok: true });
        return;
      }
      const data = await getSync();
      data.stats.totalFormsBlocked = (data.stats.totalFormsBlocked || 0) + delta;
      await setSync(data);
      sendResponse({ ok: true, total: data.stats.totalFormsBlocked });
      return;
    }

    // Increment per-page counter (session per tab)
    if (msg?.type === "INCR_PAGE") {
      const tabId = sender?.tab?.id;
      const url = sender?.tab?.url ?? "";
      const delta = Number(msg.delta || 0);

      if (!Number.isFinite(delta) || delta <= 0 || typeof tabId !== "number") {
        sendResponse({ ok: true, count: 0 });
        return;
      }

      const count = await incrPageCount(tabId, url, delta);
      sendResponse({ ok: true, count });
      return;
    }

    // Panel requests current per-page counter
    if (msg?.type === "GET_PAGE_COUNT") {
      const tabId = msg.tabId ?? sender?.tab?.id;
      const url = msg.url ?? sender?.tab?.url ?? "";
      const count = await getPageCount(tabId, url);
      sendResponse({ ok: true, count });
      return;
    }

    // Picker finished: open confirmation window with token
    if (msg?.type === "PICKER_RESULT") {
      const token = await setPendingPick({
        pickedAt: Date.now(),
        ...msg.pick
      });
      await openConfirmWindow(token);
      sendResponse({ ok: true });
      return;
    }

    // Confirm window pulls selection
    if (msg?.type === "GET_PENDING_PICK") {
      const pick = await takePendingPick(msg.token);
      sendResponse({ ok: true, pick: pick ?? null });
      return;
    }
  })();

  return true;
});
