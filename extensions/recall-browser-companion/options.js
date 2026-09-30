const defaults = { apiBase: "http://127.0.0.1:8000", enabled: true };
const enabled = document.querySelector("#enabled");
const apiBase = document.querySelector("#api-base");
const status = document.querySelector("#status");

chrome.storage.local.get(defaults).then((config) => {
  enabled.checked = config.enabled;
  apiBase.value = config.apiBase;
});
document.querySelector("#save").addEventListener("click", async () => {
  const value = apiBase.value.replace(/\/$/, "");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(value)) {
    status.textContent = "Use a localhost or 127.0.0.1 URL with a port.";
    return;
  }
  await chrome.storage.local.set({ enabled: enabled.checked, apiBase: value });
  status.textContent = "Saved.";
});
