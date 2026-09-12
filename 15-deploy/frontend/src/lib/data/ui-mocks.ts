import { HttpTypes } from "@medusajs/types"

function mockCurrency(countryCode?: string) {
  const code = (countryCode || "in").toLowerCase()
  if (code === "us") return "usd"
  if (["dk", "fr", "de", "it", "es", "se", "gb"].includes(code)) return "eur"
  return "inr"
}

/** Local-only mock products so homepage UI can be built without Medusa/VPS. */
export function getMockHomeProducts(countryCode?: string): HttpTypes.StoreProduct[] {
  const currency = mockCurrency(countryCode)
  const mk = (
    id: string,
    handle: string,
    title: string,
    image: string,
    amount = 1299
  ): HttpTypes.StoreProduct =>
    ({
      id,
      handle,
      title,
      thumbnail: image,
      images: [{ id: `${id}_img`, url: image }],
      variants: [
        {
          id: `${id}_var`,
          title: "Default",
          calculated_price: {
            calculated_amount: amount,
            original_amount: amount,
            currency_code: currency,
            calculated_price: {
              price_list_type: null,
            },
          },
        },
      ],
    }) as unknown as HttpTypes.StoreProduct

  return [
    mk("mock_1", "auric-flow", "Auric Flow", "/hero/auric_flow.png", 1499),
    mk("mock_2", "infinite-glow", "Infinite Glow", "/hero/infinite_glow.png", 1299),
    mk("mock_3", "silver-chain", "Silver Chain Necklace", "/hero/auric_flow.png", 899),
    mk("mock_4", "pearl-box", "Pearl Keepsake", "/hero/infinite_glow.png", 1199),
    mk("mock_5", "celestique-ring", "Celestique Ring", "/hero/auric_flow.png", 1599),
    mk("mock_6", "moonlit-hoops", "Moonlit Hoops", "/hero/infinite_glow.png", 999),
  ]
}

export function getMockRegion(countryCode?: string): HttpTypes.StoreRegion {
  const currency = mockCurrency(countryCode)
  const code = (countryCode || "in").toLowerCase()
  return {
    id: `reg_${code}`,
    name: code.toUpperCase(),
    currency_code: currency,
    countries: [
      {
        id: code,
        iso_2: code,
        iso_3: code,
        num_code: "0",
        name: code.toUpperCase(),
        display_name: code.toUpperCase(),
      },
    ],
  } as HttpTypes.StoreRegion
}
