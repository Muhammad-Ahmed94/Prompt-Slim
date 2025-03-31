console.log("Prompt Slim Content Script Loaded.");

let optimizeButton = null;
let targetInput = null;
let currentWebsite = ""; // To store which site we are on

// --- Configuration for different websites ---
const siteConfigs = {
  "chat.openai.com": {
    selector: "textarea",
    getText: (el) => el.value,
    setText: (el, text) => {
      el.value = text;
      // Trigger input event to update any framework listeners (like React)
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length); // Move cursor to end
    },
    getParentForButton: (el) => el.parentElement, // Button goes next to textarea
  },
  "gemini.google.com": {
    // Gemini often uses complex structures, selector might need adjustment
    selector: ".input-area .ql-editor.textarea", // This might change, inspect element!
    getText: (el) => el.textContent,
    setText: (el, text) => {
      el.textContent = text;
      // Trigger input/change events if necessary for the site's framework
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.focus();
      // Set cursor requires different handling for contenteditable divs
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false); // false = collapse to end
      sel.removeAllRanges();
      sel.addRange(range);
    },
    getParentForButton: (el) => el.closest(".input-area") || el.parentElement, // Find a suitable container
  },
  "claude.ai": {
    // Claude also uses contenteditable divs, selector might need adjustment
    selector: "ProseMirror break-words max-w-[60ch]", // ProseMirror break-words max-w-[60ch]
    getText: (el) => el.textContent,
    setText: (el, text) => {
      el.textContent = text;
      // Trigger input/change events if necessary
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.focus();
      // Set cursor for contenteditable
      const range = document.createRange();
      const sel = window.getSelection();
      if (el.firstChild) {
        // Place cursor after last child node
        range.setStartAfter(el.lastChild);
      } else {
        // If empty, just set start
        range.setStart(el, 0);
      }
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    },
    getParentForButton: (el) =>
      el.parentElement?.parentElement || el.parentElement, // Adjust based on structure
  },
};

function getCurrentSiteConfig() {
  const hostname = window.location.hostname;
  if (hostname.includes("chat.openai.com")) //chatgpt.com
    return siteConfigs["chat.openai.com"]; //chatgpt.com
  if (hostname.includes("gemini.google.com"))
    return siteConfigs["gemini.google.com"];
  if (hostname.includes("claude.ai")) return siteConfigs["claude.ai"];
  return null;
}

function findInputElement(config) {
  if (!config || !config.selector) return null;
  return document.querySelector(config.selector);
}

function createOptimizeButton(inputElement, config) {
  if (!inputElement || document.getElementById("prompt-slim-optimize-btn")) {
    return; // Don't add if already exists or input not found
  }

  const button = document.createElement("button");
  button.id = "prompt-slim-optimize-btn";
  button.textContent = "✨ Optimize"; // Or use an icon
  button.classList.add("prompt-slim-button"); // Add class for styling
  button.style.display = "none"; // Initially hidden

  button.onclick = async (e) => {
    e.stopPropagation(); // Prevent potential form submission
    const originalText = config.getText(inputElement);
    if (!originalText || originalText.trim().length === 0) {
      console.log("Prompt Slim: No text to optimize.");
      return;
    }

    button.textContent = "Optimizing...";
    button.disabled = true;

    try {
      console.log("Prompt Slim: Sending text to background:", originalText);
      const response = await chrome.runtime.sendMessage({
        action: "optimizeText",
        text: originalText,
      });
      console.log("Prompt Slim: Received response from background:", response);

      if (response && response.success) {
        config.setText(inputElement, response.optimizedText);
        // Optional: Show token saved message
        displayTokenSavedMessage(
          inputElement,
          originalText,
          response.optimizedText
        );
        // Keep button visible briefly after success?
        setTimeout(() => {
          button.textContent = "✨ Optimize";
          button.disabled = false;
          // Re-evaluate if button should be visible based on new text
          updateButtonVisibility(inputElement, config);
        }, 1500); // Reset after 1.5 seconds
      } else {
        throw new Error(
          response?.error || "Optimization failed. Check background logs."
        );
      }
    } catch (error) {
      console.error("Prompt Slim Error:", error);
      button.textContent = "Error!";
      // Optionally show error to user more prominently
      displayErrorNearInput(inputElement, `Error: ${error.message}`);
      setTimeout(() => {
        button.textContent = "✨ Optimize";
        button.disabled = false;
        // Re-evaluate visibility
        updateButtonVisibility(inputElement, config);
      }, 3000); // Show error for 3 seconds
    }
  };

  // Append button strategically
  const parent = config.getParentForButton(inputElement);
  if (parent) {
    parent.style.position = "relative"; // Ensure parent can contain positioned button
    parent.appendChild(button);
    optimizeButton = button;
    console.log("Prompt Slim: Optimize button added.");
  } else {
    console.error(
      "Prompt Slim: Could not find suitable parent for the optimize button."
    );
  }

  // Add input listener to show/hide button
  inputElement.addEventListener("input", () =>
    updateButtonVisibility(inputElement, config)
  );
  // Initial check
  updateButtonVisibility(inputElement, config);
}

