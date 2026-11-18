export default function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Top-left balanced cyan-teal mist */}
      <div
        className="animate-breathe-slow absolute -left-24 -top-24 h-[22rem] w-[22rem] rounded-full opacity-35 blur-[100px] dark:opacity-[0.18] sm:-left-32 sm:-top-32 sm:h-[34rem] sm:w-[34rem] sm:blur-[125px]"
        style={{
          background:
            'radial-gradient(circle, rgba(45,180,176,0.46) 0%, rgba(45,180,176,0) 70%)',
        }}
      />
      {/* Bottom-right calm slate-blue aura */}
      <div
        className="animate-breathe-slow absolute -bottom-28 -right-20 h-[24rem] w-[24rem] rounded-full opacity-30 blur-[110px] dark:opacity-[0.16] sm:-bottom-40 sm:-right-24 sm:h-[36rem] sm:w-[36rem] sm:blur-[135px]"
        style={{
          animationDelay: '-6s',
          background:
            'radial-gradient(circle, rgba(78,132,179,0.4) 0%, rgba(78,132,179,0) 70%)',
        }}
      />
      {/* Subtle center lift for dark-mode depth balance */}
      <div
        className="absolute left-1/2 top-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-[120px] dark:opacity-[0.07] sm:h-[30rem] sm:w-[30rem]"
        style={{
          background:
            'radial-gradient(circle, rgba(94,186,178,0.38) 0%, rgba(94,186,178,0) 72%)',
        }}
      />
    </div>
  );
}
