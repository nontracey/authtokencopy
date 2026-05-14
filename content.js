function isSwaggerPage() {
  const indicators = [
    '.swagger-ui',
    '#swagger-ui',
    '[data-swagger-ui]',
    '.api-explorer',
    '.redoc-wrap',
    'script[src*="swagger"]',
    'script[src*="redoc"]'
  ];
  
  return indicators.some(selector => document.querySelector(selector));
}

function injectAuthButton() {
  if (!isSwaggerPage()) {
    return;
  }
  
  if (document.querySelector('#swagger-auth-helper-btn')) {
    return;
  }
  
  const btn = document.createElement('button');
  btn.id = 'swagger-auth-helper-btn';
  btn.className = 'swagger-auth-btn';
  btn.title = '从已捕获的请求中注入 Authorization';
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span>注入 Auth</span>
  `;
  
  btn.addEventListener('click', showAuthModal);
  document.body.appendChild(btn);
}

function extractBearerToken(authValue) {
  if (!authValue) return authValue;
  
  const bearerRegex = /^bearer\s+/i;
  return authValue.replace(bearerRegex, '');
}

function showAuthModal() {
  if (document.querySelector('#swagger-auth-modal')) {
    document.querySelector('#swagger-auth-modal').remove();
  }
  
  chrome.runtime.sendMessage({ action: 'getAuthList' }, (response) => {
    const authList = response.list || [];
    
    const modal = document.createElement('div');
    modal.id = 'swagger-auth-modal';
    modal.className = 'swagger-auth-modal';
    
    const currentHost = window.location.host;
    
    const matchedAuth = authList.filter(([key, data]) => {
      return data.host === currentHost || data.origin === window.location.origin;
    });
    
    const otherAuth = authList.filter(([key, data]) => {
      return data.host !== currentHost && data.origin !== window.location.origin;
    });
    
    let listHTML = '';
    
    if (matchedAuth.length > 0) {
      listHTML += '<div class="auth-section"><h4>当前站点</h4>';
      matchedAuth.slice(-10).reverse().forEach(([key, data]) => {
        listHTML += `
          <div class="auth-item current-site" data-key="${key}">
            <div class="auth-host">${data.host}</div>
            <div class="auth-token">${data.token.substring(0, 30)}...</div>
            <div class="auth-time">${new Date(data.timestamp).toLocaleString()}</div>
          </div>
        `;
      });
      listHTML += '</div>';
    }
    
    if (otherAuth.length > 0) {
      listHTML += '<div class="auth-section"><h4>其他站点</h4>';
      otherAuth.slice(-10).reverse().forEach(([key, data]) => {
        listHTML += `
          <div class="auth-item" data-key="${key}">
            <div class="auth-host">${data.host}</div>
            <div class="auth-token">${data.token.substring(0, 30)}...</div>
            <div class="auth-time">${new Date(data.timestamp).toLocaleString()}</div>
          </div>
        `;
      });
      listHTML += '</div>';
    }
    
    if (authList.length === 0) {
      listHTML = '<div class="no-auth">暂无捕获的 Authorization<br>请先登录目标网站</div>';
    }
    
    modal.innerHTML = `
      <div class="swagger-auth-modal-content">
        <div class="swagger-auth-modal-header">
          <h3>选择 Authorization</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="swagger-auth-modal-body">
          ${listHTML}
        </div>
        <div class="swagger-auth-modal-footer">
          <button class="refresh-btn">刷新列表</button>
          <button class="clear-btn">清空所有</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.close-btn').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    modal.querySelectorAll('.auth-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.dataset.key;
        chrome.runtime.sendMessage({ action: 'getAuthByKey', key }, (response) => {
          if (response.data) {
            const token = extractBearerToken(response.data.token);
            fillSwaggerAuth(token);
            modal.remove();
          }
        });
      });
    });
    
    modal.querySelector('.refresh-btn').addEventListener('click', () => {
      modal.remove();
      showAuthModal();
    });
    
    modal.querySelector('.clear-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'clearAuth' }, () => {
        modal.remove();
      });
    });
  });
}

