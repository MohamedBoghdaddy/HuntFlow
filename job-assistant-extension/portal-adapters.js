window.JobPortalAdapters = {
  extract() {
    return {
      title: document.querySelector("h1")?.innerText || "",
      company: document.querySelector("h2")?.innerText || "",
      url: location.href
    };
  }
};