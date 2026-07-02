import "./globals.css";
import { Providers } from "./providers";

// TODO: Update metadata with actual demo details
export const metadata = {
  title: "Demo Template",
  description: "Industry Solutions Demo Template for NextJS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
