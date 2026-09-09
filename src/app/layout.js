import "@/app/globals.css";
import { IRANSansX } from "@/fonts/fonts";

import MainNavigation from "@/components/layout/navigation/MainNavigation";
import MenuProvider from "@/components/layout/navigation/MenuContext";
import TopNavigation from "@/components/layout/navigation/TopNavigation";
import { Toaster } from "react-hot-toast";

export const metadata = {
  // metadataBase: new URL(APP_URL),

  title: {
    default: "لقمه | پلتفرم اشتراک‌گذاری دستور پخت فارسی",
    template: "%s | لقمه",
  },

  description:
    "لقمه؛ جایی برای کشف، ذخیره و اشتراک‌گذاری دستورهای آشپزی و پیدا کردن غذاهای مورد علاقه‌تان.",

  keywords: [
    "لقمه",
    "دستور پخت",
    "آشپزی",
    "غذا",
    "دستور غذا",
    "طرز تهیه",
    "آشپز",
    "Recipe",
    "Cooking",
  ],

  applicationName: "لقمه",
  authors: [{ name: "تیم لقمه" }],
  creator: "لقمه",
  publisher: "لقمه",

  openGraph: {
    type: "website",
    locale: "fa_IR",
    // url: APP_URL,
    siteName: "لقمه",
    title: "لقمه | پلتفرم اشتراک‌گذاری دستور پخت فارسی",
    description:
      "دستورهای پخت متنوع رو کشف کن، دستور خودت رو به اشتراک بذار و به جامعه‌ی آشپزهای لقمه بپیوند.",
    images: [
      {
        url: "/img/og-image.png",
        width: 1200,
        height: 630,
        alt: "لقمه",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "لقمه | پلتفرم اشتراک‌گذاری دستور پخت فارسی",
    description: "دستورهای پخت فارسی رو کشف کن و دستور خودت رو منتشر کن.",
    images: ["/img/og-image.png"],
  },

  icons: {
    icon: "/img/favicon.ico",
    shortcut: "/img/favicon-16x16.png",
    apple: "/img/apple-touch-icon.png",
  },

  manifest: "/site.webmanifest",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },

  // TODO Add verification for Google Search Console
  // verification: { google: "..." },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" className={`${IRANSansX.variable}`} dir="rtl">
      <body className="min-h-full flex flex-col bg-neutral-2">
        {/* <MenuProvider>
          <MainNavigation />
          <TopNavigation /> */}
        {children}
        {/* </MenuProvider> */}

        <Toaster
          position="top-center"
          gutter={16}
          containerStyle={{
            top: 43,
          }}
        />
      </body>
    </html>
  );
}
