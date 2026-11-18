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
import { generateEphemeralAlias, getOrCreateSessionId, saveEphemeralAlias } from '../utils/alias';
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
      const sessionId = getOrCreateSessionId();
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
          sessionId,
        });

        const { aesKey, fingerprint } = await deriveRoomEncryption(cleanCode, room.salt);

        onRoomReady({
          room,
          passcode: cleanCode,
          authVerifier,
          aesKey,
          fingerprint,
          alias: cleanAlias,
          isCreator: !room.reused,
        });
      } else {
        setStatusText('Connecting to chat...');
        const room = await api.joinByPasscode({ roomHash, authVerifier, sessionId });

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
      ? 'bg-teal-400'
      : strength.tone === 'good'
        ? 'bg-cyan-400/80'
        : strength.tone === 'fair'
          ? 'bg-amber-400/80'
          : 'bg-rose-400/75';

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-3 py-6 sm:px-6 sm:py-8 md:py-10">
      <div className="mb-6 max-w-lg text-center animate-fade-up sm:mb-7">
        <div className="mx-auto mb-3.5 flex flex-col items-center sm:mb-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-black shadow-2xl shadow-cyan-950/50 ring-1 ring-cyan-400/35 sm:h-24 sm:w-24 sm:rounded-3xl md:h-28 md:w-28">
            <img
              src="/sairo-logo.jpg"
              alt="SAIRO Logo"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-[#edf4f3] sm:text-2xl md:text-3xl">
          Private chat with just a{' '}
          <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent dark:from-teal-300 dark:to-cyan-300">
            secret passcode
          </span>
        </h1>
        <p className="mt-2 px-2 text-xs leading-relaxed text-slate-600 dark:text-[#9bb0b6] sm:mt-2.5 sm:text-sm">
          No sign-up and no personal details needed. Create a secret passcode, share it
          with someone you trust, and start chatting privately.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md rounded-2xl p-5 shadow-2xl shadow-black/20 glass-panel sm:rounded-3xl sm:p-7 animate-fade-up">
        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-900/5 p-1 dark:bg-[#0d151d]/90 dark:ring-1 dark:ring-teal-200/10 sm:mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError('');
            }}
            className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-all ${
              mode === 'create'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-[#1a2633] dark:text-teal-200 dark:ring-1 dark:ring-teal-300/20'
                : 'text-slate-500 hover:text-slate-800 dark:text-[#8ea5ad] dark:hover:text-[#edf4f3]'
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
            className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-all ${
              mode === 'join'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-[#1a2633] dark:text-teal-200 dark:ring-1 dark:ring-teal-300/20'
                : 'text-slate-500 hover:text-slate-800 dark:text-[#8ea5ad] dark:hover:text-[#edf4f3]'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Join Chat
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="secret-passcode"
                className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#9bb0b6]"
              >
                Secret Passcode
              </label>
              {mode === 'create' && (
                <button
                  type="button"
                  onClick={handleGeneratePasscode}
                  className="inline-flex min-h-[28px] items-center gap-1 text-xs font-medium text-teal-700 transition-colors hover:text-teal-600 dark:text-teal-300 dark:hover:text-cyan-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate code
                </button>
              )}
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#788f98]" />
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
                className="w-full rounded-2xl border border-slate-900/10 bg-white/80 py-3 pl-10 pr-12 font-mono text-base text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-teal-500/70 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-teal-200/15 dark:bg-[#0d151d]/90 dark:text-[#edf4f3] dark:placeholder:text-[#6f8690] dark:focus:border-teal-400/70 dark:focus:ring-teal-400/20 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((v) => !v)}
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-700 dark:text-[#8ea5ad] dark:hover:text-white"
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
                <p className="text-[11px] text-slate-500 dark:text-[#8ea5ad]">
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="ephemeral-alias"
                className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#9bb0b6]"
              >
                Display Name <span className="normal-case opacity-75">(optional)</span>
              </label>
              <button
                type="button"
                onClick={handleRefreshAlias}
                className="inline-flex min-h-[28px] items-center gap-1 text-xs text-slate-500 transition-colors hover:text-teal-600 dark:text-[#8ea5ad] dark:hover:text-teal-300"
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
              className="w-full rounded-2xl border border-slate-900/10 bg-white/80 px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-teal-500/70 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-teal-200/15 dark:bg-[#0d151d]/90 dark:text-[#edf4f3] dark:placeholder:text-[#6f8690] dark:focus:border-teal-400/70 dark:focus:ring-teal-400/20 sm:text-sm"
            />
          </div>

          {mode === 'create' && (
            <div className="rounded-2xl border border-slate-900/5 bg-slate-900/[0.03] dark:border-teal-200/10 dark:bg-[#0d151d]/60">
              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                className="flex min-h-[42px] w-full items-center justify-between px-3.5 py-2.5 text-xs font-medium text-slate-600 dark:text-[#c4d4d9] sm:px-4"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300" />
                  Chat settings
                </span>
                <span className="text-[11px] text-slate-400 dark:text-[#849aa2]">
                  {TTL_OPTIONS.find((t) => t.minutes === ttlMinutes)?.label} • Max {maxParticipants}
                </span>
              </button>

              {showOptions && (
                <div className="space-y-4 border-t border-slate-900/5 px-3.5 py-3.5 dark:border-teal-200/10 sm:px-4">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#9bb0b6]">
                      <Clock className="h-3.5 w-3.5" />
                      Auto-delete after
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TTL_OPTIONS.map((opt) => (
                        <button
                          key={opt.minutes}
                          type="button"
                          onClick={() => setTtlMinutes(opt.minutes)}
                          className={`min-h-[36px] rounded-xl py-1.5 text-[11px] font-medium transition-colors sm:text-xs ${
                            ttlMinutes === opt.minutes
                              ? 'bg-teal-500/20 text-teal-700 ring-1 ring-teal-500/40 dark:bg-teal-400/20 dark:text-teal-200 dark:ring-teal-300/40'
                              : 'bg-white/60 text-slate-600 hover:bg-white dark:bg-[#16212c] dark:text-[#9bb0b6] dark:hover:bg-[#1d2b38]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#9bb0b6]">
                      <Users className="h-3.5 w-3.5" />
                      People limit
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CAPACITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setMaxParticipants(opt.value)}
                          className={`min-h-[36px] rounded-xl py-1.5 text-[11px] font-medium transition-colors sm:text-xs ${
                            maxParticipants === opt.value
                              ? 'bg-teal-500/20 text-teal-700 ring-1 ring-teal-500/40 dark:bg-teal-400/20 dark:text-teal-200 dark:ring-teal-300/40'
                              : 'bg-white/60 text-slate-600 hover:bg-white dark:bg-[#16212c] dark:text-[#9bb0b6] dark:hover:bg-[#1d2b38]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex min-h-[36px] cursor-pointer items-center justify-between gap-3 pt-1">
                    <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#c4d4d9]">
                      <Flame className="h-3.5 w-3.5 shrink-0 text-amber-500/90" />
                      Delete chat when everyone leaves
                    </span>
                    <input
                      type="checkbox"
                      checked={burnWhenEmpty}
                      onChange={(e) => setBurnWhenEmpty(e.target.checked)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 accent-teal-500"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-950/30 transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-teal-400/50 disabled:cursor-not-allowed disabled:opacity-65"
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
