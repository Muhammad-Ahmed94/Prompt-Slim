class LLMOptimizer {
  constructor() {
    this.API_KEY = null;
    this.popup = null;
    this.init();
  }

  async init() {
    await this.loadAPIKey();
    this.createPopupUI();
    this.attachEventListeners();
  }

  async loadAPIKey() {
    const result = await chrome.storage.sync.get(["geminiApiKey"]);
    this.API_KEY = result.geminiApiKey;
  }

  createPopupUI() {
    // Create popup container
    this.popup = document.createElement("div");
    this.popup.className = "llm-optimizer-popup";

    // Create popup content
    this.popup.innerHTML = `
      <div class="llm-optimizer-header">
        <h3>LLM Input Optimizer</h3>
        <button class="llm-optimizer-minimize">−</button>
      </div>
      <div class="llm-optimizer-content">
        <textarea 
          placeholder="Enter your prompt here..." 
          class="llm-optimizer-input"
        ></textarea>
        <button class="llm-optimizer-button">Optimize</button>
        <div class="llm-optimizer-output-container">
          <textarea 
            readonly 
            placeholder="Optimized prompt will appear here..." 
            class="llm-optimizer-output"
          ></textarea>
          <button class="llm-optimizer-copy">Copy</button>
        </div>
        <div class="llm-optimizer-status"></div>
      </div>
    `;

    document.body.appendChild(this.popup);
  }

  async optimizePrompt(text) {
    if (!this.API_KEY) {
      throw new Error("API key not configured");
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Please optimize and shorten this prompt while preserving its core meaning and intent. Make it more concise and effective: "${text}"`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  attachEventListeners() {
    const minimizeBtn = this.popup.querySelector(".llm-optimizer-minimize");
    const optimizeBtn = this.popup.querySelector(".llm-optimizer-button");
    const copyBtn = this.popup.querySelector(".llm-optimizer-copy");
    const status = this.popup.querySelector(".llm-optimizer-status");

    // Minimize/Maximize functionality
    minimizeBtn.addEventListener("click", () => {
      this.popup.classList.toggle("minimized");
      minimizeBtn.textContent = this.popup.classList.contains("minimized")
        ? "+"
        : "−";
    });

    // Optimize button click handler
    optimizeBtn.addEventListener("click", async () => {
      const input = this.popup.querySelector(".llm-optimizer-input");
      const output = this.popup.querySelector(".llm-optimizer-output");

      if (!input.value.trim()) {
        status.textContent = "Please enter a prompt";
        status.className = "llm-optimizer-status error";
        return;
      }

      try {
        status.textContent = "Optimizing...";
        status.className = "llm-optimizer-status";
        optimizeBtn.disabled = true;

        const optimizedText = await this.optimizePrompt(input.value);
        output.value = optimizedText;

        status.textContent = "Optimization complete!";
        status.className = "llm-optimizer-status success";
      } catch (error) {
        status.textContent = "Optimization failed. Please check your API key.";
        status.className = "llm-optimizer-status error";
      } finally {
        optimizeBtn.disabled = false;
      }
    });

    // Copy button click handler
    copyBtn.addEventListener("click", () => {
      const output = this.popup.querySelector(".llm-optimizer-output");
      output.select();
      document.execCommand("copy");

      status.textContent = "Copied to clipboard!";
      status.className = "llm-optimizer-status success";
      setTimeout(() => {
        status.textContent = "";
      }, 2000);
    });
  }
}

// Initialize only on supported platforms
const supportedHosts = ["chat.openai.com", "gemini.google.com", "claude.ai"];

if (supportedHosts.includes(window.location.hostname)) {
  new LLMOptimizer();
}
