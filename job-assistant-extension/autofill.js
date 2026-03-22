window.JobAutofill = {
  run(profile) {
    document.querySelectorAll("input").forEach(input => {
      if (input.name && profile[input.name]) {
        input.value = profile[input.name];
      }
    });
    return true;
  }
};