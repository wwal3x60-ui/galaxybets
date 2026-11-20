"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import UiGlyph from "@/components/ui/UiGlyph";
import styles from "./LiveSupport.module.css";

const WIDGET_URL = "https://embed.helpcrunch.com/sdk.js";
const SCRIPT_ID = "galaxybets-helpcrunch-live-support";
type HelpCrunchApi = { (...args: unknown[]): void; q?: unknown[][] };
declare global {
  interface Window {
    helpcrunchSettings?: { organization: string; appId: string; showWidget?: boolean };
    HelpCrunch?: HelpCrunchApi;
  }
}

const serverState = { ready: false, open: false, failed: false, pending: false, panel: false };
let state = serverState;
let bound = false;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let openTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
function publish(update: Partial<typeof state>) {
  if (Object.entries(update).every(([key,value]) => state[key as keyof typeof state] === value)) return;
  state = { ...state, ...update };listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener);return () => { listeners.delete(listener); }; };
const snapshot = () => state;
const serverSnapshot = () => serverState;
const isHome = () => window.location.pathname === "/";

function requestOpen() {
  if (!isHome() || !state.ready || !window.HelpCrunch) return;
  clearTimeout(openTimer);
  publish({ pending: true, panel: true, failed: false });
  // Wait for the actual open event, rather than assuming the SDK opened.
  openTimer = setTimeout(() => {
    if (isHome() && state.pending) publish({ pending: false, failed: true });
  }, 12000);
  try { window.HelpCrunch("openChat"); }
  catch { clearTimeout(openTimer);publish({ pending: false, failed: true }); }
}

function closeSupport() {
  clearTimeout(openTimer);
  publish({ open: false, pending: false, panel: false });
  window.HelpCrunch?.("closeChat");
  window.HelpCrunch?.("hideChatWidget");
}

function syncVisibility() {
  // Our 44px launcher replaces the provider's default floating button.
  window.HelpCrunch?.("hideChatWidget");
  if (!isHome()) {
    closeSupport();
  }
}

function loadSupport() {
  if (!isHome()) return;
  if (!window.HelpCrunch) {
    const queue: unknown[][] = [];
    const api: HelpCrunchApi = (...args) => { queue.push(args); };
    api.q = queue;window.HelpCrunch = api;
  }
  if (!bound) {
    bound = true;
    window.HelpCrunch("onReady", () => {
      clearTimeout(loadTimer);
      const requested = state.pending || state.panel;
      publish({ ready: true, failed: false });
      syncVisibility();
      if (isHome() && requested) requestOpen();
    });
    window.HelpCrunch("onChatOpen", () => {
      if (!isHome()) { syncVisibility();return; }
      clearTimeout(openTimer);
      publish({ open: true, pending: false, panel: false, failed: false });
    });
    window.HelpCrunch("onChatClose", () => {
      clearTimeout(openTimer);
      window.HelpCrunch?.("hideChatWidget");
      publish({ open: false, pending: false, panel: false });
    });
  }
  if (document.getElementById(SCRIPT_ID) || document.querySelector(`script[src="${WIDGET_URL}"]`)) return;
  window.helpcrunchSettings = {
    organization: "galaxybets",
    appId: "34731ee1-ccc1-4148-af12-fb58b1a5ca0a",
    showWidget: false,
  };
  const script = document.createElement("script");
  script.id = SCRIPT_ID;script.async = true;script.type = "text/javascript";script.src = WIDGET_URL;
  clearTimeout(loadTimer);
  loadTimer = setTimeout(() => {
    if (!state.ready) publish({ pending: false, failed: true });
  }, 20000);
  script.onerror = () => {
    clearTimeout(loadTimer);
    script.remove();
    publish({ ready: false, pending: false, failed: true });
  };
  (document.body || document.head).appendChild(script);
}

export default function LiveSupport() {
  const pathname = usePathname();
  const { ready, open, failed, pending, panel } = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => {
    syncVisibility();
    if (pathname !== "/") return;
    // Load the external chat only after the visitor requests support.
    return closeSupport;
  }, [pathname]);

  // Other pages have neither our launcher nor a directly loaded third-party SDK.
  if (pathname !== "/") return null;
  return <>
    {panel && <section id="galaxybets-support-status" className={styles.panel} aria-label="Support">
      <div className={styles.panelHeader}><strong>GalaxyBets Support</strong><button type="button" aria-label="Close support" onClick={closeSupport}><UiGlyph name="x"/></button></div>
      <p role="status">{failed ? "Live chat isn’t available right now. You can reach our team by email." : "Connecting to live support…"}</p>
      <a href="mailto:support@galaxybets.casino">Email support</a>
      {failed && ready && <button type="button" className={styles.retry} onClick={requestOpen}>Try live chat again</button>}
    </section>}
    <button type="button" className={styles.launcher} aria-label={open || panel ? "Close support chat" : "Open support chat"} aria-expanded={open || panel} aria-busy={pending} aria-controls={panel ? "galaxybets-support-status" : undefined} title={open || panel ? "Close support" : "Support"} onClick={() => {
      if (!isHome()) return;
      if (open || panel) { closeSupport();return; }
      if (ready) { requestOpen();return; }
      publish({ panel: true, pending: !failed });
      if (!failed) loadSupport();
    }}><UiGlyph name={open || panel ? "x" : "support"}/></button>
  </>;
}
