// Variable to store API key and model
let GEMINI_API_KEY;
let CURRENT_MODEL;

// Function to load API key and model from Chrome storage
async function loadApiKeyAndModel() {
  try {
    const result = await chrome.storage.sync.get([
      "geminiApiKey",
      "validatedModelName",
    ]);
    if (result.geminiApiKey) {
      GEMINI_API_KEY = result.geminiApiKey;
      CURRENT_MODEL = result.validatedModelName || "gemini-pro"; // Default to gemini-pro if not set
      console.log(`Loaded model: ${CURRENT_MODEL}`);
      return true;
    } else {
      console.log("API key not found in storage");
      return false;
    }
  } catch (error) {
    console.error("Error loading API key:", error);
    return false;
  }
}

// Function to create popup
function createPopup() {
  // Create popup container
  const popupContainer = document.createElement("div");
  popupContainer.className = "prompt-optimizer-popup";
  popupContainer.innerHTML = `
    <div class="prompt-optimizer-header">
      <h3>Prompt Optimizer</h3>
      <button class="prompt-optimizer-close-btn">&times;</button>
    </div>
    <div class="prompt-optimizer-content">
      <textarea 
        id="originalPrompt" 
        placeholder="Enter your prompt here..." 
        rows="6"
      ></textarea>
      <button id="optimizeBtn" class="prompt-optimizer-btn">Optimize Prompt</button>
      <div id="loadingIndicator" class="prompt-optimizer-loading">
        <div class="spinner"></div>
        <span>Optimizing...</span>
      </div>
      <div class="prompt-optimizer-result-container">
        <textarea 
          id="optimizedPrompt" 
          placeholder="Optimized prompt will appear here..." 
          rows="6" 
          readonly
        ></textarea>
        <button id="copyBtn" class="prompt-optimizer-btn">Copy to Clipboard</button>
      </div>
      <div id="modelInfo" class="prompt-optimizer-model-info"></div>
    </div>
  `;

  document.body.appendChild(popupContainer);

  // Add event listeners
  document
    .querySelector(".prompt-optimizer-close-btn")
    .addEventListener("click", () => {
      popupContainer.classList.add("prompt-optimizer-hidden");
    });

  document.getElementById("optimizeBtn").addEventListener("click", async () => {
    const originalPrompt = document
      .getElementById("originalPrompt")
      .value.trim();
    if (!originalPrompt) {
      alert("Please enter a prompt to optimize");
      return;
    }

    // Check if API key is loaded
    if (!GEMINI_API_KEY) {
      const success = await loadApiKeyAndModel();
      if (!success) {
        alert("Please set your Gemini API key in the extension popup");
        return;
      }
    }

    // Show loading indicator
    document.getElementById("loadingIndicator").style.display = "flex";
    document.getElementById("optimizeBtn").disabled = true;

    try {
      const optimizedPrompt = await optimizePrompt(originalPrompt);
      document.getElementById("optimizedPrompt").value = optimizedPrompt;
    } catch (error) {
      console.error("Error optimizing prompt:", error);
      alert(`Error optimizing prompt: ${error.message}`);
    } finally {
      // Hide loading indicator
      document.getElementById("loadingIndicator").style.display = "none";
      document.getElementById("optimizeBtn").disabled = false;
    }
  });

  document.getElementById("copyBtn").addEventListener("click", () => {
    const optimizedPrompt = document.getElementById("optimizedPrompt");
    optimizedPrompt.select();
    document.execCommand("copy");

    // Visual feedback
    const copyBtn = document.getElementById("copyBtn");
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy to Clipboard";
    }, 2000);
  });

  // Add toggle button to show/hide popup
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "prompt-optimizer-toggle-btn";
  toggleBtn.innerHTML = "✨";
  toggleBtn.title = "Toggle Prompt Optimizer";
  document.body.appendChild(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    popupContainer.classList.toggle("prompt-optimizer-hidden");
  });
}

