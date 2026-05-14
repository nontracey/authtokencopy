const authStorage = new Map();

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers = details.requestHeaders || [];
    const authHeader = headers.find(h => h.name.toLowerCase() === 'authorization');
    
    if (!authHeader || !authHeader.value) {
      return;
    }
    
    try {
      const url = new URL(details.url);
      const host = url.host;
      const origin = url.origin;
      
      const refererHeader = headers.find(h => h.name.toLowerCase() === 'referer');
      const referer = refererHeader?.value || '';
      
      const key = `${host}|${referer || origin}`;
      
      const authData = {
        token: authHeader.value,
        host: host,
        origin: origin,
        referer: referer,
        url: details.url,
        timestamp: Date.now()
      };
      
      authStorage.set(key, authData);
      
      chrome.storage.local.set({ [key]: authData });
      
      chrome.storage.local.set({ 
        '_lastCapture': authData,
        '_captureList': Array.from(authStorage.entries()).slice(-50)
      });
      
    } catch (error) {
      console.error('Error processing request:', error);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAuthList') {
    chrome.storage.local.get(['_captureList'], (result) => {
      sendResponse({ list: result._captureList || [] });
    });
    return true;
  }
  
  if (request.action === 'getAuthByKey') {
    chrome.storage.local.get([request.key], (result) => {
      sendResponse({ data: result[request.key] });
    });
    return true;
  }
  
  if (request.action === 'clearAuth') {
    authStorage.clear();
    chrome.storage.local.clear();
    sendResponse({ success: true });
    return true;
  }
});

chrome.storage.local.get(['_captureList'], (result) => {
  if (result._captureList) {
    result._captureList.forEach(([key, value]) => {
      authStorage.set(key, value);
    });
  }
});
