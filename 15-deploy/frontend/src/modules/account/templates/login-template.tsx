"use client"

import { useState } from "react"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"
import ForgotPassword from "@modules/account/components/forgot-password"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
  FORGOT_PASSWORD = "forgot-password",
}

const LoginTemplate = () => {
  const [currentView, setCurrentView] = useState("sign-in")

  const renderView = () => {
    switch (currentView) {
      case LOGIN_VIEW.REGISTER:
        return <Register setCurrentView={setCurrentView} />
      case LOGIN_VIEW.FORGOT_PASSWORD:
        return <ForgotPassword setCurrentView={setCurrentView} />
      default:
        return <Login setCurrentView={setCurrentView} />
    }
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-ivory-bg"
    >
      {/* Main Content Area with Top Margin */}
      <div className="flex-1 flex flex-col items-center justify-start px-2 min-[340px]:px-3 min-[550px]:px-4 sm:px-6 md:px-8 pt-2 min-[340px]:pt-3 min-[550px]:pt-4 sm:pt-4 md:pt-6 pb-6 min-[340px]:pb-8 min-[550px]:pb-8 sm:pb-8 md:pb-8">
        {/* My Account Header */}
        <h1 className="text-2xl min-[340px]:text-3xl min-[550px]:text-3xl sm:text-4xl md:text-4xl font-bold text-gray-800 mb-4 min-[340px]:mb-6 min-[550px]:mb-8 sm:mb-8 md:mb-8 text-center">My Account</h1>

        {/* White Card Container - Centered with equal left/right spacing */}
        <div className="w-full bg-ivory-bg rounded-2xl shadow-lg p-4 min-[340px]:p-5 min-[550px]:p-6 sm:p-7 md:p-8" style={{ maxWidth: '560px' }}>
          {renderView()}
        </div>
      </div>
    </div>
  )
}

export default LoginTemplate