function fillSwaggerAuth(token) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  
  function setReactInputValue(input, value) {
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  function findAuthDialogInput() {
    const selectors = [
      '.modal-ux-content input[type="text"]',
      '.modal-ux input[type="text"]',
      '.dialog-ux-content input[type="text"]',
      '.dialog-ux input[type="text"]',
      '.auth-container input[type="text"]',
      '.modal input[type="text"]',
      '.modal-dialog input[type="text"]',
      'section.auth input[type="text"]',
      '.auth-btn-wrapper input[type="text"]',
      '.auth-section input[type="text"]',
      'input[placeholder*="Bearer"]',
      'input[placeholder*="bearer"]',
      'input[placeholder*="Token"]',
      'input[placeholder*="token"]',
      'input[placeholder*="api_key"]',
      'input[placeholder*="API key"]',
      'input[name="authorization"]',
      'input[name="token"]',
      '.swagger-ui input[type="text"]'
    ];
    
    for (const selector of selectors) {
      try {
        const inputs = document.querySelectorAll(selector);
        for (const input of inputs) {
          if (input && input.offsetParent !== null && input.type === 'text') {
            return input;
          }
        }
      } catch (e) {}
    }
    
    const modals = document.querySelectorAll('.modal-ux, .dialog-ux, .modal, [role="dialog"]');
    for (const modal of modals) {
      if (modal.offsetParent !== null) {
        const inputs = modal.querySelectorAll('input[type="text"]');
        if (inputs.length > 0) {
          return inputs[0];
        }
      }
    }
    
    return null;
  }
  
  function clickLogoutInDialog() {
    const selectors = [
      '.modal-ux-content button',
      '.modal-ux button',
      '.dialog-ux button',
      '.auth-container button',
      'section.auth button',
      '.modal button',
      'button'
    ];
    
    for (const selector of selectors) {
      const btns = document.querySelectorAll(selector);
      for (const btn of btns) {
        if (btn && btn.offsetParent !== null) {
          const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
          if (text === 'logout' || text === 'sign out' || text.includes('logout')) {
            btn.click();
            return true;
          }
        }
      }
    }
    return false;
  }
  
  function clickAuthorizeInDialog() {
    const selectors = [
      '.modal-ux-content button',
      '.modal-ux button',
      '.dialog-ux button',
      '.auth-container button',
      'section.auth button',
      '.modal button',
      'button'
    ];
    
    for (const selector of selectors) {
      const btns = document.querySelectorAll(selector);
      for (const btn of btns) {
        if (btn && btn.offsetParent !== null) {
          const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
          if ((text === 'authorize' && !text.includes('logout')) || text === 'sign in') {
            btn.click();
            return true;
          }
        }
      }
    }
    return false;
  }
  
  function closeAuthDialog() {
    const closeSelectors = [
      '.modal-ux .close-modal',
      '.dialog-ux .close-modal',
      '.modal .close',
      '.modal-ux-header button',
      'button.close-modal',
      'button.close'
    ];
    
    for (const selector of closeSelectors) {
      const btns = document.querySelectorAll(selector);
      for (const btn of btns) {
        if (btn && btn.offsetParent !== null) {
          const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
          if (text === 'close' || text === '×' || btn.classList.contains('close')) {
            btn.click();
            return true;
          }
        }
      }
    }
    return false;
  }
  
  function openAuthDialog() {
    const authorizeBtnSelectors = [
      '.swagger-ui .auth-wrapper .authorize',
      '.auth-wrapper button.authorize',
      'button.authorize',
      '.auth-btn-wrapper button'
    ];
    
    for (const selector of authorizeBtnSelectors) {
      const btn = document.querySelector(selector);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        return true;
      }
    }
    return false;
  }
  
  function fillAndAuthorize(token, callback) {
    setTimeout(() => {
      const input = findAuthDialogInput();
      if (input) {
        setReactInputValue(input, token);
        
        setTimeout(() => {
          if (clickAuthorizeInDialog()) {
            setTimeout(() => {
              closeAuthDialog();
              if (callback) callback(true);
            }, 200);
          } else {
            if (callback) callback(false);
          }
        }, 100);
      } else {
        if (callback) callback(false);
      }
    }, 150);
  }
  
  function handleLogoutAndFill(token) {
    if (clickLogoutInDialog()) {
      let attempts = 0;
      const maxAttempts = 20;
      
      const checkForInput = setInterval(() => {
        attempts++;
        const input = findAuthDialogInput();
        
        if (input) {
          clearInterval(checkForInput);
          setReactInputValue(input, token);
          
          setTimeout(() => {
            if (clickAuthorizeInDialog()) {
              setTimeout(() => {
                closeAuthDialog();
                showNotification('✓ 已退出旧认证，新 Token 已注入', 'success');
              }, 200);
            } else {
              showNotification('✓ Token 已填入，请手动点击 Authorize', 'info');
            }
          }, 100);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkForInput);
          closeAuthDialog();
          setTimeout(() => {
            openAuthDialog();
            setTimeout(() => {
              const retryInput = findAuthDialogInput();
              if (retryInput) {
                setReactInputValue(retryInput, token);
                setTimeout(() => {
                  if (clickAuthorizeInDialog()) {
                    setTimeout(() => {
                      closeAuthDialog();
                      showNotification('✓ 已退出旧认证，新 Token 已注入', 'success');
                    }, 200);
                  } else {
                    showNotification('✓ Token 已填入，请手动点击 Authorize', 'info');
                  }
                }, 100);
              } else {
                copyToClipboard(token);
                showNotification('⚠ 未找到输入框，Token 已复制到剪贴板', 'info');
              }
            }, 300);
          }, 200);
        }
      }, 100);
      return true;
    }
    return false;
  }
  
  let input = findAuthDialogInput();
  
  if (input) {
    setReactInputValue(input, token);
    setTimeout(() => {
      if (clickAuthorizeInDialog()) {
        setTimeout(() => {
          closeAuthDialog();
          showNotification('✓ Authorization 已注入并确认', 'success');
        }, 200);
      } else {
        showNotification('✓ Token 已填入，请手动点击 Authorize', 'info');
      }
    }, 100);
    return;
  }
  
  if (openAuthDialog()) {
    setTimeout(() => {
      input = findAuthDialogInput();
      
      if (input) {
        setReactInputValue(input, token);
        setTimeout(() => {
          if (clickAuthorizeInDialog()) {
            setTimeout(() => {
              closeAuthDialog();
              showNotification('✓ Authorization 已注入并确认', 'success');
            }, 200);
          } else {
            showNotification('✓ Token 已填入，请手动点击 Authorize', 'info');
          }
        }, 100);
      } else {
        if (!handleLogoutAndFill(token)) {
          copyToClipboard(token);
          showNotification('⚠ 未找到输入框，Token 已复制到剪贴板', 'info');
        }
      }
    }, 300);
  } else {
    copyToClipboard(token);
    showNotification('⚠ 未找到 Authorize 按钮，Token 已复制到剪贴板', 'info');
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `swagger-auth-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectAuthButton);
} else {
  injectAuthButton();
}

const observer = new MutationObserver(() => {
  injectAuthButton();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showAuthModal') {
    showAuthModal();
    sendResponse({ success: true });
  }
  
  if (request.action === 'fillAuth') {
    fillSwaggerAuth(request.token);
    sendResponse({ success: true });
  }
  
  return true;
});
