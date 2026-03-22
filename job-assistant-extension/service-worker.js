const DEFAULT_API_URL = "https://huntflow-backend.onrender.com";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ jobs: [], profile: {} });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.windowId) return;
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for REPORT_APPLICATION messages from content scripts or the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "REPORT_APPLICATION") {
    handleReportApplication(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    // Return true to indicate we will respond asynchronously
    return true;
  }
});

async function handleReportApplication(payload) {
  const { jobUrl, jobTitle, company, status } = payload || {};

  // Load API URL and user token from sync storage
  const stored = await chrome.storage.sync.get(["huntflowApiUrl", "huntflowUserToken"]);
  const apiUrl = stored.huntflowApiUrl || DEFAULT_API_URL;
  const userToken = stored.huntflowUserToken || "";

  const endpoint = `${apiUrl}/api/applications/report`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobUrl: jobUrl || "",
      jobTitle: jobTitle || "",
      company: company || "",
      status: status || "applied",
      userToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Report failed (${response.status}): ${text}`);
  }

  return response.json();
}