const API_BASE = import.meta.env.VITE_RISKLENS_API_BASE || '';

function apiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `RiskLens API request failed with ${response.status}`);
  }
  return payload;
}

export async function fetchPaperLeaderboards() {
  return apiRequest('/api/paper-leaderboards');
}

export async function submitPaperLeaderboardEntry({ board, entry, userPointer }) {
  return apiRequest('/api/paper-leaderboards', {
    method: 'POST',
    body: JSON.stringify({
      board,
      entry,
      userPointer
    })
  });
}

export async function calculateTutorialRoute(payload) {
  return apiRequest('/api/tutorial-routes', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function calculateWealthScenario(payload) {
  return apiRequest('/api/wealth-calculations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function storeProfilePointer(pointer) {
  return apiRequest('/api/profile-pointer', {
    method: 'POST',
    body: JSON.stringify(pointer)
  });
}

export function emptyPaperBackendLeaderboards() {
  return {
    replay: { entries: [] },
    strategy: { entries: [] },
    storage: {
      mode: 'local-preview',
      persisted: false,
      userDataPolicy: 'Local-only until the RiskLens API responds.'
    },
    updatedAt: ''
  };
}
