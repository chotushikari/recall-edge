const defaults = { apiBase: "http://127.0.0.1:8000", enabled: true };
const recent = new Map();

async function settings() {
  return { ...defaults, ...(await chrome.storage.local.get(defaults)) };
}

function browserName() {
  return navigator.userAgent.includes("Edg/") ? "Microsoft Edge" : "Google Chrome";
}

function safeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

async function record(tab) {
  if (!tab?.id || tab.incognito) return;
  const url = safeUrl(tab.url);
  if (!url) return;
  const config = await settings();
  if (!config.enabled) return;
  const fingerprint = `${url}|${tab.title || ""}`;
  if (recent.get(tab.id) === fingerprint) return;
  recent.set(tab.id, fingerprint);
  try {
    await fetch(`${config.apiBase.replace(/\/$/, "")}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_name: browserName(), window_title: tab.title || "Untitled tab", url, bundle_id: "browser-companion" })
    });
  } catch {
    // The local API may be stopped; never retry a stale browsing event later.
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => record(await chrome.tabs.get(tabId)));
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") record(tab);
});
chrome.tabs.onRemoved.addListener((tabId) => recent.delete(tabId));
