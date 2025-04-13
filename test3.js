// Use require instead of import for CommonJS
const { GoogleGenAI } = require("@google/genai");

// Replace "my api key" with your actual key
// WARNING: Avoid hardcoding keys in production code. Use environment variables.
const apiKey = "AIzaSyBtiAebvNrd6Ry0cw17nlwJ81noLNfQ_1w"; // <<<--- PUT YOUR REAL API KEY HERE

const ai = new GoogleGenAI({
  apiKey: apiKey,
});

async function main() {
  try {
    // Make sure you are using a valid and available model name.
    // Check the Google AI documentation for the latest model names.
    // "gemini-pro" is often a good default for text generation.
    // "gemini-1.5-flash" is a newer, faster option if available to you.
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or "gemini-pro"

    const result = await model.generateContent("Explain how AI works");
    const response = await result.response; // Get the actual response object
    const text = response.text(); // Extract the text

    console.log(text);
  } catch (error) {
    console.error("Error generating content:", error);
  }
}

// Call main normally in CommonJS (top-level await is not standard)
main();
