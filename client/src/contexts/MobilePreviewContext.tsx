import { createContext, useContext } from "react";

const MobilePreviewContext = createContext(false);

export function MobilePreviewProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return (
    <MobilePreviewContext.Provider value={value}>
      {children}
    </MobilePreviewContext.Provider>
  );
}

export function useMobilePreview() {
  return useContext(MobilePreviewContext);
}
