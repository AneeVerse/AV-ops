export interface RestrictedPage {
  key: string
  label: string
  route: string
}

// Non-admin pages that are only available to specific brands. Which brands
// get which page is configured by admins in /brand-access (table
// brand_page_access), not hardcoded here.
export const RESTRICTED_PAGES: RestrictedPage[] = [
  { key: 'generate-broker', label: 'Stock Imagery', route: '/generate-broker' },
  { key: 'carousel-v2', label: 'Blog to Carousel', route: '/carousel-v2' },
  { key: 'ad-concept-generator', label: 'Ad Concepts', route: '/ad-concept-generator' },
  { key: 'generate-banner', label: 'Multi-size Ads', route: '/generate-banner' },
  { key: 'map-graphics', label: 'Map Graphics', route: '/map-graphics' },
  { key: 'infographic-generator', label: 'Motion Infographics', route: '/infographic-generator' },
  { key: 'pdf-to-ppt', label: 'PDF to PPT', route: '/pdf-to-ppt' },
  { key: 'generate-illustrations', label: 'Illustrations', route: '/generate-illustrations' },
  { key: 'blog-images', label: 'Blog Images', route: '/blog-images' },
  { key: 'ui-walkthrough', label: 'UI Walkthrough', route: '/ui-walkthrough' },
]
