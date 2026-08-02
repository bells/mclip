import { useEffect, useState } from "react";

import { getImageBase64 } from "../services/ipc/commands";
import {
  resolveImageDataUrl,
  type ImageDataUrlState,
} from "../utils/imageDataUrl";

export function useImageDataUrl(imagePath: string | null): ImageDataUrlState {
  const [state, setState] = useState<ImageDataUrlState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    if (imagePath === null) {
      setState({ status: "idle" });
      return () => {
        cancelled = true;
      };
    }

    setState({ status: "loading" });

    void resolveImageDataUrl(
      imagePath,
      getImageBase64,
      () => cancelled,
    ).then((nextState) => {
      if (nextState !== null) {
        setState(nextState);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  return state;
}
