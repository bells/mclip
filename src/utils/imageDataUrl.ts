export type ImageDataUrlState =
  | { status: "idle" }
  | { status: "loading" }
  | { src: string; status: "ready" }
  | { status: "error" };

export type ReadImageBase64 = (imagePath: string) => Promise<string>;

export type ImageReadPromiseRegistry = {
  pendingCount: () => number;
  read: (imagePath: string, readImageBase64: ReadImageBase64) => Promise<string>;
};

export function createImageReadPromiseRegistry(): ImageReadPromiseRegistry {
  const pendingReads = new Map<string, Promise<string>>();

  return {
    pendingCount: () => pendingReads.size,
    read(imagePath, readImageBase64) {
      const existing = pendingReads.get(imagePath);
      if (existing) {
        return existing;
      }

      const pending = readImageBase64(imagePath);
      pendingReads.set(imagePath, pending);
      void pending
        .finally(() => {
          if (pendingReads.get(imagePath) === pending) {
            pendingReads.delete(imagePath);
          }
        })
        .catch(() => undefined);
      return pending;
    },
  };
}

const imageReadPromiseRegistry = createImageReadPromiseRegistry();

export function readImageBase64Shared(
  imagePath: string,
  readImageBase64: ReadImageBase64,
) {
  return imageReadPromiseRegistry.read(imagePath, readImageBase64);
}

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
