import { Public_Sans} from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "@/lib/AntRegistry";
import { ClerkProvider, RedirectToSignIn } from '@clerk/nextjs';
import { ClerkLoaded } from '@clerk/nextjs';
import "@/styles/typography.css";
import QueryProvider from "@/lib/QueryProvider";

const PublicSans = Public_Sans({
  subsets: ["latin"],
  weights: [400, 500 , 600],
})

export const metadata = {
  title: "Social",
  description: "Connect with people online",
};

export const viewport = {
  initialScale: 1.0,
  minimumScale: 1.0,
  maximumScale: 1.0,
  userScalable: "no",
  width: "device-width",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
    appearance={{
      signIn: {
        variables: { colorPrimary: "#F9AA11" },
      },
      signUp: {
        variables: { colorPrimary: "#F9AA11" },
      },
    }}>
      <html lang="en">
      <body className="{publicSans}">
        <QueryProvider>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
        </QueryProvider>
        
      </body>
    </html>
    </ClerkProvider>
    
  );
}
