document.getElementById("saveBtn").addEventListener("click", async () => {
  const apiKey = document.getElementById("apiKey").value;
  const status = document.getElementById("status");

  if (!apiKey) {
    status.textContent = "Please enter an API key";
    status.style.color = "#dc3545";
    return;
  }

  try {
    await chrome.storage.sync.set({ geminiApiKey: apiKey });
    status.textContent = "API key saved successfully!";
    status.style.color = "#28a745";

    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  } catch (error) {
    status.textContent = "Error saving API key";
    status.style.color = "#dc3545";
  }
});

// Load existing API key
window.addEventListener("DOMContentLoaded", async () => {
  const result = await chrome.storage.sync.get(["geminiApiKey"]);
  if (result.geminiApiKey) {
    document.getElementById("apiKey").value = result.geminiApiKey;
  }
});
