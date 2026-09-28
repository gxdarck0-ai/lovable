// Chrome Extension API Polyfill for web preview environment
(function () {
  if (typeof window === "undefined") return;

  const storageSubscribers = [];
  const messageSubscribers = [];
  const STORAGE_PREFIX = "lovable_ext_";

  function getLocalItem(key) {
    try {
      const val = localStorage.getItem(STORAGE_PREFIX + key);
      return val !== null && val !== undefined ? JSON.parse(val) : undefined;
    } catch {
      return undefined;
    }
  }

  function setLocalItem(key, val) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
    } catch (e) {
      console.warn("[Polyfill] LocalStorage set error:", e);
    }
  }

  function removeLocalItem(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {}
  }

  // Pre-seed dark mode default if not set
  if (getLocalItem("ql_dark_mode") === undefined) {
    setLocalItem("ql_dark_mode", true);
  }

  const mockStorage = {
    get: function (keys, callback) {
      const result = {};
      if (!keys) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) {
            const rawKey = k.slice(STORAGE_PREFIX.length);
            result[rawKey] = getLocalItem(rawKey);
          }
        }
      } else if (typeof keys === "string") {
        result[keys] = getLocalItem(keys);
      } else if (Array.isArray(keys)) {
        for (const k of keys) {
          result[k] = getLocalItem(k);
        }
      } else if (typeof keys === "object") {
        for (const [k, defaultVal] of Object.entries(keys)) {
          const val = getLocalItem(k);
          result[k] = val !== undefined ? val : defaultVal;
        }
      }

      if (typeof callback === "function") {
        setTimeout(() => callback(result), 0);
      }
      return Promise.resolve(result);
    },

    set: function (items, callback) {
      const changes = {};
      if (items && typeof items === "object") {
        for (const [key, value] of Object.entries(items)) {
          const oldValue = getLocalItem(key);
          setLocalItem(key, value);
          changes[key] = { oldValue, newValue: value };
        }
      }

      for (const listener of storageSubscribers) {
        try {
          listener(changes, "local");
        } catch (e) {
          console.error("[Polyfill] storage.onChanged error:", e);
        }
      }

      if (typeof callback === "function") {
        setTimeout(callback, 0);
      }
      return Promise.resolve();
    },

    remove: function (keys, callback) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      for (const k of keyList) {
        const oldValue = getLocalItem(k);
        removeLocalItem(k);
        changes[k] = { oldValue, newValue: undefined };
      }

      for (const listener of storageSubscribers) {
        try {
          listener(changes, "local");
        } catch (e) {
          console.error("[Polyfill] storage.onChanged error:", e);
        }
      }

      if (typeof callback === "function") {
        setTimeout(callback, 0);
      }
      return Promise.resolve();
    },

    clear: function (callback) {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      if (typeof callback === "function") {
        setTimeout(callback, 0);
      }
      return Promise.resolve();
    },
  };

  const mockChrome = {
    runtime: {
      id: "lovable-extension-id",
      lastError: null,
      getURL: function (path) {
        return path || "";
      },
      sendMessage: function (message, callback) {
        let responded = false;
        const sendResponse = (res) => {
          if (!responded && typeof callback === "function") {
            responded = true;
            callback(res);
          }
        };

        for (const listener of messageSubscribers) {
          try {
            const ret = listener(message, { id: "lovable-extension-id" }, sendResponse);
            if (ret === true) return;
          } catch (e) {
            console.warn("[Polyfill] onMessage listener error:", e);
          }
        }

        setTimeout(() => {
          if (!responded && typeof callback === "function") {
            if (message && message.action === "getLovableCookies") {
              callback({ cookie: "" });
            } else if (message && message.action === "checkLovableStatus") {
              callback({ connected: true, active: true });
            } else {
              callback({ ok: true, success: true });
            }
          }
        }, 10);
      },
      onMessage: {
        addListener: function (fn) {
          if (typeof fn === "function" && !messageSubscribers.includes(fn)) {
            messageSubscribers.push(fn);
          }
        },
        removeListener: function (fn) {
          const idx = messageSubscribers.indexOf(fn);
          if (idx !== -1) messageSubscribers.splice(idx, 1);
        },
      },
    },

    storage: {
      local: mockStorage,
      sync: mockStorage,
      onChanged: {
        addListener: function (fn) {
          if (typeof fn === "function" && !storageSubscribers.includes(fn)) {
            storageSubscribers.push(fn);
          }
        },
        removeListener: function (fn) {
          const idx = storageSubscribers.indexOf(fn);
          if (idx !== -1) storageSubscribers.splice(idx, 1);
        },
      },
    },

    tabs: {
      query: function (queryInfo, callback) {
        const dummyTabs = [
          {
            id: 101,
            url: "https://lovable.dev/projects/demo",
            title: "Lovable Demo Project",
            active: true,
          },
        ];
        if (typeof callback === "function") {
          setTimeout(() => callback(dummyTabs), 0);
        }
        return Promise.resolve(dummyTabs);
      },
      sendMessage: function (tabId, message, callback) {
        if (typeof callback === "function") {
          setTimeout(() => callback({ success: true }), 0);
        }
        return Promise.resolve({ success: true });
      },
      create: function (props, callback) {
        if (props && props.url) {
          window.open(props.url, "_blank");
        }
        if (typeof callback === "function") {
          setTimeout(() => callback({ id: 102, url: props?.url }), 0);
        }
        return Promise.resolve({ id: 102, url: props?.url });
      },
    },

    cookies: {
      get: function (details, callback) {
        if (typeof callback === "function") {
          setTimeout(() => callback(null), 0);
        }
        return Promise.resolve(null);
      },
    },

    action: {
      onClicked: {
        addListener: function () {},
        removeListener: function () {},
      },
      setTitle: function () {},
      setIcon: function () {},
      setBadgeText: function () {},
      setBadgeBackgroundColor: function () {},
    },

    sidePanel: {
      setPanelBehavior: async function () {},
      open: async function () {},
    },

    commands: {
      onCommand: {
        addListener: function () {},
        removeListener: function () {},
      },
    },
  };

  if (typeof window.chrome === "undefined") {
    window.chrome = mockChrome;
  } else {
    for (const [key, value] of Object.entries(mockChrome)) {
      if (!window.chrome[key]) {
        try {
          window.chrome[key] = value;
        } catch {
          Object.defineProperty(window.chrome, key, {
            value,
            writable: true,
            configurable: true,
          });
        }
      }
    }
  }
})();
