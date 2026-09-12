"use client"

import React, { useState } from "react"
import Image from "next/image"

type CutGrade = "Excellent" | "Very Good" | "Good" | "Fair" | "Poor"
type ClarityGrade = "FL" | "IF" | "VVS1/VVS2" | "VS1/VS2" | "SI1/SI2" | "I1/I2/I3"
type ColorGrade = "D" | "E" | "F" | "G-J" | "K-M" | "N-R" | "S-Z"

interface DiamondShape {
  name: string
  label: string
  image: string
}

const DiamondGuideTemplate = () => {
  // Cut State
  const [selectedCut, setSelectedCut] = useState<CutGrade>("Excellent")
  const [hoveredCut, setHoveredCut] = useState<CutGrade | null>(null)
  const activeCut = hoveredCut || selectedCut

  // Clarity State
  const [selectedClarity, setSelectedClarity] = useState<ClarityGrade>("FL")
  const [hoveredClarity, setHoveredClarity] = useState<ClarityGrade | null>(null)
  const activeClarity = hoveredClarity || selectedClarity

  // Color State
  const [selectedColor, setSelectedColor] = useState<ColorGrade>("D")
  const [hoveredColor, setHoveredColor] = useState<ColorGrade | null>(null)
  const activeColor = hoveredColor || selectedColor

  const cutGrades: CutGrade[] = ["Excellent", "Very Good", "Good", "Fair", "Poor"]
  const clarityGrades: ClarityGrade[] = ["FL", "IF", "VVS1/VVS2", "VS1/VS2", "SI1/SI2", "I1/I2/I3"]
  const colorGrades: ColorGrade[] = ["D", "E", "F", "G-J", "K-M", "N-R", "S-Z"]

  const diamondShapes: DiamondShape[] = [
    {
      name: "round",
      label: "ROUND",
      image: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/round.png?updatedAt=1785156253917",
    },
    {
      name: "pear",
      label: "PEAR",
      image: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/pear.png?updatedAt=1785156287741",
    },
    {
      name: "heart",
      label: "HEART",
      image: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/heart.png?updatedAt=1785156314343",
    },
    {
      name: "princess",
      label: "PRINCESS",
      image: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/princess.png?updatedAt=1785156352120",
    },
    {
      name: "oval",
      label: "OVAL",
      image: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/oval.png?updatedAt=1785156381415",
    },
    {
      name: "cushion",
      label: "CUSHION",
      image: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/cushion.png?updatedAt=1785156410141",
    },
    {
      name: "emerald",
      label: "EMERALD",
      image: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/emerald.png?updatedAt=1785156443324",
    },
  ]

  const cutImages: Record<CutGrade, string> = {
    Excellent: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/excellent-excellent-cut.png?updatedAt=1785150479909",
    "Very Good": "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/verygood-verygood-cut.jpg",
    Good: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/good-good-cut.jpg",
    Fair: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/fair-fair-cut.jpg",
    Poor: "https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/poor-poor-cut.jpg",
  }

  const clarityDetails: Record<ClarityGrade, { title: string; desc: string }> = {
    FL: {
      title: "Flawless",
      desc: "Flawless diamonds have no inclusions or blemishes detectable under 10x magnification, and are extremely rare.",
    },
    IF: {
      title: "Internally Flawless",
      desc: "Internally Flawless diamonds have no inclusions and only blemishes are visible to a skilled grader using 10x magnification.",
    },
    "VVS1/VVS2": {
      title: "Very, Very Slightly Included",
      desc: "Very, Very Slightly Included diamonds have minute inclusions that range from extremely difficult to very difficult to see are visible to a skilled grader using 10x magnification.",
    },
    "VS1/VS2": {
      title: "Very Slightly Included",
      desc: "Very Slightly Included diamonds have minor inclusions that range from difficult to somewhat easy to see are visible to a skilled grader using 10x magnification.",
    },
    "SI1/SI2": {
      title: "Slightly Included",
      desc: "Slightly Included diamonds have noticeable inclusions that range from easy to very easy to see are visible to a skilled grader using 10x magnification.",
    },
    "I1/I2/I3": {
      title: "Included",
      desc: "Included diamonds have obvious inclusions that are visible to a skilled grader using 10x magnification and may affect transparency and brilliance.",
    },
  }

  const colorDetails: Record<ColorGrade, string> = {
    D: "Colorless",
    E: "Colorless",
    F: "Colorless",
    "G-J": "Near Colorless",
    "K-M": "Faint",
    "N-R": "Very Light",
    "S-Z": "Light",
  }

  // Clarity Positions
  const clarityPositions: Record<ClarityGrade, number> = {
    FL: 5.5,
    IF: 22.5,
    "VVS1/VVS2": 39.5,
    "VS1/VS2": 58.5,
    "SI1/SI2": 75.5,
    "I1/I2/I3": 92.5,
  }

  // Color Positions
  const colorPositions: Record<ColorGrade, number> = {
    D: 7.14,
    E: 21.43,
    F: 35.71,
    "G-J": 50.0,
    "K-M": 64.29,
    "N-R": 79.8,
    "S-Z": 94.2,
  }

  return (
    <div className="bg-[#FFFFFF] min-h-screen text-[#2D2D2D] font-sans antialiased">
      {/* 1. Semi-Circle Top Banner Graphic - Touches Navbar 100% Flush */}
      <div className="w-full flex justify-center bg-white overflow-hidden pt-0 mt-0">
        <div className="relative w-full max-w-[680px] aspect-[2.1/1] -mt-0.5">
          <Image
            src="https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/first-image.png?updatedAt=1785149828192"
            alt="Watercolor Diamond Top Banner"
            fill
            sizes="(max-width: 1024px) 100vw, 680px"
            className="object-contain object-top"
            priority
          />
        </div>
      </div>

      {/* 2. Warm Luxury Ivory Cream Hero Section */}
      <section className="bg-[#FAF5EC] py-10 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 text-center border-b border-amber-100/50">
        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-3.5">
          <h1 className="text-2xl sm:text-3xl font-sans font-medium text-[#1C1335] tracking-tight">
            Diamond Buying Guide
          </h1>
          <p className="text-[#3A334E] text-xs sm:text-sm md:text-[15px] leading-relaxed max-w-3xl mx-auto font-normal opacity-95">
            We know you're here because you only want the best and we would love to help you find the perfect diamond for you. We also know that buying diamonds can be a little overwhelming, but that doesn't mean that you should ever settle or stress! So just sit back with a cup of coffee and let us walk you through everything you need to know before you buy that sparkling diamond!
          </p>
        </div>
      </section>

      {/* 3. Main Content Container - Compact Mobile Vertical Gaps */}
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-16 sm:pb-20 space-y-10 sm:space-y-16 lg:space-y-20">
        {/* Main Section Heading */}
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-sans font-medium text-[#1C1335]">
            Back to the Basics - The 4 Cs of a Diamond
          </h2>
        </div>

        {/* 1. Cut Section */}
        <section className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start">
            {/* Left Column (Title + Text + Hint) */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-xl font-sans font-medium text-[#1C1335]">
                1. Cut:
              </h3>
              <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                We believe the cut is the most important aspect of choosing a diamond. It's basically what determines the proportion, symmetry and polish of a diamond. The right cut will enhance the sparke and the scintillation of the diamond. The better the cut, the more likely your diamond is to sparkle bright and look gorgeous!
              </p>

              <div className="space-y-1.5 pt-1 sm:pt-2">
                <span className="text-[#B58A44] font-semibold text-xs sm:text-sm block">
                  Cultura Hint:
                </span>
                <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                  Invest in the cut. It's the ultimate diamond hack (you'll not find it in the books). A beautifully cut diamond can make the color and clarity appear better than they are.
                </p>
              </div>
            </div>

            {/* Right Column (Image + Interactive Slider) */}
            <div className="space-y-3 bg-white p-0 rounded-none overflow-visible -mt-1 sm:-mt-2">
              <div className="space-y-1 w-full max-w-[545px] lg:w-[545px] mx-auto px-1 sm:px-2">
                {/* Dynamic Image Display */}
                <div className="relative w-full aspect-[2.4/1] sm:aspect-[2.6/1] mx-auto overflow-hidden">
                  <Image
                    src={cutImages[activeCut]}
                    alt={`${activeCut} Cut Diamond`}
                    fill
                    sizes="(max-width: 768px) 100vw, 545px"
                    className="object-contain object-top"
                    priority
                  />
                </div>

                {/* Slider Track & Controls Container for Cut */}
                <div className="space-y-3 sm:space-y-4 pt-1">
                  {/* Track Line Container */}
                  <div className="relative w-full">
                    {/* Clean Static Background Track Line */}
                    <div className="absolute top-[10px] -translate-y-1/2 left-[calc(100%/10)] right-[calc(100%/10)] h-[2px] bg-[#E5D7BF] rounded-full z-0" />

                    {/* Interactive Pin Dots & Centered Labels Grid */}
                    <div className="relative z-10 grid grid-cols-5 w-full">
                      {cutGrades.map((grade) => {
                        const isActive = activeCut === grade
                        return (
                          <div
                            key={grade}
                            onMouseEnter={() => setHoveredCut(grade)}
                            onMouseLeave={() => setHoveredCut(null)}
                            onClick={() => setSelectedCut(grade)}
                            className="flex flex-col items-center cursor-pointer group space-y-2 w-full"
                          >
                            {/* 20px High Container Centered at 10px */}
                            <div className="w-5 h-5 flex items-center justify-center">
                              <div
                                className={`rounded-full bg-white transition-all duration-200 ${
                                  isActive
                                    ? "w-4 h-4 border-[2.5px] border-[#B58A44] ring-4 ring-[#B58A44]/20 shadow-sm"
                                    : "w-3.5 h-3.5 border-2 border-[#D8C7AA] group-hover:border-[#B58A44]"
                                }`}
                              />
                            </div>

                            {/* Text Label Centered Directly Below Dot */}
                            <span
                              className={`text-[10px] sm:text-[11px] text-center transition-colors tracking-tight font-medium ${
                                isActive
                                  ? "text-[#B58A44] font-bold"
                                  : "text-[#4A435D] group-hover:text-[#B58A44]"
                              }`}
                            >
                              {grade}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Sleek Compact Description Box */}
                  <div className="bg-[#FCFBF7] border border-[#E5D7BF] rounded-xl px-3 sm:px-4 py-1.5 text-center text-xs sm:text-sm shadow-2xs transition-all mt-1">
                    <span className="text-[#B58A44] font-bold">{activeCut}</span>
                    <span className="text-gray-400 font-light mx-1.5">-</span>
                    <span className="text-[#2D2D2D] font-normal">{activeCut}</span>
                  </div>

                  {/* Cultura Recommended Note */}
                  <div className="pt-0.5 sm:pt-1">
                    <p className="text-xs sm:text-sm text-[#B58A44] font-semibold tracking-wide">
                      Cultura Recommended Cut - Good
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Clarity Section */}
        <section className="pt-5 sm:pt-8 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start">
            {/* Left Column (Title + Text + Hint) */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-xl font-sans font-medium text-[#1C1335]">
                2. Clarity
              </h3>
              <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                When light passes through a diamond, it bounces back, making the diamond sparkle! Some diamonds have imperfections in the form of spots and blemishes. The more the imperfections, the more difficult it is for light to pass through, thereby reducing the sparkle. If you're lost, here's all you need to remember: Lesser imperfection and inclusions = Better clarity
              </p>

              <div className="space-y-1.5 pt-1 sm:pt-2">
                <span className="text-[#B58A44] font-semibold text-xs sm:text-sm block">
                  Cultura Hint:
                </span>
                <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                  If you're buying a diamond that's under a carat, don't obsess over the spots or blemishes because they aren't really visible to an untrained eye. It's better to invest in the cut and sparkle on!
                </p>
              </div>
            </div>

            {/* Right Interactive Clarity Display */}
            <div className="space-y-3 sm:space-y-4 bg-white p-0 sm:p-4 rounded-none overflow-visible">
              {/* Single Shared Container for Image and 6 Slider Dots */}
              <div className="space-y-1 w-full max-w-[545px] lg:w-[545px] mx-auto px-1 sm:px-2">
                {/* High-Res Diamond Clarity Chart measuring EXACTLY 545 x 75 */}
                <div className="relative w-full h-[75px] max-w-[545px] overflow-hidden">
                  <Image
                    src="https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/clarity.jpg?updatedAt=1785150619511"
                    alt="Diamond Clarity Inclusions Chart FL to I1/I2/I3"
                    fill
                    sizes="545px"
                    className="object-contain object-bottom"
                    priority
                  />
                </div>

                {/* Slider Track & Controls Container */}
                <div className="space-y-3 sm:space-y-4 pt-1">
                  {/* Track Line Container */}
                  <div className="relative w-full h-12">
                    {/* Clean Static Background Track Line */}
                    <div
                      className="absolute top-[10px] -translate-y-1/2 h-[2px] bg-[#E5D7BF] rounded-full z-0"
                      style={{
                        left: `${clarityPositions["FL"]}%`,
                        right: `${100 - clarityPositions["I1/I2/I3"]}%`,
                      }}
                    />

                    {/* Interactive Pin Dots & Centered Labels */}
                    <div className="relative z-10 w-full">
                      {clarityGrades.map((grade) => {
                        const isActive = activeClarity === grade
                        const leftPos = clarityPositions[grade]
                        return (
                          <div
                            key={grade}
                            onMouseEnter={() => setHoveredClarity(grade)}
                            onMouseLeave={() => setHoveredClarity(null)}
                            onClick={() => setSelectedClarity(grade)}
                            className="absolute flex flex-col items-center cursor-pointer group space-y-2 w-20"
                            style={{
                              left: `${leftPos}%`,
                              transform: "translateX(-50%)",
                            }}
                          >
                            {/* 20px High Container Centered at 10px */}
                            <div className="w-5 h-5 flex items-center justify-center">
                              <div
                                className={`rounded-full bg-white transition-all duration-200 ${
                                  isActive
                                    ? "w-4 h-4 border-[2.5px] border-[#B58A44] ring-4 ring-[#B58A44]/20 shadow-sm"
                                    : "w-3.5 h-3.5 border-2 border-[#D8C7AA] group-hover:border-[#B58A44]"
                                }`}
                              />
                            </div>

                            {/* Text Label Centered Directly Below Dot */}
                            <span
                              className={`text-[10px] sm:text-[11px] text-center transition-colors tracking-tight font-medium ${
                                isActive
                                  ? "text-[#B58A44] font-bold"
                                  : "text-[#4A435D] group-hover:text-[#B58A44]"
                              }`}
                            >
                              {grade}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Compact Description Box */}
                  <div className="bg-[#FCFBF7] border border-[#E5D7BF] rounded-xl px-3 sm:px-4 py-2 text-left text-xs leading-relaxed shadow-2xs transition-all space-x-1 mt-1">
                    <span className="text-[#B58A44] font-bold">{activeClarity}</span>
                    <span className="text-gray-400 font-light">-</span>
                    <span className="font-bold text-[#1C1335]">
                      {clarityDetails[activeClarity].title}
                    </span>{" "}
                    <span className="text-[#3A334E] font-normal">
                      {clarityDetails[activeClarity].desc}
                    </span>
                  </div>

                  {/* Cultura Recommended Note */}
                  <div className="pt-0.5 sm:pt-1">
                    <p className="text-xs sm:text-sm text-[#B58A44] font-semibold tracking-wide">
                      Cultura Recommended Cut - I1-I2-I3
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Colour Section */}
        <section className="pt-5 sm:pt-8 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start">
            {/* Left Column (Title + Text + Hint) */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-xl font-sans font-medium text-[#1C1335]">
                3. Colour
              </h3>
              <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                Ironically, the best color for a diamond would be 'colorless'. The colors range from D (colorless) and go all the way to Z (light yellow). To be honest, the colour difference in diamonds within a colour family is quite subtle to an untrained eye. Nevertheless, they do create a difference in the price and quality of the diamond. Bottom line is, colorless diamonds are the most precious!
              </p>

              <div className="space-y-1.5 pt-1 sm:pt-2">
                <span className="text-[#B58A44] font-semibold text-xs sm:text-sm block">
                  Cultura Hint:
                </span>
                <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                  As diamond size increases, colour becomes more noticeable. This is especially important to keep in mind if you are purchasing a diamond of two carats or greater. If you pick a slightly yellow colored diamond, you can pair it with a white gold or platinum band. The white gold will complement the yellow hue of your diamond, and they won't clash with each other!
                </p>
              </div>
            </div>

            {/* Right Interactive Colour Display */}
            <div className="space-y-3 sm:space-y-4 bg-white p-0 sm:p-4 rounded-none overflow-visible">
              {/* Single Shared Container for Image and 7 Colour Slider Dots */}
              <div className="space-y-1 w-full max-w-[545px] lg:w-[545px] mx-auto px-1 sm:px-2">
                {/* High-Res Diamond Color Chart Tight Bottom Fit */}
                <div className="relative w-full aspect-[3.2/1] sm:aspect-[3.6/1] overflow-hidden">
                  <Image
                    src="https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/colour.png?updatedAt=1785150549552"
                    alt="Diamond Color Grade Scale D to S-Z"
                    fill
                    sizes="(max-width: 768px) 100vw, 545px"
                    className="object-contain object-bottom"
                    priority
                  />
                </div>

                {/* Slider Track & Controls Container for Colour */}
                <div className="space-y-3 sm:space-y-4 pt-1">
                  {/* Track Line Container */}
                  <div className="relative w-full h-12">
                    {/* Clean Static Background Track Line connecting D (7.14%) to S-Z (94.2%) */}
                    <div
                      className="absolute top-[10px] -translate-y-1/2 h-[2px] bg-[#E5D7BF] rounded-full z-0"
                      style={{
                        left: `${colorPositions["D"]}%`,
                        right: `${100 - colorPositions["S-Z"]}%`,
                      }}
                    />

                    {/* Interactive Pin Dots & Centered Labels */}
                    <div className="relative z-10 w-full">
                      {colorGrades.map((grade) => {
                        const isActive = activeColor === grade
                        const leftPos = colorPositions[grade]
                        return (
                          <div
                            key={grade}
                            onMouseEnter={() => setHoveredColor(grade)}
                            onMouseLeave={() => setHoveredColor(null)}
                            onClick={() => setSelectedColor(grade)}
                            className="absolute flex flex-col items-center cursor-pointer group space-y-2 w-16"
                            style={{
                              left: `${leftPos}%`,
                              transform: "translateX(-50%)",
                            }}
                          >
                            {/* 20px High Container Centered at 10px */}
                            <div className="w-5 h-5 flex items-center justify-center">
                              <div
                                className={`rounded-full bg-white transition-all duration-200 ${
                                  isActive
                                    ? "w-4 h-4 border-[2.5px] border-[#B58A44] ring-4 ring-[#B58A44]/20 shadow-sm"
                                    : "w-3.5 h-3.5 border-2 border-[#D8C7AA] group-hover:border-[#B58A44]"
                                }`}
                              />
                            </div>

                            {/* Text Label Centered Directly Below Dot */}
                            <span
                              className={`text-[10px] sm:text-[11px] text-center transition-colors tracking-tight font-medium ${
                                isActive
                                  ? "text-[#B58A44] font-bold"
                                  : "text-[#4A435D] group-hover:text-[#B58A44]"
                              }`}
                            >
                              {grade}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Compact Description Box */}
                  <div className="bg-[#FCFBF7] border border-[#E5D7BF] rounded-xl px-3 sm:px-4 py-1.5 text-center text-xs sm:text-sm shadow-2xs transition-all space-x-1 mt-1">
                    <span className="text-[#B58A44] font-bold">{activeColor}</span>
                    <span className="text-gray-400 font-light mx-1.5">-</span>
                    <span className="font-bold text-[#1C1335]">{colorDetails[activeColor]}</span>
                  </div>

                  {/* Cultura Recommended Note */}
                  <div className="pt-0.5 sm:pt-1">
                    <p className="text-xs sm:text-sm text-[#B58A44] font-semibold tracking-wide">
                      Cultura Recommended Cut - Good
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Carat Section */}
        <section className="pt-5 sm:pt-8 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start">
            {/* Left Column (Title + Text + Hint) */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-xl font-sans font-medium text-[#1C1335]">
                4. Carat
              </h3>
              <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                A carat (not karat or worse, carrot) is measured based on the weight of the diamond. Two diamonds of equal carat will have different prices, depending on the other 3 Cs you go with. It's quite simple, really. Your ideal carat depends on: How big you want your stone and obviously, your budget. (Can insert image of stone sizes. For ex:
              </p>

              <div className="space-y-1.5 pt-1 sm:pt-2">
                <span className="text-[#B58A44] font-semibold text-xs sm:text-sm block">
                  Cultura Hint:
                </span>
                <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                  Save big bucks by picking a 0.90 carat over a 1 carat diamond. Thank us later :D
                </p>
              </div>
            </div>

            {/* Right Graphic - Enlarged Image with Tight Vertical Spacing */}
            <div className="space-y-2 bg-white p-0 sm:p-4 rounded-none overflow-visible">
              <div className="space-y-1 w-full max-w-[545px] lg:w-[545px] mx-auto px-1 sm:px-2">
                <div className="relative w-full aspect-[2.6/1] sm:aspect-[2.8/1] mx-auto overflow-hidden">
                  <Image
                    src="https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/carat.png?updatedAt=1785150571448"
                    alt="Diamond Carat Size Comparison Chart 0.50ct to 5.00ct"
                    fill
                    sizes="545px"
                    className="object-contain object-center scale-105"
                    priority
                  />
                </div>

                <div className="pt-0.5 sm:pt-1 text-center">
                  <p className="text-xs sm:text-sm text-[#B58A44] font-semibold tracking-wide">
                    Cultura Recommended - As big as you want!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Shop by Diamond Shapes Banner Box - 3 Columns on Mobile */}
        <section className="pt-5 sm:pt-8 border-t border-gray-100">
          <div className="bg-[#FAF6F0] rounded-2xl py-6 sm:py-10 px-4 sm:px-10 text-center space-y-6 sm:space-y-8 shadow-2xs">
            <h3 className="text-lg sm:text-2xl font-sans font-medium text-[#1C1335]">
              Shop by Diamond Shapes
            </h3>

            {/* 7 Diamond Shapes Grid - 3 Columns on Mobile */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4 sm:gap-6 items-center justify-center max-w-4xl mx-auto">
              {diamondShapes.map((shape) => (
                <div
                  key={shape.name}
                  className="flex flex-col items-center justify-center space-y-2 cursor-default select-none"
                >
                  <div className="relative w-10 h-10 sm:w-14 sm:h-14">
                    <Image
                      src={shape.image}
                      alt={`${shape.label} Diamond Shape`}
                      fill
                      sizes="(max-width: 640px) 40px, 56px"
                      className="object-contain"
                    />
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-[#5A5268]">
                    {shape.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Shape & Diamond Grading 2-Column Info */}
        <section className="pt-4 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start">
            {/* Shape Description */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-2xl font-sans font-medium text-[#1C1335]">
                Shape
              </h3>
              <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                Shape refers to the overall outline of the diamond when viewed from the top and that determines the price as well. The most expensive shape is the round diamond. That's because they are best at reflecting light and shine like there's no tomorrow! Although the choice of the shape mostly depends on your personal style, a princess, cushion or heart cut is what we would recommend if your diamond is bigger than 1 carat.
              </p>
            </div>

            {/* Diamond Grading Bullet Points */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-2xl font-sans font-medium text-[#1C1335]">
                Diamond Grading
              </h3>
              <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-[#3A334E] leading-relaxed list-disc pl-5">
                <li>
                  Say Hello to Halo! It makes the centre stone look bigger and works as a protective shield as well Go fancy with cushion and emerald cuts.
                </li>
                <li>They're usually priced lower and make 'em eyes pop, too!</li>
                <li>
                  Pick a diamond with an 'excellent' or 'ideal' cut and nothing less than that Although the round is the most expensive cut, it hides the imperfections and the yellowish colour in the best way. It's like a realllly good concealer ;)
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 7. Certifications Section */}
        <section className="pt-5 sm:pt-8 border-t border-gray-100 space-y-6 sm:space-y-8 text-center">
          <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
            <h3 className="text-lg sm:text-2xl font-sans font-medium text-[#1C1335]">
              3. Certifications
            </h3>
            <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
              The Certification is basically your diamond's birth certificate. All our solitaire diamonds are meticulously analyzed and graded by the Gemological Institute of America (GIA), Hoge Raadvoor Diamant (HRD) & the IGI, the most trusted (and known) labs in the world.
            </p>
          </div>

          {/* Certification Logos */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-16 pt-1">
            <div className="relative w-32 sm:w-44 h-14 sm:h-20">
              <Image
                src="https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/GIA.png?updatedAt=1785156475287"
                alt="GIA Gemological Institute of America Certification Logo"
                fill
                sizes="176px"
                className="object-contain"
              />
            </div>
            <div className="relative w-44 sm:w-60 h-14 sm:h-20">
              <Image
                src="https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/american-gem-society.png?updatedAt=1785156527019"
                alt="American Gem Society Member Logo"
                fill
                sizes="240px"
                className="object-contain"
              />
            </div>
          </div>
        </section>

        {/* 8. How to Care for Your Diamond Section */}
        <section className="pt-5 sm:pt-8 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-center">
            {/* Left Column: Image */}
            <div className="relative w-full aspect-[1.3/1] max-w-[500px] mx-auto overflow-hidden rounded-xl shadow-xs">
              <Image
                src="https://ik.imagekit.io/klyonjb5v/Diamond%20Buying%20Guide_%20Expert%20Tips%20&%20Advice%20_%20CaratLane/brushing-diamond.png?updatedAt=1785156562600"
                alt="Brushing and Cleaning Diamond Ring Jewellery Care"
                fill
                sizes="(max-width: 768px) 100vw, 500px"
                className="object-cover"
              />
            </div>

            {/* Right Column: Title + Bullet Points */}
            <div className="space-y-4 sm:space-y-5">
              <h3 className="text-lg sm:text-2xl font-sans font-medium text-[#1C1335]">
                How to Care for Your Diamond:
              </h3>
              <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-[#3A334E] leading-relaxed list-disc pl-5">
                <li>
                  Once every week, clean your diamond jewellery in lukewarm soap water and rub it down gently with a brush, to remove the dirt and grime from the surface and ensure a long lasting shine.
                </li>
                <li>
                  Remove your diamond jewellery when you go swimming or while doing household chores, so that the grime doesn't make your jewellery look dull.
                </li>
                <li>
                  Keep your jewellery in separate boxes to reduce the chances of scratches on the metal.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default DiamondGuideTemplate
