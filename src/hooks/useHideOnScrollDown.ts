import { useEffect, useState } from 'react';

/** Gmail-style top bar: returns true once the user scrolls DOWN past a small
 *  threshold, false again the moment they scroll UP. Consumers translate their
 *  (fixed/sticky) bar off-screen while true — and should gate that to mobile,
 *  since this tracks window scroll, which desktop reader layouts don't use. */
export function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      // ponytail: 8px deadzone so momentum jitter doesn't flap the bar
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 72);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}
