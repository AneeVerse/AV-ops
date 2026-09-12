import { retrieveCustomer } from "@lib/data/customer"
import { getBaseURL } from "@lib/util/env"
import { SHOP_NAME } from "@lib/util/brand"
import { GoogleAuthShell } from "@pradip1995/commerce-auth/components/google-auth-shell"
import { GoogleIdentityServicesScript } from "@pradip1995/commerce-auth/components/google-identity-script"
import { Metadata } from "next"
import { Cormorant_Garamond, Montserrat } from "next/font/google"
import Script from "next/script"
import "styles/globals.css"
import CookieConsent from "@modules/layout/components/cookie-consent"

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["300", "400", "500", "600", "700"],
})

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    template: `%s | ${SHOP_NAME}`,
    default: `${SHOP_NAME} | Premium Moissanite & 925 Sterling Silver Jewelry`,
  },
  description: `Discover luxury moissanite jewelry set in pure 925 sterling silver at ${SHOP_NAME}. Explore GRA-certified rings, earrings, pendants, and customized necklaces.`,
  openGraph: {
    title: `${SHOP_NAME} | Premium Moissanite Jewelry Shop`,
    description: "Discover luxury moissanite jewelry. 925 sterling silver, GRA-certified brilliance, and customized designs for all occasions.",
    url: "https://onecarat.world",
    siteName: SHOP_NAME,
    images: [
      {
        url: "/appbanner.png",
        width: 1200,
        height: 630,
        alt: `${SHOP_NAME} - Premium Moissanite Jewelry`,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SHOP_NAME} | Premium Moissanite Jewelry Store`,
    description: "Luxury moissanite jewelry set in pure 925 sterling silver. Shop our GRA-certified collection today.",
    images: ["/appbanner.png"],
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  alternates: {
    canonical: "https://onecarat.world",
  },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const customer = await retrieveCustomer().catch(() => null)
  const isAuthenticated = Boolean(
    customer && customer.id !== "pending_deletion"
  )

  return (
    <html lang="en" data-mode="light" suppressHydrationWarning>
      <head>
        <GoogleIdentityServicesScript />
        <Script
          id="gtm-consent-default"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              const getConsent = function() {
                try {
                  return typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function' ? window.localStorage.getItem('cookie_consent') : null;
                } catch(e) { return null; }
              };
              const consent = getConsent();
              if(!consent){
                gtag('consent', 'default', {
                  'ad_storage': 'denied',
                  'analytics_storage': 'denied',
                  'ad_user_data': 'denied',
                  'ad_personalization': 'denied'
                });
              } else {
                gtag('consent', 'default', {
                  'ad_storage': consent === 'granted' ? 'granted' : 'denied',
                  'analytics_storage': consent === 'granted' ? 'granted' : 'denied',
                  'ad_user_data': consent === 'granted' ? 'granted' : 'denied',
                  'ad_personalization': consent === 'granted' ? 'granted' : 'denied'
                });
              }
            `,
          }}
        />
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
               new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-MDPRFG8W');
            `,
          }}
        />
      </head>
      <body className={`${montserrat.variable} ${cormorant.variable} font-sans bg-ivory-bg text-royal-blue antialiased`}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MDPRFG8W"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          ></iframe>
        </noscript>
        <GoogleAuthShell isAuthenticated={isAuthenticated}>
          <div className="relative">{props.children}</div>
          <CookieConsent />
        </GoogleAuthShell>
      </body>
    </html>
  )
}
