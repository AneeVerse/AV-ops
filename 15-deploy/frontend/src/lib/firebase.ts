import { initializeApp, getApps, getApp } from "firebase/app"
import { getMessaging, getToken, onMessage } from "firebase/messaging"

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const isFirebaseConfigured = !!firebaseConfig.projectId

const app = isFirebaseConfigured 
    ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
    : null

export const requestNotificationPermission = async () => {
    try {
        if (typeof window === "undefined" || !("Notification" in window) || !app) {
            return null
        }

        const permission = await Notification.requestPermission()
        if (permission === "granted") {
            // Explicitly register service worker to avoid path issues
            const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")

            const messaging = getMessaging(app)
            const token = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration,
            })
            return token
        }
    } catch (error) {
        throw error // Throwing so UI can catch it
    }
}

export const onMessageListener = () =>
    new Promise((resolve) => {
        if (!app) return
        const messaging = getMessaging(app)
        onMessage(messaging, (payload) => {
            resolve(payload)
        })
    })

export default app

