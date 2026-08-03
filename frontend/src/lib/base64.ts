/**
 * Base64 bridging for terminal traffic. PTY bytes are not necessarily valid
 * UTF-8 on their own, so the Go side base64-encodes them and we decode here.
 */

/** Decodes base64 terminal output into a string. */
export function decodeBase64(data: string): string {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Encodes terminal input as base64 for the Go bridge. */
export function encodeBase64(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}