// Function to optimize prompt using Gemini API
async function optimizePrompt(originalPrompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("API key not loaded");
  }

  // Use the stored model name for the API endpoint
  const apiEndpoint = `https://generativelanguage.googleapis.com/v1/models/${CURRENT_MODEL}:generateContent`;

  const promptData = {
    contents: [
      {
        parts: [
          {
            text: `Please optimize and shorten this prompt while preserving its original intent and all important details. Make it concise and effective for an AI assistant:
                  
Original prompt:
"${originalPrompt}"

Return only the optimized prompt without any explanation or additional text.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 800,
    },
  };

  try {
    console.log(
      `Making API request to: ${apiEndpoint} using model ${CURRENT_MODEL}`
    );

    const response = await fetch(`${apiEndpoint}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(promptData),
    });

    console.log("API response status:", response.status);

    const responseText = await response.text();
    console.log("Raw API response:", responseText);

    // Try to parse the response as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", parseError);
      throw new Error(
        `API returned invalid JSON: ${responseText.substring(0, 100)}...`
      );
    }

    if (!response.ok) {
      console.error("API error details:", data);
      const errorMsg = data.error?.message || response.statusText;

      // Check for API key issues
      if (
        errorMsg.includes("API key") ||
        response.status === 403 ||
        response.status === 401
      ) {
        throw new Error(
          "API key invalid or unauthorized. Please check your API key."
        );
      } else if (errorMsg.includes("model") || errorMsg.includes("not found")) {
        // If it's a model error, try to get a valid model and retry
        await findValidModel();
        throw new Error(`Model error: ${errorMsg}. Please try again.`);
      } else {
        throw new Error(`API error: ${errorMsg}`);
      }
    }

    // Extract the optimized prompt from the response
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const optimizedText = data.candidates[0].content.parts[0].text;
      // Clean up the response (remove quotes if present)
      return optimizedText.replace(/^["'](.*)["']$/s, "$1").trim();
    } else {
      console.error("Unexpected API response structure:", data);
      throw new Error("Unexpected API response format");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

// Function to find a valid model that supports generateContent
async function findValidModel() {
  try {
    const listModelsEndpoint =
      "https://generativelanguage.googleapis.com/v1/models";
    const response = await fetch(`${listModelsEndpoint}?key=${GEMINI_API_KEY}`);

    if (response.ok) {
      const data = await response.json();
      console.log("Available models:", data);

      // Find models that support generateContent
      if (data.models && Array.isArray(data.models)) {
        const validModels = data.models.filter(
          (model) =>
            model.supportedGenerationMethods &&
            model.supportedGenerationMethods.includes("generateContent")
        );

        console.log("Models supporting generateContent:", validModels);

        if (validModels.length > 0) {
          // Use the first valid model
          CURRENT_MODEL = validModels[0].name;

          // Store it for future use
          await chrome.storage.sync.set({
            validatedModelName: CURRENT_MODEL,
            modelDisplayName: validModels[0].displayName || CURRENT_MODEL,
          });

          console.log(`Updated to valid model: ${CURRENT_MODEL}`);

          // Update the UI with model info
          const modelInfo = document.getElementById("modelInfo");
          if (modelInfo) {
            modelInfo.textContent = `Using model: ${
              validModels[0].displayName || CURRENT_MODEL
            }`;
          }

          return true;
        }
      }
    } else {
      console.error("Failed to list models:", await response.text());
    }
    return false;
  } catch (error) {
    console.error("Error finding valid model:", error);
    return false;
  }
}

// Initialize extension
(async function init() {
  // Load API key and model
  await loadApiKeyAndModel();

  // Create popup UI
  createPopup();

  // Initially hide the popup
  document
    .querySelector(".prompt-optimizer-popup")
    .classList.add("prompt-optimizer-hidden");

  // Display current model info
  const modelInfo = document.getElementById("modelInfo");
  if (modelInfo && CURRENT_MODEL) {
    const result = await chrome.storage.sync.get(["modelDisplayName"]);
    if (result.modelDisplayName) {
      modelInfo.textContent = `Using model: ${result.modelDisplayName}`;
    } else {
      modelInfo.textContent = `Using model: ${CURRENT_MODEL}`;
    }
  }
})();
