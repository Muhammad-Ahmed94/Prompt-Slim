// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Prompt Optimizer extension installed');
});

// No need to activate the extension via popup since it will automatically
// run on the specified URLs via content scripts