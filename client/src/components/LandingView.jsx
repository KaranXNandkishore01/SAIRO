import { useState } from 'react';
import {
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  deriveRoomEncryption,
  deriveRoomIdentity,
  evaluatePasscodeStrength,
  generateSaltHex,
  generateSecretPasscode,
  normalizePasscode,
} from '../crypto/e2ee';
import { generateEphemeralAlias, saveEphemeralAlias } from '../utils/alias';
import { api } from '../services/api';

const TTL_OPTIONS = [
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 1440 },
  { label: '7 days', minutes: 10080 },
];

const CAPACITY_OPTIONS = [
  { label: '1-on-1 (2)', value: 2 },
  { label: 'Small (5)', value: 5 },
  { label: 'Group (10)', value: 10 },
];

export default function LandingView({ initialAlias, onRoomReady }) {
  const [mode, setMode] = useState('create');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [alias, setAlias] = useState(initialAlias);
  const [ttlMinutes, setTtlMinutes] = useState(1440);
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [burnWhenEmpty, setBurnWhenEmpty] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = evaluatePasscodeStrength(passcode);

  const handleGeneratePasscode = () => {
    setPasscode(generateSecretPasscode());
    setShowPasscode(true);
    setError('');
  };

  const handleRefreshAlias = () => {
    setAlias(generateEphemeralAlias());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanCode = normalizePasscode(passcode);
    if (cleanCode.length < 4) {
      setError('Please enter a secret passcode of at least 4 characters.');
      return;
    }

    const cleanAlias = saveEphemeralAlias(alias);
    setAlias(cleanAlias);
    setLoading(true);

    try {
      setStatusText('Securing passcode...');
      const { roomHash, authVerifier } = await deriveRoomIdentity(cleanCode);

      if (mode === 'create') {
        const salt = generateSaltHex();
        setStatusText('Creating private chat...');
        const room = await api.createRoom({
          roomHash,
          authVerifier,
          salt,
          ttlMinutes,
          maxParticipants,
          burnWhenEmpty,
        });

        const { aesKey, fingerprint } = await deriveRoomEncryption(cleanCode, room.salt);

        onRoomReady({
          room,
          passcode: cleanCode,
          authVerifier,
          aesKey,
          fingerprint,
          alias: cleanAlias,
          isCreator: true,
        });
      } else {
        setStatusText('Connecting to chat...');
        const room = await api.joinByPasscode({ roomHash, authVerifier });

        const { aesKey, fingerprint } = await deriveRoomEncryption(cleanCode, room.salt);

        onRoomReady({
          room,
          passcode: cleanCode,
          authVerifier,
          aesKey,
          fingerprint,
          alias: cleanAlias,
          isCreator: false,
        });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const strengthBarWidth = `${Math.min(strength.score, 4) * 25}%`;
  const strengthBarColor =
    strength.tone === 'strong'
      ? 'bg-sage-400'
      : strength.tone === 'good'
        ? 'bg-teal-400/80'
        : strength.tone === 'fair'
          ? 'bg-amber-400/80'
          : 'bg-rose-400/75';

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="mb-7 max-w-lg text-center animate-fade-up">
        <div className="mx-auto mb-4 flex flex-col items-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-3xl bg-black shadow-2xl shadow-cyan-950/40 ring-1 ring-cyan-400/30 sm:h-28 sm:w-28">
            <img
              src="/sairo-logo.jpg"
              alt="SAIRO Logo"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
          Private chat with just a{' '}
          <span className="bg-gradient-to-r from-sage-500 to-teal-400 bg-clip-text text-transparent dark:from-sage-300 dark:to-teal-200">
            secret passcode
          </span>
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          No sign-up and no personal details needed. Create a secret passcode, share it
          with someone you trust, and start chatting privately.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl shadow-slate-950/10 glass-panel sm:p-7 animate-fade-up">
        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-900/5 p-1 dark:bg-white/5">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
              mode === 'create'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-dusk-800 dark:text-sage-200'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Create Chat
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('join');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
              mode === 'join'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-dusk-800 dark:text-sage-200'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Join Chat
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="secret-passcode"
                className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Secret Passcode
              </label>
              {mode === 'create' && (
                <button
                  type="button"
                  onClick={handleGeneratePasscode}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sage-600 transition-colors hover:text-sage-500 dark:text-sage-300 dark:hover:text-sage-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate code
                </button>
              )}
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="secret-passcode"
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError('');
                }}
                placeholder={
                  mode === 'create'
                    ? 'Enter any secret passcode'
                    : 'Enter the shared secret passcode'
                }
                autoComplete="off"
                spellCheck="false"
                className="w-full rounded-2xl border border-slate-900/10 bg-white/70 py-3 pl-10 pr-11 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/25 dark:border-white/10 dark:bg-dusk-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((v) => !v)}
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {mode === 'create' && passcode && (
              <div className="mt-2 space-y-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strengthBarColor}`}
                    style={{ width: strengthBarWidth }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="ephemeral-alias"
                className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Display Name <span className="normal-case opacity-75">(optional)</span>
              </label>
              <button
                type="button"
                onClick={handleRefreshAlias}
                className="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-sage-500 dark:text-slate-400 dark:hover:text-sage-300"
              >
                <RefreshCw className="h-3 w-3" />
                Change
              </button>
            </div>
            <input
              id="ephemeral-alias"
              type="text"
              maxLength={28}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Quiet Owl"
              className="w-full rounded-2xl border border-slate-900/10 bg-white/70 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/25 dark:border-white/10 dark:bg-dusk-900/70 dark:text-slate-100"
            />
          </div>

          {mode === 'create' && (
            <div className="rounded-2xl border border-slate-900/5 bg-slate-900/[0.03] dark:border-white/5 dark:bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-sage-500 dark:text-sage-400" />
                  Chat settings
                </span>
                <span className="text-[11px] text-slate-400">
                  {TTL_OPTIONS.find((t) => t.minutes === ttlMinutes)?.label} • Max {maxParticipants}
                </span>
              </button>

              {showOptions && (
                <div className="space-y-4 border-t border-slate-900/5 px-4 py-3.5 dark:border-white/5">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      Auto-delete after
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TTL_OPTIONS.map((opt) => (
                        <button
                          key={opt.minutes}
                          type="button"
                          onClick={() => setTtlMinutes(opt.minutes)}
                          className={`rounded-xl py-1.5 text-xs font-medium transition-colors ${
                            ttlMinutes === opt.minutes
                              ? 'bg-sage-500/20 text-sage-700 ring-1 ring-sage-500/40 dark:text-sage-200'
                              : 'bg-white/50 text-slate-600 hover:bg-white dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <Users className="h-3.5 w-3.5" />
                      People limit
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CAPACITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setMaxParticipants(opt.value)}
                          className={`rounded-xl py-1.5 text-xs font-medium transition-colors ${
                            maxParticipants === opt.value
                              ? 'bg-sage-500/20 text-sage-700 ring-1 ring-sage-500/40 dark:text-sage-200'
                              : 'bg-white/50 text-slate-600 hover:bg-white dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-3 pt-1">
                    <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Flame className="h-3.5 w-3.5 text-amber-500/80" />
                      Delete chat when everyone leaves
                    </span>
                    <input
                      type="checkbox"
                      checked={burnWhenEmpty}
                      onChange={(e) => setBurnWhenEmpty(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-sage-500"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sage-500 to-teal-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sage-900/20 transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-sage-400/50 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>{statusText || 'Connecting...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'create' ? 'Start Private Chat' : 'Join Chat'}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
