/** Huella SHA-256 del archivo, en hexadecimal. Sirve para probar de qué Excel salió el informe. */
export async function sha256(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
