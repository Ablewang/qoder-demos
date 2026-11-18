import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

const MAX_FIXED_SHARE = 0.25;

export function ActionBar({ children }: { children: ComponentChildren }) {
  const element = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const bar = element.current!;
    const measure = () => {
      // Decide from the bar's would-be fixed height so toggling flow never feeds back into the decision.
      bar.classList.remove('action-bar-inline');
      const fixed = getComputedStyle(bar).position === 'fixed';
      const natural = fixed ? bar.getBoundingClientRect().height : 0;
      const inline = fixed && natural > window.innerHeight * MAX_FIXED_SHARE;
      bar.classList.toggle('action-bar-inline', inline);
      const height = inline ? 0 : natural;
      setHeight(height);
      document.documentElement.style.setProperty('--action-height', `${height}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bar); window.addEventListener('resize', measure); measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); document.documentElement.style.removeProperty('--action-height'); };
  }, []);
  return <><div aria-hidden="true" style={{ height }} /><div class="action-bar" ref={element}>{children}</div></>;
}
