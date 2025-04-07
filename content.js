// Variable to store API key
let GEMINI_API_KEY;

// Function to load API key from Chrome storage
async function loadApiKey() {
  try {
    console.log("Attempting to load API key from Chrome storage");

    const result = await chrome.storage.sync.get(["geminiApiKey"]);

    if (result.geminiApiKey) {
      console.log(
        "API key found in storage, length:",
        result.geminiApiKey.length
      );
      GEMINI_API_KEY = result.geminiApiKey;
      return true;
    } else {
      console.error("API key not found in Chrome storage");
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
      const success = await loadApiKey();
      if (!success) {
        alert(
          "API key not found. Please set your Gemini API key in the extension popup."
        );
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
      alert("Error optimizing prompt: " + error.message);
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
async function optimizePrompt(originalPrompt, retryCount = 0, maxRetries = 3) {
  if (!GEMINI_API_KEY) {
    throw new Error("API key not loaded");
  }

  // Updated endpoint to use Gemini 2.0 Flash-Lite model
  const apiEndpoint =
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent";

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
    const response = await fetch(`${apiEndpoint}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(promptData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || response.statusText;

      // Check if it's an overload error and we haven't exceeded max retries
      if (errorMessage.includes("overloaded") && retryCount < maxRetries) {
        // Calculate delay with exponential backoff (1s, 2s, 4s, etc.)
        const delay = Math.pow(2, retryCount) * 1000;

        // Show retry message to user
        console.log(`API is busy. Retrying in ${delay / 1000} seconds...`);

        // Wait for the delay
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Retry with incremented retry count
        return optimizePrompt(originalPrompt, retryCount + 1, maxRetries);
      }

      throw new Error(`API error: ${errorMessage}`);
    }

    // Rest of function for processing successful response...
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

// Initialize extension
(async function init() {
  // Load API key
  await loadApiKey();

  // Create popup UI
  createPopup();

  // Initially hide the popup
  document
    .querySelector(".prompt-optimizer-popup")
    .classList.add("prompt-optimizer-hidden");
})();
