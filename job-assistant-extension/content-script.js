chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_JOB") {
    const job = window.JobPortalAdapters.extract();
    sendResponse({ ok: true, job });
  }

  if (message.type === "AUTOFILL_PAGE") {
    chrome.storage.local.get("profile").then(({ profile }) => {
      const result = window.JobAutofill.run(profile || {});
      sendResponse({ ok: true, result });
    });
  }

  return true;
});