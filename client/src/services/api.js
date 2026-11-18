const API_BASE = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '');

async function request(path, options = {}) {
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
    throw new Error(
      'Unable to connect to the server right now. Please check your internet or try again in a few seconds.'
    );
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
