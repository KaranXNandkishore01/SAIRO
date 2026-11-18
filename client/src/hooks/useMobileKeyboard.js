import { useCallback, useEffect, useRef, useState } from 'react';

function isPhoneOrTablet() {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  // Phones & tablets (including iPads in landscape up to 1366px with touch)
  return (coarsePointer || hasTouch) && window.innerWidth <= 1366;
}

/**
 * Detects when the on-screen keyboard is open on phones and tablets.
 * Combines visualViewport height tracking with composer focus/blur for instant,
 * reliable detection on both iOS/iPadOS Safari and Android Chrome.
 */
export function useMobileKeyboard(enabled) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const maxHeightRef = useRef(0);
  const sawViewportShrinkRef = useRef(false);

  const resetBaseline = useCallback(() => {
    const vv = window.visualViewport;
    const currentHeight = vv ? vv.height : window.innerHeight;
    maxHeightRef.current = Math.max(window.innerHeight, currentHeight);
    sawViewportShrinkRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setKeyboardOpen(false);
      sawViewportShrinkRef.current = false;
      return;
    }

    resetBaseline();

    const handleViewportResize = () => {
      if (!isPhoneOrTablet()) {
        setKeyboardOpen(false);
        return;
      }

      const vv = window.visualViewport;
      const currentHeight = vv ? vv.height : window.innerHeight;

      if (currentHeight > maxHeightRef.current) {
        maxHeightRef.current = currentHeight;
      }

      const heightDrop = maxHeightRef.current - currentHeight;

      if (heightDrop >= 120) {
        sawViewportShrinkRef.current = true;
        setKeyboardOpen(true);
      } else if (sawViewportShrinkRef.current && heightDrop <= 60) {
        sawViewportShrinkRef.current = false;
        setKeyboardOpen(false);
      }
    };

    const handleOrientationChange = () => {
      // Wait for browser layout to settle after rotation
      setTimeout(() => {
        resetBaseline();
        setKeyboardOpen(false);
      }, 300);
    };

    const vv = window.visualViewport;
    vv?.addEventListener('resize', handleViewportResize);
    window.addEventListener('resize', handleViewportResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      vv?.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [enabled, resetBaseline]);

  const onComposerFocus = useCallback(() => {
    if (enabled && isPhoneOrTablet()) {
      setKeyboardOpen(true);
    }
  }, [enabled]);

  const onComposerBlur = useCallback(() => {
    setKeyboardOpen(false);
    sawViewportShrinkRef.current = false;
  }, []);

  return {
    keyboardOpen: enabled && keyboardOpen,
    onComposerFocus,
    onComposerBlur,
  };
}
