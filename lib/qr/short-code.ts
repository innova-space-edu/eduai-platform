const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function createShortCode(length = 8): string {
  let result = ""
  for (let index = 0; index < length; index += 1) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return result
}
