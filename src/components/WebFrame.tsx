import React from 'react';
import { Platform, Dimensions } from 'react-native';

// Widest the app's mobile-first layout should stretch to on a browser —
// matches the max-width the injected CSS below caps the page at.
export const MAX_CONTENT_WIDTH = 480;

/** Screens that size layout off `Dimensions.get('window').width` should use this
 *  instead, so they stop stretching edge-to-edge on wide browser windows. */
export function getClampedWindowWidth(): number {
  const raw = Dimensions.get('window').width;
  return Platform.OS === 'web' ? Math.min(raw, MAX_CONTENT_WIDTH) : raw;
}

// Pure CSS media query — the browser handles resizing natively, so this
// can't race with React state the way a resize-listener + measured width would.
let injected = false;
function injectFrameStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    @media (min-width: ${MAX_CONTENT_WIDTH + 1}px) {
      html, body { background: #E4E4EC; }
      #root {
        max-width: ${MAX_CONTENT_WIDTH}px;
        margin: 0 auto;
        min-height: 100vh;
        box-shadow: 0 12px 40px rgba(0,0,0,0.25);
      }
    }
  `;
  document.head.appendChild(style);
}

if (Platform.OS === 'web') injectFrameStyles();

/**
 * On web, constrains the app to a phone-width column centered on the page so
 * it doesn't stretch edge-to-edge on laptop/desktop screens. No-op on native.
 */
export default function WebFrame({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
