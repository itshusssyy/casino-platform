"use client";

export function LogoutButton() {
  return (
    <button
      className="text-sm text-muted hover:text-text"
      aria-label="Log out"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        // Full reload on purpose: resets the client-side balance state.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
      }}
    >
      <span className="hidden sm:inline">Logout</span>
      <svg viewBox="0 0 24 24" className="h-5 w-5 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" /></svg>
    </button>
  );
}
