import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  deriveRoomEncryption,
  deriveRoomIdentity,
  normalizePasscode,
} from '../crypto/e2ee';
import { generateEphemeralAlias, saveEphemeralAlias } from '../utils/alias';
import { api } from '../services/api';

export default function PasscodeGate({ publicId, initialAlias, onRoomReady, onBackHome }) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [checking, setChecking] = useState(true);

  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [alias, setAlias] = useState(initialAlias);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setChecking(true);
    setMetaError('');

    api
      .getRoomMeta(publicId)
      .then((data) => {
        if (!active) return;
        setMeta(data);
      })
      .catch((err) => {
        if (!active) return;
        setMetaError(err.message || 'This chat does not exist or has expired.');
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [publicId]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    const cleanCode = normalizePasscode(passcode);
    if (cleanCode.length < 4) {
      setError('Please enter the secret passcode shared with you.');
      return;
    }

    const cleanAlias = saveEphemeralAlias(alias);
    setAlias(cleanAlias);
    setLoading(true);

    try {
      const { roomHash, authVerifier } = await deriveRoomIdentity(cleanCode);
      const room = await api.verifyRoomPasscode(publicId, { roomHash, authVerifier });
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
    } catch (err) {
      setError(err.message || 'Incorrect secret passcode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-3 py-8 sm:px-4 sm:py-10">
      <div className="w-full rounded-2xl p-5 shadow-2xl shadow-black/20 glass-panel sm:rounded-3xl sm:p-7 animate-fade-up">
        {checking ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="mb-3 h-7 w-7 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" />
            <p className="text-sm text-slate-500 dark:text-[#9bb0b6]">Checking chat...</p>
          </div>
        ) : metaError ? (
          <div className="space-y-5 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[#edf4f3]">
                Chat Unavailable
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-[#9bb0b6]">
                {metaError}
              </p>
            </div>
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl bg-teal-500/15 px-5 py-2.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-500/25 dark:text-teal-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Home
            </button>
          </div>
        ) : (
          <form onSubmit={handleUnlock} className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-3.5 h-16 w-16 overflow-hidden rounded-2xl bg-black shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400/35">
                <img
                  src="/sairo-logo.jpg"
                  alt="SAIRO"
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-[#edf4f3]">
                Enter Secret Passcode
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-[#9bb0b6]">
                Enter the secret passcode to join this private chat ({meta?.activeCount || 0}/
                {meta?.maxParticipants} connected).
              </p>
            </div>

            <div>
              <label
                htmlFor="gate-passcode"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#9bb0b6]"
              >
                Secret Passcode
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#788f98]" />
                <input
                  id="gate-passcode"
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                  autoComplete="off"
                  spellCheck="false"
                  placeholder="Enter secret passcode"
                  className="w-full rounded-2xl border border-slate-900/10 bg-white/80 py-3 pl-10 pr-12 font-mono text-base text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-teal-500/70 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-teal-200/15 dark:bg-[#0d151d]/90 dark:text-[#edf4f3] dark:placeholder:text-[#6f8690] dark:focus:border-teal-400/70 dark:focus:ring-teal-400/20 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:text-[#8ea5ad] dark:hover:text-white"
                >
                  {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="gate-alias"
                  className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#9bb0b6]"
                >
                  Display Name
                </label>
                <button
                  type="button"
                  onClick={() => setAlias(generateEphemeralAlias())}
                  className="inline-flex min-h-[28px] items-center gap-1 text-xs text-slate-500 hover:text-teal-500 dark:text-[#8ea5ad] dark:hover:text-teal-300"
                >
                  <RefreshCw className="h-3 w-3" />
                  Change
                </button>
              </div>
              <input
                id="gate-alias"
                type="text"
                maxLength={28}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full rounded-2xl border border-slate-900/10 bg-white/80 px-4 py-2.5 text-base text-slate-900 focus:border-teal-500/70 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-teal-200/15 dark:bg-[#0d151d]/90 dark:text-[#edf4f3] dark:focus:border-teal-400/70 dark:focus:ring-teal-400/20 sm:text-sm"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-950/30 transition-all hover:brightness-105 disabled:opacity-65"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <span>Join Chat</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBackHome}
              className="flex min-h-[38px] w-full items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-[#8ea5ad] dark:hover:text-[#edf4f3]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
