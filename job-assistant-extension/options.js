const DEFAULT_API_URL = "https://huntflow-backend.onrender.com";

function save() {
  const name = document.getElementById("name").value;
  const apiUrl = (document.getElementById("apiUrl")?.value || "").trim() || DEFAULT_API_URL;
  const userToken = (document.getElementById("userToken")?.value || "").trim();

  chrome.storage.local.set({ profile: { name } });

  chrome.storage.sync.set(
    {
      huntflowApiUrl: apiUrl,
      huntflowUserToken: userToken,
    },
    () => {
      const status = document.getElementById("saveStatus");
      if (status) {
        status.textContent = "Saved!";
        setTimeout(() => {
          status.textContent = "";
        }, 2000);
      }
    },
  );
}

function load() {
  chrome.storage.local.get(["profile"], (result) => {
    const nameEl = document.getElementById("name");
    if (nameEl && result.profile?.name) {
      nameEl.value = result.profile.name;
    }
  });

  chrome.storage.sync.get(["huntflowApiUrl", "huntflowUserToken"], (result) => {
    const apiUrlEl = document.getElementById("apiUrl");
    const tokenEl = document.getElementById("userToken");

    if (apiUrlEl) {
      apiUrlEl.value = result.huntflowApiUrl || DEFAULT_API_URL;
    }
    if (tokenEl) {
      tokenEl.value = result.huntflowUserToken || "";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  load();

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", save);
  }
});
