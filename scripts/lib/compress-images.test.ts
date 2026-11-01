import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { compressImages } from "./compress-images";
import type { PackAsset } from "./docpack-v3";

/** Soft gradients: PNG stores these badly, so WebP always wins. */
async function photo(format: "png" | "jpeg"): Promise<Buffer> {
  const pixels = Buffer.alloc(300 * 200 * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 7 + (i % 299) * 3 + (i % 97) * 11) & 255;
  return sharp(pixels, { raw: { width: 300, height: 200, channels: 3 } })[format]().toBuffer();
}

const asset = (bytes: Buffer, mime: string): PackAsset => ({ bytes, mime });

describe("compressImages", () => {
  test("turns PNG and JPEG into smaller WebP under the same routes", async () => {
    const png = await photo("png");
    const jpeg = await photo("jpeg");
    const assets = new Map([
      ["/a.png", asset(png, "image/png")],
      ["/b.jpg", asset(jpeg, "image/jpeg")],
    ]);
    const report = await compressImages(assets);

    expect(report.converted).toBe(2);
    expect(report.bytesAfter).toBeLessThan(report.bytesBefore);
    for (const route of ["/a.png", "/b.jpg"]) {
      const out = assets.get(route)!;
      expect(out.mime).toBe("image/webp");
      expect((await sharp(out.bytes).metadata()).format).toBe("webp");
      expect((await sharp(out.bytes).metadata()).width).toBe(300);
    }
  });

  test("keeps transparency", async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 200, g: 10, b: 10, alpha: 0.5 } } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const assets = new Map([["/a.png", asset(png, "image/png")]]);
    await compressImages(assets);
    expect((await sharp(assets.get("/a.png")!.bytes).metadata()).hasAlpha).toBe(true);
  });

  test("gives a repeated image the same bytes on every route", async () => {
    const png = await photo("png");
    const assets = new Map([
      ["/a.png", asset(png, "image/png")],
      ["/__docx_assets/a.png", asset(Buffer.from(png), "image/png")],
    ]);
    const report = await compressImages(assets);
    expect(report.converted).toBe(1);
    expect(assets.get("/a.png")!.bytes).toBe(assets.get("/__docx_assets/a.png")!.bytes);
  });

  test("is deterministic, so an unchanged image stays one chunk across builds", async () => {
    const png = await photo("png");
    const first = new Map([["/a.png", asset(png, "image/png")]]);
    const second = new Map([["/a.png", asset(Buffer.from(png), "image/png")]]);
    await compressImages(first);
    await compressImages(second);
    expect(first.get("/a.png")!.bytes.equals(second.get("/a.png")!.bytes)).toBe(true);
  });

  test("leaves alone what it must not touch", async () => {
    const png = await photo("png");
    const animated = Buffer.concat([png.subarray(0, 33), Buffer.from("acTL", "latin1"), png.subarray(33)]);
    const corrupt = Buffer.from("not an image at all");
    const assets = new Map([
      ["/animated.png", asset(animated, "image/png")],
      ["/corrupt.png", asset(corrupt, "image/png")],
      ["/page.gif", asset(Buffer.from("GIF89a"), "image/gif")],
    ]);
    const report = await compressImages(assets);

    expect(report.converted).toBe(0);
    expect(assets.get("/animated.png")!.bytes).toBe(animated);
    expect(assets.get("/corrupt.png")!.bytes).toBe(corrupt);
    expect(assets.get("/page.gif")!.mime).toBe("image/gif");
  });
});
