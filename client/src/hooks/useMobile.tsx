import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      const forced = document.documentElement.getAttribute("data-mobile-preview");
      if (forced === "true") {
        setIsMobile(true);
      } else {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      }
    };
    mql.addEventListener("change", onChange);

    // Observe data-mobile-preview attribute changes
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mobile-preview"],
    });

    onChange();
    return () => {
      mql.removeEventListener("change", onChange);
      observer.disconnect();
    };
  }, []);

  return !!isMobile;
}
