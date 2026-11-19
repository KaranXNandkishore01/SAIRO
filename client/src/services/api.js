const API_BASE = (
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? 'https://sairo.onrender.com' : '')
).replace(/\/+$/, '');

async function request(path, options = {}, retries = 2) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    if (retries > 0) {
      // Free-tier cloud instances (Render) cold start takes ~30-50s and may reset connections while booting
      await new Promise((r) => setTimeout(r, 2000));
      return request(path, options, retries - 1);
    }
    throw new Error(
      'Unable to reach the server. The free-tier backend is likely waking up from sleep (takes ~45s). Please wait a moment and try again.'
    );
  }

  // Retry automatically on cold-start 502/503/504 responses
  if (retries > 0 && [502, 503, 504].includes(res.status)) {
    await new Promise((r) => setTimeout(r, 2500));
    return request(path, options, retries - 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Server error (${res.status}). Please try again.`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  getHealth() {
    return request('/api/health');
  },

  getUniquePasscode() {
    return request('/api/rooms/unique-passcode');
  },

  createRoom(payload) {
    return request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  joinByPasscode({ roomHash, authVerifier, sessionId }) {
    return request('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomHash, authVerifier, sessionId }),
    });
  },

  getRoomMeta(publicId) {
    return request(`/api/rooms/${encodeURIComponent(publicId)}/meta`);
  },

  verifyRoomPasscode(publicId, { roomHash, authVerifier, sessionId }) {
    return request(`/api/rooms/${encodeURIComponent(publicId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ roomHash, authVerifier, sessionId }),
    });
  },

  fetchMessages(roomHash, authVerifier) {
    return request(`/api/rooms/${encodeURIComponent(roomHash)}/messages`, {
      headers: {
        'x-auth-verifier': authVerifier,
      },
    });
  },

  burnRoom(roomHash, authVerifier) {
    return request(`/api/rooms/${encodeURIComponent(roomHash)}`, {
      method: 'DELETE',
      headers: {
        'x-auth-verifier': authVerifier,
      },
    });
  },
};
