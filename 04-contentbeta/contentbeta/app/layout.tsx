import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { ToastProvider } from '@/lib/toast'
import { LightboxProvider } from '@/lib/lightbox'
import { ThemeProvider } from '@/lib/theme'
import { BrokerGenerationProvider } from '@/lib/broker-generation'
import { AdConceptGenerationProvider } from '@/lib/ad-concept-generation'
import { CarouselGenerationProvider } from '@/lib/carousel-generation'
import { IllustrationGenerationProvider } from '@/lib/illustration-generation'


export const metadata: Metadata = {
  title: 'ContentBeta',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script id="crisp-chat" strategy="afterInteractive">
          {`window.$crisp=[];window.CRISP_WEBSITE_ID="5f4650ec-f27d-4677-9a63-46b75e4a2b5e";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();window.$crisp.push(["do","chat:hide"]);`}
        </Script>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <LightboxProvider>
                <BrokerGenerationProvider>
                  <AdConceptGenerationProvider>
                    <CarouselGenerationProvider>
                      <IllustrationGenerationProvider>
                        {children}
                      </IllustrationGenerationProvider>
                    </CarouselGenerationProvider>
                  </AdConceptGenerationProvider>
                </BrokerGenerationProvider>
              </LightboxProvider>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
