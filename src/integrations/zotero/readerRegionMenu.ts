import { config } from "../../../package.json";
import { getString } from "../../app/localization";
import {
  copyRegionImage,
  getImageAnnotationTarget,
  RegionAskError,
  type RegionAnnotationTarget,
} from "./ZoteroAnnotationService";
import { createLogger } from "../../runtime/logging/logger";

type RegionAskHandler = (
  reader: _ZoteroTypes.ReaderInstance,
  target: RegionAnnotationTarget,
  attachment: Awaited<ReturnType<typeof copyRegionImage>>,
) => void | Promise<void>;

let unregister: (() => void) | undefined;
const logger = createLogger("reader.regionMenu");

function registerReaderRegionMenu(
  onAsk: RegionAskHandler,
  onError: (error: RegionAskError) => void = () => undefined,
): () => void {
  unregister?.();
  const api = Zotero.Reader;
  if (
    typeof api?.registerEventListener !== "function" ||
    typeof api.unregisterEventListener !== "function"
  ) {
    logger.warn("Reader region menu API is unavailable");
    return () => undefined;
  }
  let disposed = false;
  const handler: _ZoteroTypes.Reader.EventHandler<
    "createAnnotationContextMenu"
  > = (event) => {
    if (disposed) return;
    const target = getImageAnnotationTarget(
      event.reader,
      event.params.currentID,
    );
    if (!target) return;
    event.append({
      label: getString("reader-ask-about-region"),
      persistent: true,
      onCommand: async () => {
        if (disposed) return;
        try {
          const current = getImageAnnotationTarget(
            event.reader,
            event.params.currentID,
          );
          if (!current || current.id !== target.id)
            throw new RegionAskError("unavailable");
          const attachment = await copyRegionImage(current);
          if (!disposed) await onAsk(event.reader, current, attachment);
        } catch (error) {
          if (disposed) return;
          const diagnostic =
            error instanceof RegionAskError
              ? error
              : new RegionAskError("copy-failed");
          logger.warn("Region ask failed", { code: diagnostic.code });
          onError(diagnostic);
        }
      },
    });
  };
  try {
    api.registerEventListener(
      "createAnnotationContextMenu",
      handler,
      config.addonID,
    );
  } catch {
    logger.warn("Reader region menu registration failed");
    return () => undefined;
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    api.unregisterEventListener("createAnnotationContextMenu", handler);
    if (unregister === dispose) unregister = undefined;
  };
  unregister = dispose;
  return dispose;
}

export { registerReaderRegionMenu };
export type { RegionAskHandler };
