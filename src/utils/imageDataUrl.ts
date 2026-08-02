export type ImageDataUrlState =
  | { status: "idle" }
  | { status: "loading" }
  | { src: string; status: "ready" }
  | { status: "error" };

export type ReadImageBase64 = (imagePath: string) => Promise<string>;

export async function resolveImageDataUrl(
  imagePath: string,
  readImageBase64: ReadImageBase64,
  isCancelled: () => boolean,
): Promise<ImageDataUrlState | null> {
  try {
    const base64 = await readImageBase64(imagePath);

    if (isCancelled()) {
      return null;
    }

    return {
      src: `data:image/png;base64,${base64}`,
      status: "ready",
    };
  } catch {
    return isCancelled() ? null : { status: "error" };
  }
}
