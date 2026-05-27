import { useRef, useEffect } from "react";
import gsap from "gsap";

/**
 * Stagger-animate children with class "stagger-child" when `ready` becomes true.
 * Usage: attach ref to container, set ready=true when data loads.
 */
export function useStaggerIn<T extends HTMLElement>(ready: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ready || !ref.current) return;
    const children = ref.current.querySelectorAll(".stagger-child");
    if (!children.length) return;
    gsap.fromTo(children,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.3, ease: "power2.out" }
    );
  }, [ready]);

  return ref;
}
