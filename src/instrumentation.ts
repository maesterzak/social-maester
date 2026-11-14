export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { recover, kick } = await import("./lib/worker")
  recover()
  kick()
}
