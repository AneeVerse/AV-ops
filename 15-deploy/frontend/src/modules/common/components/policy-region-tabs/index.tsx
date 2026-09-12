"use client"

interface PolicyRegionTabsProps {
  indiaContent: React.ReactNode
  internationalContent: React.ReactNode
  defaultRegion?: "india" | "international"
  countryCode?: string
}

export default function PolicyRegionTabs({
  indiaContent,
  internationalContent,
  defaultRegion,
  countryCode,
}: PolicyRegionTabsProps) {
  const isIndia = countryCode
    ? countryCode.toLowerCase() === "in"
    : defaultRegion === "india"

  return (
    <div className="w-full">
      {isIndia ? (
        <div>{indiaContent}</div>
      ) : (
        <div>{internationalContent}</div>
      )}
    </div>
  )
}
