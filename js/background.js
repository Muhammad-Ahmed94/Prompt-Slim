// WARNING: Storing API keys directly in extension code is a security risk.
// Anyone can unpack the extension and find the key.
// For production, use a secure backend proxy server.
// This implementation assumes the key is hardcoded here *during development*
// or injected via a build process (not shown here).
const GEMINI_API_KEY = "AIzaSyDSJoi0Dpo1fWRa14f9Ce7Qx28RBFVDM7w"; // Replace manually or via build
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "optimizeText") {
    console.log("Background script received text:", request.text);
    optimizeTextWithGemini(request.text)
      .then((optimizedText) => {
        console.log(
          "Background script sending back optimized text:",
          optimizedText
        );
        sendResponse({ success: true, optimizedText: optimizedText });
      })
      .catch((error) => {
        console.error("Error optimizing text:", error);
        sendResponse({ success: false, error: error.message });
      });
    // Return true to indicate you wish to send a response asynchronously
    return true;
  }
});

async function optimizeTextWithGemini(text) {
  // Basic prompt for optimization (can be refined)
  const prompt = `You are an AI assistant specializing in optimizing user prompts for Large Language Models. Your goal is to make the prompt clearer, more concise, and more effective while preserving the original user intent. Do not add explanations, just provide the optimized prompt.

  Original Prompt:
  "${text}"

  Optimized Prompt:`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Optional: Add safetySettings, generationConfig if needed
        // generationConfig: {
        //   temperature: 0.7,
        //   maxOutputTokens: 150,
        // }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error Response:", errorData);
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${
          errorData.error?.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();

    // Navigate the Gemini response structure (adjust if the API changes)
    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      let optimized = data.candidates[0].content.parts[0].text.trim();
      // Sometimes Gemini might add markdown backticks or "Optimized Prompt:" - try to clean it
      optimized = optimized.replace(/^optimized prompt:\s*/i, "").trim();
      optimized = optimized
        .replace(/^```[\w]*\n?/, "")
        .replace(/\n?```$/, "")
        .trim(); // Remove markdown code blocks
      return optimized;
    } else {
      console.error("Unexpected Gemini API response structure:", data);
      throw new Error("Could not extract optimized text from API response.");
    }
  } catch (error) {
    console.error("Fetch error calling Gemini API:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

console.log("Prompt Slim Background Service Worker Loaded.");
