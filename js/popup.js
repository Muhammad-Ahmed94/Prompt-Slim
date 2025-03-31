document.getElementById("saveBtn").addEventListener("click", async () => {
  const apiKey = document.getElementById("apiKey").value;

  await chrome.storage.sync.set({
    geminiApiKey: apiKey,
  });

  // Show success message
  const button = document.getElementById("saveBtn");
  button.textContent = "Saved!";
  setTimeout(() => {
    button.textContent = "Save";
  }, 2000);
});

// Load existing API key
window.addEventListener("DOMContentLoaded", async () => {
  const result = await chrome.storage.sync.get(["geminiApiKey"]);
  if (result.geminiApiKey) {
    document.getElementById("apiKey").value = result.geminiApiKey;
  }
});
