import { assert } from "chai";
import { registerReaderRegionMenu } from "../../src/integrations/zotero/readerRegionMenu.ts";

describe("Reader region menu", function () {
  afterEach(function () {
    delete (globalThis as typeof globalThis & { Zotero?: unknown }).Zotero;
    delete (globalThis as typeof globalThis & { addon?: unknown }).addon;
  });

  it("adds a menu item for image annotations and unregisters it", function () {
    let registeredHandler:
      | _ZoteroTypes.Reader.EventHandler<"createAnnotationContextMenu">
      | undefined;
    let unregisterCount = 0;
    const image = {
      id: 20,
      key: "ANN-IMAGE",
      libraryID: 1,
      parentID: 10,
      annotationType: "image",
      annotationPosition: JSON.stringify({ pageIndex: 1 }),
      isAnnotation: () => true,
    };
    const attachment = {
      id: 10,
      key: "PDF-KEY",
      libraryID: 1,
      getField: () => "Paper PDF",
      getAnnotations: () => [image],
      isPDFAttachment: () => true,
    };
    installLocaleMock();
    (
      globalThis as typeof globalThis & {
        Zotero: unknown;
      }
    ).Zotero = {
      Items: {
        get: (id: number) => (id === 10 ? attachment : image),
        getByLibraryAndKey: () => image,
      },
      Reader: {
        registerEventListener: (
          _type: string,
          handler: typeof registeredHandler,
        ) => {
          registeredHandler = handler;
        },
        unregisterEventListener: () => {
          unregisterCount += 1;
        },
      },
    };
    const dispose = registerReaderRegionMenu(() => undefined);
    assert.isDefined(registeredHandler);
    if (!registeredHandler) return;

    let menu: { label: string } | undefined;
    registeredHandler({
      reader: { itemID: 10, type: "pdf" } as _ZoteroTypes.ReaderInstance,
      doc: {} as Document,
      params: { currentID: "ANN-IMAGE", ids: ["ANN-IMAGE"], x: 0, y: 0 },
      append: (item) => {
        menu = item;
      },
      type: "createAnnotationContextMenu",
    });

    assert.equal(menu?.label, "zopilot-reader-ask-about-region");
    dispose();
    assert.equal(unregisterCount, 1);
  });
});

function installLocaleMock(): void {
  (
    globalThis as typeof globalThis & {
      addon: unknown;
    }
  ).addon = {
    data: {
      locale: {
        current: {
          formatMessagesSync: (messages: Array<{ id: string }>) =>
            messages.map((message) => ({ value: message.id })),
        },
      },
    },
  };
}
