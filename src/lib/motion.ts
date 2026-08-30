import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Read once, and again if the viewer changes it, rather than per value change.
 * The booth's motion is steps and hard cuts; anything decorative skips
 * entirely under reduce-motion rather than softening.
 */
export function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
