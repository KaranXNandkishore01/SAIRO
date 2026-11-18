const ADJECTIVES = [
  'Quiet', 'Misty', 'Calm', 'Still', 'Gentle', 'Soft',
  'Serene', 'Lunar', 'Velvet', 'Hushed', 'Drifting', 'Silver',
];

const CREATURES = [
  'Owl', 'Heron', 'Fox', 'Cedar', 'Willow', 'River',
  'Finch', 'Moth', 'Crane', 'Lark', 'Pine', 'Harbor',
];

const AVATAR_ACCENTS = [
  'from-sage-400/80 to-teal-500/70',
  'from-indigo-400/75 to-slate-500/70',
  'from-emerald-400/75 to-sage-500/70',
  'from-sky-400/75 to-cyan-500/70',
  'from-violet-400/70 to-indigo-400/70',
  'from-amber-300/75 to-orange-400/65',
];

const SESSION_KEY = 'sairo_ephemeral_session_id';
const ALIAS_KEY = 'sairo_ephemeral_alias';

export function generateEphemeralAlias() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = CREATURES[Math.floor(Math.random() * CREATURES.length)];
  return `${adj} ${noun}`;
}

export function getOrCreateSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getOrCreateAlias() {
  let alias = sessionStorage.getItem(ALIAS_KEY);
  if (!alias) {
    alias = generateEphemeralAlias();
    sessionStorage.setItem(ALIAS_KEY, alias);
  }
  return alias;
}

export function saveEphemeralAlias(alias) {
  const clean = String(alias || '').trim().slice(0, 28) || generateEphemeralAlias();
  sessionStorage.setItem(ALIAS_KEY, clean);
  return clean;
}

export function getAvatarGradient(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_ACCENTS[hash % AVATAR_ACCENTS.length];
}

export function getInitials(alias = 'Anonymous') {
  const parts = alias.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
