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

    // Test the API key
    const testResult = await testApiKey(apiKey);
    if (testResult.success) {
      status.textContent = "API key saved and verified successfully!";
      status.style.color = "#28a745";

      // Show model information if available
      if (testResult.modelName) {
        const modelInfo = document.createElement("p");
        modelInfo.textContent = `Using model: ${testResult.modelName}`;
        modelInfo.style.fontSize = "12px";
        modelInfo.style.marginTop = "5px";
        status.appendChild(modelInfo);
      }
    } else {
      status.textContent = `API key saved but validation failed: ${testResult.error}`;
      status.style.color = "#ffc107"; // Warning color
    }

    setTimeout(() => {
      status.textContent = "";
    }, 5000);
  } catch (error) {
    status.textContent = "Error saving API key";
    status.style.color = "#dc3545";
  }
});

// Test the API key by listing models
async function testApiKey(apiKey) {
  try {
    // Try to list models to verify the API key works
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || "API returned an error",
      };
    }

    const data = await response.json();

    // Find a model that supports generateContent
    let modelName = "";
    if (data.models && Array.isArray(data.models)) {
      const contentModel = data.models.find(
        (model) =>
          model.supportedGenerationMethods &&
          model.supportedGenerationMethods.includes("generateContent")
      );

      if (contentModel) {
        modelName = contentModel.displayName || contentModel.name;

        // Store the validated model name for future use
        await chrome.storage.sync.set({
          validatedModelName: contentModel.name,
          modelDisplayName: contentModel.displayName || contentModel.name,
        });
      }
    }

    return {
      success: true,
      modelName: modelName,
    };
  } catch (error) {
    console.error("Error testing API key:", error);
    return {
      success: false,
      error: error.message || "Network error when testing API key",
    };
  }
}

// Load existing API key
window.addEventListener("DOMContentLoaded", async () => {
  const result = await chrome.storage.sync.get([
    "geminiApiKey",
    "modelDisplayName",
  ]);

  if (result.geminiApiKey) {
    document.getElementById("apiKey").value = result.geminiApiKey;
  }

  // Display model info if available
  if (result.modelDisplayName) {
    const status = document.getElementById("status");
    status.textContent = `Using model: ${result.modelDisplayName}`;
    status.style.color = "#28a745";
    status.style.fontSize = "12px";
  }
});
