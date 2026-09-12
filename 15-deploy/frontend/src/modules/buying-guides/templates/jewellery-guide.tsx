"use client"

import React, { useRef } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const JewelleryGuideTemplate = () => {
  const ringsScrollRef = useRef<HTMLDivElement>(null)
  const earringsScrollRef = useRef<HTMLDivElement>(null)
  const braceletsScrollRef = useRef<HTMLDivElement>(null)

  const scroll = (ref: React.RefObject<HTMLDivElement>, direction: "left" | "right") => {
    if (ref.current) {
      const scrollAmount = direction === "left" ? -300 : 300
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
    }
  }

  return (
    <div className="bg-[#FFFFFF] min-h-screen text-[#2D2D2D] font-sans antialiased">
      {/* 1. Top Banner Image & Hero Section */}
      <section className="w-full">
        {/* Banner Image Container */}
        <div className="w-full bg-white flex justify-center py-4 sm:py-6">
          <div className="relative w-full max-w-[684px] aspect-[2.97/1]">
            <Image
              src="https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/imgi_1_3c1194b2df314b05b8e2d862b7a7b5c9.png?updatedAt=1785138590247"
              alt="Jewellery Buying Guide Woven Square Studs Banner"
              fill
              sizes="(max-width: 1024px) 100vw, 684px"
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Cream Background Title Box */}
        <div className="bg-[#FAF5EC] py-12 px-4 sm:px-6 lg:px-8 text-center border-b border-gray-100">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-[42px] font-sans font-bold text-[#1C1335] tracking-tight">
              Jewellery Buying Guide
            </h1>
            <p className="text-[#3A334E] text-sm sm:text-base leading-relaxed max-w-3xl mx-auto font-normal">
              Having the right pieces of jewellery can take your simple look to a gorgeous statement look. Whether you love a traditional or classic style, if you prefer rose gold or gold or perhaps even a combination of the two, never be afraid to try something new. Jewellery always lets you accessorise with confidence and express your style. There are various categories of jewellery made with different types of metals that have unique personalities of their own, and we bet we can find something that best suits yours.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-20">
        {/* 2. Section 1: Pick the Right Metal */}
        <section className="space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#1C1335]">
              1. Pick the Right Metal
            </h2>
            
            {/* Quadrant Ring Graphic (imgi_2) */}
            <div className="relative w-full max-w-[420px] mx-auto aspect-[1.3/1] py-4">
              <Image
                src="https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/imgi_2_4096578041a141439ad45d9140df9b85.png?updatedAt=1785138589992"
                alt="White Gold, Rose Gold, Yellow Gold, Platinum Quadrant Ring Diagram"
                fill
                sizes="420px"
                className="object-contain"
              />
            </div>
          </div>

          {/* 2x2 Grid of Metal Descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12 max-w-4xl mx-auto pt-4">
            <div className="space-y-3">
              <h3 className="text-xl font-sans font-semibold text-[#1C1335]">White Gold</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                White gold is an alloy of gold. This means that it is made up of pure yellow gold, mixed with alloy metals that have a silvery-white colour, such as palladium and silver. Its neutral colour and durability make it the perfect setting for all gemstones. It looks beautiful and classic, suiting all outfits and events.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-sans font-semibold text-[#1C1335]">Rose Gold</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Rose gold is a gorgeous blend of gold with a small percentage of copper which adds strength and durability. It's basically gold with a hint of pretty and has been trending a lot recently.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-sans font-semibold text-[#1C1335]">Yellow Gold</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Yellow gold is the all natural version of gold. It's our favourite choice for all things wedding! It's super pleasing to the eye and complements most skin tones. Diamonds mounted on gold bands are what "happily ever after's" are made up of.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-sans font-semibold text-[#1C1335]">Platinum</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Platinum is a sturdy white toned metal. It's an exquisite metal and rarer than gold! Do you know what's great about Platinum? It's low maintenance!
              </p>
            </div>
          </div>
        </section>

        {/* 3. Section 2: Choose Your Diamond or Gemstone */}
        <section className="space-y-8 pt-6">
          <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#1C1335] text-center">
            2. Choose Your Diamond or Gemstone
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Diamond Selection Card (imgi_3) */}
            <div className="bg-[#FAF5EE] text-center overflow-hidden rounded-none w-full flex flex-col justify-between relative shadow-xs border border-gray-100/30">
              <div className="relative w-full aspect-square overflow-hidden bg-[#FAF5EE]">
                <Image
                  src="https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/imgi_3_9e8b78d7a86445518b1052c24dd283fd.png?updatedAt=1785138590245"
                  alt="Diamond Selection Solitaire Ring"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-contain object-top"
                />
              </div>
              <div className="relative z-10 -mt-20 sm:-mt-24 pb-7 pt-2 space-y-1.5 px-4 bg-gradient-to-t from-[#FAF5EE] via-[#FAF5EE]/95 to-transparent">
                <h3 className="text-xl sm:text-[22px] font-sans font-bold text-[#1C1335]">
                  Diamond Selection
                </h3>
                <p className="text-xs sm:text-sm text-[#5B556E] font-normal">
                  Become a diamond expert in under 5 minutes
                </p>
                <div className="pt-2">
                  <LocalizedClientLink
                    href="/diamond-buying-guide"
                    className="text-[#E75B9E] hover:text-[#C73B7E] font-medium text-xs sm:text-sm tracking-wide transition-colors"
                  >
                    Learn About Diamond &gt;
                  </LocalizedClientLink>
                </div>
              </div>
            </div>

            {/* Gemstone Selection Card (imgi_4) */}
            <div className="bg-[#F8F1F1] text-center overflow-hidden rounded-none w-full flex flex-col justify-between relative shadow-xs border border-gray-100/30">
              <div className="relative w-full aspect-square overflow-hidden bg-[#F8F1F1]">
                <Image
                  src="https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/imgi_4_46d81a4dbf5c472cac493bc4412026b8.png?updatedAt=1785138589941"
                  alt="Gemstone Selection Sapphire Pendant"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-contain object-top"
                />
              </div>
              <div className="relative z-10 -mt-20 sm:-mt-24 pb-7 pt-2 space-y-1.5 px-4 bg-gradient-to-t from-[#F8F1F1] via-[#F8F1F1]/95 to-transparent">
                <h3 className="text-xl sm:text-[22px] font-sans font-bold text-[#1C1335]">
                  Gemstone Selection
                </h3>
                <p className="text-xs sm:text-sm text-[#5B556E] font-normal">
                  So many colours to know about and choose from
                </p>
                <div className="pt-2">
                  <LocalizedClientLink
                    href="/what-is-moissanite"
                    className="text-[#E75B9E] hover:text-[#C73B7E] font-medium text-xs sm:text-sm tracking-wide transition-colors"
                  >
                    Learn About Gemstones &gt;
                  </LocalizedClientLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Section 3: Rings Carousel */}
        <section className="space-y-6 pt-6">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#1C1335]">Rings</h2>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              For rings the more, the merrier. Multiple and stacked rings are grouped together and worn on different fingers for a nice style statement.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <span className="text-[#8870CF] font-medium block">Cultura Style Tip:</span>
              <p>Let your personality shine through your rings by mixing a variety of colours & designs. The rainbow awaits...minus the unicorns though ;)</p>
            </div>
          </div>

          <div className="relative w-full">
            <div
              ref={ringsScrollRef}
              className="flex items-center gap-8 overflow-x-auto no-scrollbar py-6 px-2 scroll-smooth"
            >
              {[
                { name: "ENGAGEMENT", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/engagement-ring.jpg?updatedAt=1785142266036" },
                { name: "BRIDAL SET", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/bridal-set-ring.jpg?updatedAt=1785142356239" },
                { name: "CASUAL", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/casual-ring.jpg?updatedAt=1785142400255" },
                { name: "PLATINUM COUPLE", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/platinum-couple-ring.jpg?updatedAt=1785142455940" },
                { name: "COCKTAIL", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/cocktail-ring.jpg?updatedAt=1785142530438" },
                { name: "BANDS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/bands-ring.png?updatedAt=1785142588617" },
                { name: "FLEXI RINGS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/flexi-rings-ring.jpg?updatedAt=1785142628497" },
                { name: "TRENDY", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/trendy-ring.jpg?updatedAt=1785142681719" },
              ].map((item, idx) => (
                <LocalizedClientLink
                  key={idx}
                  href="/store?category=rings"
                  className="flex-shrink-0 w-32 text-center space-y-3 group"
                >
                  <div className="relative w-full aspect-square flex items-center justify-center p-2">
                    <Image src={item.img} alt={item.name} fill sizes="130px" className="object-contain group-hover:scale-105 transition-transform" />
                  </div>
                  <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider leading-tight">{item.name}</span>
                </LocalizedClientLink>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full pt-2">
              <button
                onClick={() => scroll(ringsScrollRef, "left")}
                className="text-gray-400 hover:text-gray-700 text-xs px-1"
                aria-label="Previous"
              >
                ◀
              </button>
              <div className="flex-1 h-1 bg-gray-300 rounded-full" />
              <button
                onClick={() => scroll(ringsScrollRef, "right")}
                className="text-gray-400 hover:text-gray-700 text-xs px-1"
                aria-label="Next"
              >
                ▶
              </button>
            </div>
          </div>
        </section>

        {/* 5. Section 4: Earrings Carousel */}
        <section className="space-y-6 pt-6">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#1C1335]">Earrings</h2>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              From understated studs to traditional jhumkas, find the right earrings to match your outfit and occasion.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <span className="text-[#8870CF] font-medium block">Cultura Style Tip:</span>
              <p>Underscore your personal style with earrings. Mix and match for distinct ear stacks.</p>
            </div>
          </div>

          <div className="relative w-full">
            <div
              ref={earringsScrollRef}
              className="flex items-center gap-8 overflow-x-auto no-scrollbar py-6 px-2 scroll-smooth"
            >
              {[
                { name: "STUDS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/studs-earring.jpg?updatedAt=1785142774794" },
                { name: "JHUMKAS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/jhumkas-earring.jpg?updatedAt=1785142828289" },
                { name: "EAR CUFFS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/earcuffs-earring.jpg?updatedAt=1785142939914" },
                { name: "HOOPS AND HUGGIES", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/hoops-and-huggies-earring.jpg?updatedAt=1785142987751" },
                { name: "SUISDHAGA", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/suidhaga.jpg?updatedAt=1785143035194" },
                { name: "PEARL EARRINGS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/pearl-earrings-earring.jpg?updatedAt=1785143087454" },
                { name: "MULTI-PIERCED", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/multi-pierced-earring.jpg?updatedAt=1785143134972" },
              ].map((item, idx) => (
                <LocalizedClientLink
                  key={idx}
                  href="/store?category=earrings"
                  className="flex-shrink-0 w-32 text-center space-y-3 group"
                >
                  <div className="relative w-full aspect-square flex items-center justify-center p-2">
                    <Image src={item.img} alt={item.name} fill sizes="130px" className="object-contain group-hover:scale-105 transition-transform" />
                  </div>
                  <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider leading-tight">{item.name}</span>
                </LocalizedClientLink>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full pt-2">
              <button
                onClick={() => scroll(earringsScrollRef, "left")}
                className="text-gray-400 hover:text-gray-700 text-xs px-1"
                aria-label="Previous"
              >
                ◀
              </button>
              <div className="flex-1 h-1 bg-gray-300 rounded-full" />
              <button
                onClick={() => scroll(earringsScrollRef, "right")}
                className="text-gray-400 hover:text-gray-700 text-xs px-1"
                aria-label="Next"
              >
                ▶
              </button>
            </div>
          </div>
        </section>

        {/* 6. Section 5: Bracelets Carousel (Exact 5 Items) */}
        <section className="space-y-6 pt-6">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#1C1335]">Bracelets</h2>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              From casual tennis bracelets to sleek cuffs, choose a bracelet that complements your wrist and daily wear.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <span className="text-[#8870CF] font-medium block">Cultura Style Tip:</span>
              <p>Stack delicate bracelets or pair a bold cuff statement with your watch.</p>
            </div>
          </div>

          <div className="relative w-full">
            <div
              ref={braceletsScrollRef}
              className="flex items-center gap-8 overflow-x-auto no-scrollbar py-6 px-2 scroll-smooth"
            >
              {[
                { name: "CHAIN BRACELETS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/chain-bracelets-bracelet.jpg?updatedAt=1785143283371" },
                { name: "OVAL BRACELETS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/oval-bracelets-bracelet.jpg?updatedAt=1785143326441" },
                { name: "FLEXIBLE BRACELETS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/flexible-bracelets-bracelet.png?updatedAt=1785143381562" },
                { name: "MANGALSUTRA BRACELETS", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/mangalsutra-bracelets-bracelet.jpg?updatedAt=1785143425557" },
                { name: "LIGHTWEAR BANGLES", img: "https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/lightwear-bangles-bracelet.jpg?updatedAt=1785143469676" },
              ].map((item, idx) => (
                <LocalizedClientLink
                  key={idx}
                  href="/store?category=bracelets"
                  className="flex-shrink-0 w-32 text-center space-y-3 group"
                >
                  <div className="relative w-full aspect-square flex items-center justify-center p-2">
                    <Image src={item.img} alt={item.name} fill sizes="130px" className="object-contain group-hover:scale-105 transition-transform" />
                  </div>
                  <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider leading-tight">{item.name}</span>
                </LocalizedClientLink>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full pt-2">
              <button
                onClick={() => scroll(braceletsScrollRef, "left")}
                className="text-gray-400 hover:text-gray-700 text-xs px-1"
                aria-label="Previous"
              >
                ◀
              </button>
              <div className="flex-1 h-1 bg-gray-300 rounded-full" />
              <button
                onClick={() => scroll(braceletsScrollRef, "right")}
                className="text-gray-400 hover:text-gray-700 text-xs px-1"
                aria-label="Next"
              >
                ▶
              </button>
            </div>
          </div>
        </section>

        {/* 7. Section 6: Jewellery Care */}
        <section className="pt-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center max-w-4xl mx-auto">
            <div className="relative w-full aspect-[4/3] rounded-none overflow-hidden">
              <Image
                src="https://ik.imagekit.io/klyonjb5v/Jewellery%20Buying%20Guide%20for%20Women%20&%20Men/imgi_25_12fd1c50316c4cccaec55e189f78481e.png?updatedAt=1785138590530"
                alt="Jewellery Care Toothbrush Soft Cleaning"
                fill
                sizes="(max-width: 768px) 100vw, 450px"
                className="object-cover"
              />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#1C1335]">
                Jewellery Care
              </h2>
              <ul className="space-y-2.5 text-xs sm:text-sm text-gray-700 leading-relaxed list-disc pl-4">
                <li>Remove before swimming or bath.</li>
                <li>Apply lotion and perfume before wearing your jewellery.</li>
                <li>Store each piece separately in a soft pouch or fabric box.</li>
                <li>Clean gently with warm water, mild soap, and a soft toothbrush.</li>
                <li>Get annual professional inspections to secure prongs and stones.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default JewelleryGuideTemplate
