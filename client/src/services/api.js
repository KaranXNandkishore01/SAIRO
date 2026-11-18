const API_BASE = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '');

async function request(path, options = {}, retries = 1) {
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
      await new Promise((r) => setTimeout(r, 1500));
      return request(path, options, retries - 1);
    }
    throw new Error(
      'Unable to connect to the server. Please check that the backend is online and CORS allows this site.'
    );
  }

  // Retry once automatically on cold-start 502/503/504 responses
  if (retries > 0 && [502, 503, 504].includes(res.status)) {
    await new Promise((r) => setTimeout(r, 2000));
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
