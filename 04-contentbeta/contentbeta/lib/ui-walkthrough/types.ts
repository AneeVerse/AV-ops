export interface WalkthroughScreenInput {
  storagePath: string
  order: number
  narration: string
}

export interface WalkthroughScene {
  order: number
  /** Original uploaded screenshot — kept for review-step comparison, not used in the final stitched code. */
  imageUrl: string
  /**
   * AI-recreated HTML/CSS/JS structure for this screen — this is what actually renders
   * in the final walkthrough. Interactive elements are marked inline with a data-uiw
   * attribute ("click" or "type:SHORT TEXT") — see lib/ui-walkthrough/recreate-screen.ts.
   * The stitch engine finds them live in the rendered DOM at playback time (see
   * lib/ui-walkthrough/stitch-engine.ts); there's no separate coordinates list.
   */
  recreatedHtml: string
  narration: string
}

export interface StitchResult {
  code: string
}

export interface UiWalkthroughGenerateResponse {
  jobId: string
  code: string
}
