import { readFileSync } from 'node:fs';

// The PWA manifest and its icons (ARCHITECTURE 2.8, ADR-10).
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));

// Width and height from a PNG file's IHDR chunk.
function pngSize(path: string) {
  const data = readFileSync(path);
  expect(data.subarray(1, 4).toString('ascii')).toBe('PNG');
  return `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`;
}

describe('web app manifest', () => {
  it('has the fields Chrome needs to install the app', () => {
    expect(manifest).toMatchObject({
      name: expect.any(String),
      short_name: expect.any(String),
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: 'he',
      dir: 'rtl',
      theme_color: '#2F80ED',
      background_color: '#EAF6FF',
    });
  });

  it('lists 192 and 512 icons, including a maskable one, that exist in the declared sizes', () => {
    const icons: { src: string; sizes: string; purpose: string }[] = manifest.icons;
    expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of icons) {
      expect(pngSize(`public${icon.src}`)).toBe(icon.sizes);
    }
  });
});
