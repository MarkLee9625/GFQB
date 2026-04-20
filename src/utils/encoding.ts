export function decodeB64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createImageHtml(src: string): string {
  return `<div style="width: 100%; max-width: 100%; overflow: hidden; box-sizing: border-box; text-align: center; display: block;"><img src="${src}" style="width: 100% !important; max-width: 100% !important; height: auto !important; display: block; margin: 0 auto; object-fit: contain;" class="max-w-full h-auto object-contain" /></div><p><br/></p>`;
}
