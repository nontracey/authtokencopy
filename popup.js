let authList = [];

document.addEventListener('DOMContentLoaded', () => {
  loadAuthList();
  
  document.getElementById('refreshBtn').addEventListener('click', loadAuthList);
  document.getElementById('clearBtn').addEventListener('click', clearAuth);
  document.getElementById('injectBtn').addEventListener('click', injectAuth);
});

function loadAuthList() {
  chrome.runtime.sendMessage({ action: 'getAuthList' }, (response) => {
    authList = response.list || [];
    renderAuthList();
    updateStatus();
  });
}

function renderAuthList() {
  const listContainer = document.getElementById('authList');
  
  if (authList.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        <p>暂无捕获的 Authorization</p>
        <p class="hint">请先在目标网站登录</p>
      </div>
    `;
    return;
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentUrl = currentTab?.url || '';
    let currentHost = '';
    
    try {
      currentHost = new URL(currentUrl).host;
    } catch (e) {
      currentHost = '';
    }
    
    const matchedAuth = authList.filter(([key, data]) => {
      return data.host === currentHost;
    });
    
    const otherAuth = authList.filter(([key, data]) => {
      return data.host !== currentHost;
    });
    
    let html = '';
    
    if (matchedAuth.length > 0) {
      html += '<div class="auth-section"><div class="section-title">当前站点</div>';
      matchedAuth.slice(-5).reverse().forEach(([key, data]) => {
        html += renderAuthItem(key, data, true);
      });
      html += '</div>';
    }
    
    if (otherAuth.length > 0) {
      html += '<div class="auth-section"><div class="section-title">其他站点</div>';
      otherAuth.slice(-5).reverse().forEach(([key, data]) => {
        html += renderAuthItem(key, data, false);
      });
      html += '</div>';
    }
    
    listContainer.innerHTML = html;
    
    listContainer.querySelectorAll('.auth-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.dataset.key;
        injectAuthByKey(key);
      });
    });
  });
}

function renderAuthItem(key, data, isCurrentSite) {
  const className = isCurrentSite ? 'auth-item current-site' : 'auth-item';
  const time = new Date(data.timestamp).toLocaleString();
  const tokenPreview = data.token.length > 40 
    ? data.token.substring(0, 40) + '...' 
    : data.token;
  
  return `
    <div class="${className}" data-key="${key}">
      <div class="auth-host">${data.host}</div>
      <div class="auth-token">${tokenPreview}</div>
      <div class="auth-time">${time}</div>
    </div>
  `;
}

function updateStatus() {
  document.getElementById('authCount').textContent = authList.length;
  
  const injectBtn = document.getElementById('injectBtn');
  injectBtn.disabled = authList.length === 0;
}

function clearAuth() {
  if (confirm('确定要清空所有捕获的 Authorization 吗？')) {
    chrome.runtime.sendMessage({ action: 'clearAuth' }, () => {
      authList = [];
      renderAuthList();
      updateStatus();
    });
  }
}

function injectAuth() {
  if (authList.length === 0) {
    return;
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    chrome.tabs.sendMessage(currentTab.id, { action: 'showAuthModal' }, (response) => {
      if (chrome.runtime.lastError) {
        alert('当前页面不支持注入，请确保在 Swagger 页面使用');
      }
    });
  });
}

function injectAuthByKey(key) {
  chrome.runtime.sendMessage({ action: 'getAuthByKey', key }, (response) => {
    if (response.data) {
      const token = extractBearerToken(response.data.token);
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        
        chrome.tabs.sendMessage(currentTab.id, { 
          action: 'fillAuth',
          token: token
        }, (response) => {
          if (chrome.runtime.lastError) {
            copyToClipboard(token);
            alert('Token 已复制到剪贴板');
          } else {
            window.close();
          }
        });
      });
    }
  });
}

function extractBearerToken(authValue) {
  if (!authValue) return authValue;
  
  const bearerRegex = /^bearer\s+/i;
  return authValue.replace(bearerRegex, '');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    console.error('Failed to copy to clipboard');
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showAuthModal') {
    sendResponse({ success: true });
  }
  
  if (request.action === 'fillAuth') {
    sendResponse({ success: true });
  }
});
