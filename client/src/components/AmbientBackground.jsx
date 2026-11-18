export default function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Top-left sage aura */}
      <div
        className="animate-breathe-slow absolute -left-32 -top-32 h-[34rem] w-[34rem] rounded-full opacity-40 blur-[120px] dark:opacity-25"
        style={{
          background:
            'radial-gradient(circle, rgba(114,176,160,0.48) 0%, rgba(114,176,160,0) 70%)',
        }}
      />
      {/* Bottom-right twilight lavender-slate aura */}
      <div
        className="animate-breathe-slow absolute -bottom-40 -right-24 h-[38rem] w-[38rem] rounded-full opacity-35 blur-[130px] dark:opacity-25"
        style={{
          animationDelay: '-6s',
          background:
            'radial-gradient(circle, rgba(139,154,209,0.42) 0%, rgba(139,154,209,0) 70%)',
        }}
      />
      {/* Subtle center mist */}
      <div
        className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[140px] dark:opacity-10"
        style={{
          background:
            'radial-gradient(circle, rgba(164,209,197,0.4) 0%, rgba(164,209,197,0) 72%)',
        }}
      />
    </div>
  );
}
