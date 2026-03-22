function extract() {
  chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_JOB" }, res => {
    document.getElementById("output").innerText = JSON.stringify(res, null, 2);
  });
}