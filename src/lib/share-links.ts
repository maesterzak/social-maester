// "Share myself" mode: which page to open per platform, with as much prefilled as the platform allows.
// Pure (no server imports) so the campaign page can use it in the browser.

export type ShareTarget = {
  url: string
  /** Text is already in the opened page; otherwise the caption must be pasted. */
  prefilled: boolean
  /** Which file to attach by hand (none of these share pages accept a file). */
  attach: "image" | "video"
  hint: string
}

const enc = encodeURIComponent

export function shareTarget(platform: string, caption: string, link: string | null): ShareTarget {
  switch (platform) {
    case "x":
      return { url: `https://x.com/intent/post?text=${enc(caption)}`, prefilled: true, attach: "image",
        hint: "Text is filled in. Paste the picture (Ctrl+V) or attach it, then Post." }
    case "linkedin":
      return { url: `https://www.linkedin.com/feed/?shareActive=true&text=${enc(caption)}`, prefilled: true, attach: "image",
        hint: "Text is filled in. Add the picture with the image button (or paste it), then Post." }
    case "telegram":
      // t.me/share needs a url; keep the link out of the text so it isn't shown twice.
      return link
        ? { url: `https://t.me/share/url?url=${enc(link)}&text=${enc(caption.replace(link, "").trim())}`, prefilled: true, attach: "image",
            hint: "Pick your channel. Text and link are filled in; paste the picture if you want it." }
        : { url: `https://t.me/share/url?url=${enc(caption)}`, prefilled: true, attach: "image", hint: "Pick your channel, then Send." }
    case "whatsapp":
      return { url: `https://wa.me/?text=${enc(caption)}`, prefilled: true, attach: "image",
        hint: "Pick a chat or group. To post as a Status, use your phone with the downloaded picture." }
    case "facebook":
      // Facebook doesn't allow prefilled text; sharing the link shows its preview card.
      return { url: link ? `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}` : "https://www.facebook.com/", prefilled: false, attach: "image",
        hint: "Facebook won't take ready-made text: Open copies the caption, paste it (Ctrl+V), choose “Share to a Page”, then Post." }
    case "instagram":
      return { url: "https://www.instagram.com/", prefilled: false, attach: "video",
        hint: "Open copies the caption and downloads the video. Click Create (+) → upload it as a Reel, paste the caption, Share." }
    case "tiktok":
      return { url: "https://www.tiktok.com/tiktokstudio/upload", prefilled: false, attach: "video",
        hint: "Open copies the caption and downloads the video. Upload that video, paste the caption, Post." }
    case "youtube":
      return { url: "https://www.youtube.com/upload", prefilled: false, attach: "video",
        hint: "Open copies the caption and downloads the video. Upload it (a vertical video becomes a Short), paste the caption as the description, Publish." }
    default:
      return { url: "about:blank", prefilled: false, attach: "image", hint: "" }
  }
}
