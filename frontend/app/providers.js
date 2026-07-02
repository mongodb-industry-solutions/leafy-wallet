"use client";

import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";

export function Providers({ children }) {
  return <LeafyGreenProvider>{children}</LeafyGreenProvider>;
}