function updateButtonVisibility(inputElement, config) {
  if (!optimizeButton) return;
  const text = config.getText(inputElement);
  if (text && text.trim().length > 0) {
    optimizeButton.style.display = "inline-block";
  } else {
    optimizeButton.style.display = "none";
  }
}

function displayTokenSavedMessage(inputElement, originalText, optimizedText) {
  // Very basic token estimation (word count)
  const originalTokens = originalText.split(/\s+/).filter(Boolean).length;
  const optimizedTokens = optimizedText.split(/\s+/).filter(Boolean).length;
  const saved = originalTokens - optimizedTokens;

  if (saved > 0) {
    const messageDiv = document.createElement("div");
    messageDiv.textContent = `~${saved} tokens saved!`;
    messageDiv.classList.add("prompt-slim-feedback", "success");
    insertFeedbackMessage(inputElement, messageDiv);
  } else if (saved < 0) {
    const messageDiv = document.createElement("div");
    messageDiv.textContent = `Prompt longer (~${Math.abs(saved)} tokens).`;
    messageDiv.classList.add("prompt-slim-feedback", "warning");
    insertFeedbackMessage(inputElement, messageDiv);
  }
}

function displayErrorNearInput(inputElement, errorMessage) {
  const messageDiv = document.createElement("div");
  messageDiv.textContent = errorMessage;
  messageDiv.classList.add("prompt-slim-feedback", "error");
  insertFeedbackMessage(inputElement, messageDiv);
}

function insertFeedbackMessage(inputElement, messageDiv) {
  // Remove any existing feedback message
  const existingFeedback = document.querySelector(".prompt-slim-feedback");
  if (existingFeedback) {
    existingFeedback.remove();
  }

  // Insert the new message (e.g., above the input)
  inputElement.parentElement?.insertBefore(messageDiv, inputElement);

  // Auto-remove after a few seconds
  setTimeout(() => {
    messageDiv.remove();
  }, 4000); // Remove after 4 seconds
}

// --- Initialization ---

// Use MutationObserver to handle dynamically loaded elements (common in SPAs)
const observer = new MutationObserver((mutationsList, observer) => {
  const config = getCurrentSiteConfig();
  if (!config) return; // Not on a target site

  if (!targetInput || !document.contains(targetInput)) {
    // Try to find the input element if we haven't found it yet or it disappeared
    targetInput = findInputElement(config);
    if (targetInput && !optimizeButton) {
      console.log("Prompt Slim: Target input found:", targetInput);
      createOptimizeButton(targetInput, config);
    }
  }

  // Optional: If the button exists but the input was replaced, re-attach listeners/re-create
  if (targetInput && optimizeButton && !targetInput.contains(optimizeButton)) {
    console.log(
      "Prompt Slim: Re-attaching button due to potential DOM change."
    );
    optimizeButton.remove();
    optimizeButton = null; // Force recreation
    createOptimizeButton(targetInput, config);
  }
});

// Start observing the document body for changes
observer.observe(document.body, { childList: true, subtree: true });

// Initial attempt to find the element on load (might work for simpler pages)
window.addEventListener("load", () => {
  const config = getCurrentSiteConfig();
  if (config && !targetInput) {
    targetInput = findInputElement(config);
    if (targetInput && !optimizeButton) {
      console.log("Prompt Slim: Target input found on load:", targetInput);
      createOptimizeButton(targetInput, config);
    }
  }
});

// Fallback interval check in case MutationObserver misses something (use sparingly)
// const initialCheckInterval = setInterval(() => {
//     const config = getCurrentSiteConfig();
//     if (!config || targetInput) {
//         // clearInterval(initialCheckInterval); // Stop checking once found or if not on target site
//         return;
//     }
//     targetInput = findInputElement(config);
//     if (targetInput && !optimizeButton) {
//         console.log("Prompt Slim: Target input found via interval:", targetInput);
//         createOptimizeButton(targetInput, config);
//         // clearInterval(initialCheckInterval); // Stop checking once found
//     }
// }, 1000); // Check every second initially
// setTimeout(() => clearInterval(initialCheckInterval), 10000); // Stop after 10 seconds regardless
