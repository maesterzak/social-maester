// Caption length as each platform counts it. Pure, so the composer can use it in the browser too.

/** X counts URLs as 23 and most emoji/CJK as 2. */
export function xLength(s: string): number {
  const noUrls = s.replace(/https?:\/\/\S+/g, "x".repeat(23))
  let n = 0
  for (const ch of noUrls) n += /\p{Extended_Pictographic}/u.test(ch) ? 2 : ch.codePointAt(0)! > 0x10ff ? 2 : 1
  return n
}

export function captionLength(platformId: string, s: string): number {
  return platformId === "x" ? xLength(s) : [...s].length
}
