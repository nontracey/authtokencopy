const authStorage = new Map();

function updateCaptureList() {
  const entries = Array.from(authStorage.entries());
  const recentEntries = entries
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, 100);
  
  chrome.storage.local.set({ 
    '_captureList': recentEntries
  });
  
  return recentEntries;
}

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
      
      updateCaptureList();
      
      console.log('[AuthHelper] Captured auth for:', host, 'Total:', authStorage.size);
      
    } catch (error) {
      console.error('[AuthHelper] Error processing request:', error);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAuthList') {
    updateCaptureList();
    chrome.storage.local.get(['_captureList'], (result) => {
      const list = result._captureList || [];
      console.log('[AuthHelper] Returning auth list, count:', list.length);
      sendResponse({ list: list });
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
    console.log('[AuthHelper] Cleared all auth data');
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'ping') {
    sendResponse({ status: 'ok', count: authStorage.size });
    return true;
  }
  
  return false;
});

chrome.storage.local.get(null, (result) => {
  if (result._captureList) {
    result._captureList.forEach(([key, value]) => {
      authStorage.set(key, value);
    });
    console.log('[AuthHelper] Restored', authStorage.size, 'auth entries from storage');
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AuthHelper] Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[AuthHelper] Browser started, monitoring requests...');
});
