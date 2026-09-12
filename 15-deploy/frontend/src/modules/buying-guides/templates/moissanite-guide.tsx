"use client"

import React from "react"
import Image from "next/image"

const MoissaniteGuideTemplate = () => {
  const diamondVsMoissaniteRows = [
    { property: "Composition", moissanite: "Silicon carbide (SiC)", diamond: "Carbon (C)" },
    { property: "Brilliance & Fire", moissanite: "High, often more colorful", diamond: "Exceptionally high" },
    { property: "Hardness (Mohs scale)", moissanite: "9.25 (second only to diamond)", diamond: "10 (the hardest)" },
    { property: "Cost", moissanite: "Affordable", diamond: "Expensive" },
    { property: "Color Grading", moissanite: "Near colorless", diamond: "Colorless" },
    { property: "Clarity", moissanite: "Typically eye-clean", diamond: "Generally high clarity" },
    { property: "Origin", moissanite: "Lab-created and rare natural", diamond: "Mined from the Earth" },
    { property: "Ethical & Environmental", moissanite: "Ethical and eco-friendly", diamond: "Environmental concerns" },
    { property: "Durability", moissanite: "Very durable", diamond: "Extremely durable" },
    { property: "Rarity", moissanite: "Relatively abundant", diamond: "Rarest natural gemstone" },
  ]

  const czVsMoissaniteRows = [
    { property: "Composition", moissanite: "Silicon carbide (SiC)", cz: "Zirconium dioxide (ZrO2)" },
    { property: "Brilliance & Fire", moissanite: "High, often more colorful", cz: "High" },
    { property: "Hardness (Mohs scale)", moissanite: "9.25 (second only to diamond)", cz: "8-8.5" },
    { property: "Cost", moissanite: "Affordable", cz: "Cheap" },
    { property: "Color Grading", moissanite: "Near colorless", cz: "Can have color" },
    { property: "Clarity", moissanite: "Typically eye-clean", cz: "Varies" },
    { property: "Origin", moissanite: "Lab-created and rare natural", cz: "Lab-created" },
    { property: "Ethical & Environmental", moissanite: "Ethical and eco-friendly", cz: "Few environmental concerns" },
    { property: "Durability", moissanite: "Very durable", cz: "Durable" },
    { property: "Rarity", moissanite: "Relatively abundant", cz: "Common" },
  ]

  return (
    <div className="bg-[#FFFFFF] min-h-screen text-[#2D2D2D] font-sans antialiased">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10">
        
        {/* 1. Main Intro Text Paragraphs */}
        <section className="max-w-4xl mx-auto space-y-3.5 text-[#3A334E] text-xs sm:text-sm md:text-[15px] leading-relaxed font-normal">
          <p>
            Moissanite is a gemstone composed of silicon carbide (SiC) and is known for its exceptional brilliance, fire, and durability. It was first discovered in 1893 by French chemist Henri Moissan, who found microscopic particles of the gem in a meteorite crater in Arizona. Initially mistaken for diamonds, these crystals were later identified as silicon carbide.
          </p>
          <p>
            Due to its rarity in nature, moissanite available in the market today is primarily lab-created. Through a process of synthesis, scientists have been able to recreate and produce moissanite gemstones, making them more widely accessible.
          </p>
          <p>
            Moissanite is often used in jewelry as an alternative to diamonds. It has a similar appearance to diamonds but differs in terms of composition and properties. While diamonds are composed of carbon, moissanite is composed of silicon and carbon. Despite these differences, moissanite has gained popularity for its impressive sparkle and affordability compared to diamonds.
          </p>
        </section>

        {/* 2. Durability Feature Section */}
        <section className="text-center space-y-2.5 max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif font-medium text-[#1C1335] tracking-tight">
            Durability
          </h2>
          <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed max-w-2xl mx-auto">
            Moissanite is extremely durable, tough and second only to diamond in its resistance to scratching and abrasion. It scores a 9.25 on the Mohs Hardness Scale.
          </p>
          <div className="pt-2 flex justify-center">
            <div className="relative w-full max-w-[420px] aspect-[2.1/1]">
              <Image
                src="https://ik.imagekit.io/klyonjb5v/What%20is%20Moissanite%20One%20Carat/durability.png?updatedAt=1785157092353"
                alt="Moissanite Durability 9.25 Hardness Scale Diagram"
                fill
                sizes="420px"
                className="object-contain object-center scale-110"
                priority
              />
            </div>
          </div>
        </section>

        {/* 3. Brilliance Feature Section */}
        <section className="text-center space-y-2.5 max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif font-medium text-[#1C1335] tracking-tight">
            Brilliance
          </h2>
          <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed max-w-2xl mx-auto">
            The most dominant feature of moissanite is its brilliance. When we refer to the brilliance of moissanite, we're also referring to its sparkle. Known for its high refractive index of 2.65, moissanite is quantifiably the most brilliant gemstone on earth!
          </p>
          <div className="pt-2 flex justify-center">
            <div className="relative w-full max-w-[340px] aspect-[1.8/1]">
              <Image
                src="https://ik.imagekit.io/klyonjb5v/What%20is%20Moissanite%20One%20Carat/brilliance.png?updatedAt=1785157056479"
                alt="Moissanite Brilliance Refractive Index Diagram"
                fill
                sizes="340px"
                className="object-contain object-center scale-110"
                priority
              />
            </div>
          </div>
        </section>

        {/* 4. Fire (Dispersion) Feature Section */}
        <section className="text-center space-y-2.5 max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif font-medium text-[#1C1335] tracking-tight">
            Fire (Dispersion)
          </h2>
          <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed max-w-2xl mx-auto">
            One of the most distinguishable elements of a moissanite gemstone is its fire or dispersion. Dispersion is caused as light radiates through the gemstone on different wavelengths—each wavelength produces beautiful flashes of color throughout the gemstone.
          </p>
          <div className="pt-2 flex justify-center">
            <div className="relative w-full max-w-[340px] aspect-[1.8/1]">
              <Image
                src="https://ik.imagekit.io/klyonjb5v/What%20is%20Moissanite%20One%20Carat/dispersion.png?updatedAt=1785157017144"
                alt="Moissanite Fire Rainbow Color Dispersion Diagram"
                fill
                sizes="340px"
                className="object-contain object-center scale-110"
                priority
              />
            </div>
          </div>
        </section>

        {/* 5. Moissanite Vs Diamond Section */}
        <section className="space-y-4 pt-6 border-t border-gray-100">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C1335] tracking-tight">
              Moissanite Vs Diamond
            </h2>
            <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed max-w-4xl">
              Moissanite, composed of silicon carbide, offers remarkable brilliance and affordability, ranking at 9.25 on the Mohs scale. In contrast, diamonds, composed of pure carbon, are renowned for their exceptional brilliance, hardness (10 on the Mohs scale), and rarity, making them a symbol of luxury.
            </p>
          </div>

          {/* Clean Grid Table 1 with Visible Row & Column Lines */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-gray-300">
                  <th className="p-2.5 sm:p-3 font-bold text-[#1C1335] w-1/3 border-r border-gray-300">Property</th>
                  <th className="p-2.5 sm:p-3 font-bold text-[#1C1335] w-1/3 border-r border-gray-300">Moissanite</th>
                  <th className="p-2.5 sm:p-3 font-bold text-[#1C1335] w-1/3">Diamond</th>
                </tr>
              </thead>
              <tbody className="bg-white text-[#3A334E]">
                {diamondVsMoissaniteRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-300 last:border-b-0">
                    <td className="p-2.5 sm:p-3 font-semibold text-[#1C1335] border-r border-gray-300">{row.property}</td>
                    <td className="p-2.5 sm:p-3 border-r border-gray-300">{row.moissanite}</td>
                    <td className="p-2.5 sm:p-3">{row.diamond}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Moissanite Vs Cubic Zirconia Section */}
        <section className="space-y-4 pt-6 border-t border-gray-100">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C1335] tracking-tight">
              Moissanite Vs Cubic Zirconia
            </h2>
            <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed max-w-4xl">
              Moissanite, with its silicon carbide composition and high brilliance, stands as an affordable yet stunning choice for jewelry. Cubic Zirconia (CZ), made of zirconium dioxide, shares its brilliance but is more affordable, with a Mohs hardness typically ranging from 8 to 8.5, making it a popular and cost-effective alternative.
            </p>

            {/* FUN FACT Text Block */}
            <div className="pt-2 space-y-0.5">
              <h3 className="text-xs sm:text-sm font-bold text-[#1C1335] tracking-wide uppercase">
                FUN FACT
              </h3>
              <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed">
                Moissanites are much more heat resistant compared to most of the other gemstones in the world. It can withstand upto 2000 degrees celsius!
              </p>
            </div>
          </div>

          {/* Clean Grid Table 2 with Visible Row & Column Lines */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-gray-300">
                  <th className="p-2.5 sm:p-3 font-bold text-[#1C1335] w-1/3 border-r border-gray-300">Property</th>
                  <th className="p-2.5 sm:p-3 font-bold text-[#1C1335] w-1/3 border-r border-gray-300">Moissanite</th>
                  <th className="p-2.5 sm:p-3 font-bold text-[#1C1335] w-1/3">Cubic Zirconia</th>
                </tr>
              </thead>
              <tbody className="bg-white text-[#3A334E]">
                {czVsMoissaniteRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-300 last:border-b-0">
                    <td className="p-2.5 sm:p-3 font-semibold text-[#1C1335] border-r border-gray-300">{row.property}</td>
                    <td className="p-2.5 sm:p-3 border-r border-gray-300">{row.moissanite}</td>
                    <td className="p-2.5 sm:p-3">{row.cz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 7. Should I Buy Moissanite? Section */}
        <section className="space-y-2 pt-6 border-t border-gray-100">
          <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C1335] tracking-tight">
            Should I Buy Moissanite?
          </h2>
          <p className="text-xs sm:text-sm text-[#3A334E] leading-relaxed max-w-4xl">
            Whether you should buy moissanite depends on your preferences and budget. Moissanite offers an affordable and ethical alternative to diamonds without compromising on beauty and durability. It's a great choice for engagement rings, jewelry, and gifts.
          </p>
        </section>

      </div>
    </div>
  )
}

export default MoissaniteGuideTemplate
