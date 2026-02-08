import { MetadataItem } from "./modules/dataprovider/interface";
import { getEnabledProviderConfigs } from "./modules/dataprovider/registry";
import { getPref } from "./utils/prefs";

interface SearchResult {
  providerKey: string;
  providerName: string;
  metadata: MetadataItem;
}

class Kentridge {
  private static instance: Kentridge;

  private constructor() {}

  public static getInstance(): Kentridge {
    if (!Kentridge.instance) {
      Kentridge.instance = new Kentridge();
    }
    return Kentridge.instance;
  }

  public async fetchMetadataForSelectedItem() {
    const pane = Zotero.getActiveZoteroPane();
    const selectedItems = pane.getSelectedItems();
    if (selectedItems.length !== 1) {
      Zotero.debug("[kentridge] Please select exactly one item.");
      return;
    }
    const enabledProviders = getEnabledProviderConfigs();
    if (enabledProviders.length === 0) {
      this.showInfoDialog("Kentridge", "No metadata provider is enabled.");
      return;
    }

    const item = selectedItems[0];
    const title = item.getField("title");
    if (!title) {
      Zotero.debug("[kentridge] Selected item has no title.");
      return;
    }

    Zotero.debug(`[kentridge] Fetching for title: ${title}`);
    const results = await this.fetchFromEnabledProviders(
      title,
      enabledProviders,
    );

    if (results.length === 0) {
      this.showInfoDialog("Kentridge", "No metadata match was found.");
      return;
    }

    this.showResultSelectionDialog(item, results);
  }

  private async fetchFromEnabledProviders(
    title: string,
    enabledProviders: ReturnType<typeof getEnabledProviderConfigs>,
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    for (const providerConfig of enabledProviders) {
      const apiKey = providerConfig.apiKeyPrefKey
        ? String(getPref(providerConfig.apiKeyPrefKey) || "")
        : undefined;
      const provider = providerConfig.createProvider(apiKey);

      try {
        const results = await provider.fetchByTitle(title);
        results.forEach((metadata) => {
          allResults.push({
            providerKey: providerConfig.key,
            providerName: providerConfig.name,
            metadata,
          });
        });
      } catch (error) {
        Zotero.debug(
          `[kentridge] Provider ${providerConfig.key} failed: ${String(error)}`,
        );
      }
    }
    return allResults;
  }

  private showResultSelectionDialog(
    item: Zotero.Item,
    results: SearchResult[],
  ) {
    const dialog = new addon.data.ztoolkit.Dialog(1, 1);
    const resultRadioName = "kentridge-result-radio";

    dialog.addCell(0, 0, {
      tag: "div",
      namespace: "html",
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "100%",
        minWidth: "760px",
        maxWidth: "100%",
      },
      children: [
        {
          tag: "p",
          namespace: "html",
          styles: { margin: "0", fontWeight: "bold" },
          properties: {
            textContent: "Select a metadata entry to apply:",
          },
        },
        {
          tag: "div",
          namespace: "html",
          styles: {
            width: "100%",
            minHeight: "360px",
            maxHeight: "420px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxSizing: "border-box",
            paddingRight: "4px",
          },
          children: results.map((result, index) =>
            this.buildResultCard(result, index, resultRadioName),
          ),
        },
      ],
    });
    dialog.addButton("Cancel", "cancel");
    dialog.addButton("Apply", "apply", {
      noClose: true,
      callback: () => {
        const selectedResult = this.getSelectedResult(
          dialog.window,
          resultRadioName,
          results,
        );
        if (!selectedResult) {
          this.showInfoDialog("Kentridge", "Please select one result.");
          return;
        }

        dialog.window.close();
        // Close dialog first to avoid perceived UI blocking, then update metadata.
        Zotero.Promise.delay(0).then(() => {
          void this.updateItemWithMetadata(item, selectedResult.metadata);
        });
      },
    });

    dialog.open("Kentridge: Metadata Results", {
      width: 900,
      height: 600,
      fitContent: false,
      centerscreen: true,
      resizable: true,
    });
  }

  private buildResultCard(
    result: SearchResult,
    index: number,
    radioName: string,
  ) {
    const title = result.metadata.title || "Untitled";
    const creators = this.formatCreators(result.metadata.creators);
    const venue = result.metadata.publicationTitle || "Unknown venue";
    const year = result.metadata.date || "n.d.";
    const doi = result.metadata.DOI || "";

    return {
      tag: "label",
      namespace: "html",
      styles: {
        display: "grid",
        gridTemplateColumns: "22px 1fr",
        gap: "10px",
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #c7c7c7",
        borderRadius: "6px",
        padding: "10px",
        cursor: "pointer",
        backgroundColor: "#fff",
      },
      children: [
        {
          tag: "input",
          namespace: "html",
          attributes: {
            type: "radio",
            name: radioName,
            value: String(index),
          },
          properties: {
            checked: index === 0,
          },
          styles: {
            marginTop: "2px",
          },
        },
        {
          tag: "div",
          namespace: "html",
          styles: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            minWidth: "0",
          },
          children: [
            {
              tag: "div",
              namespace: "html",
              properties: {
                textContent: title,
              },
              styles: {
                fontWeight: "bold",
                lineHeight: "1.3",
                whiteSpace: "normal",
                wordBreak: "break-word",
              },
            },
            {
              tag: "div",
              namespace: "html",
              properties: {
                textContent: `${venue} | ${year} | ${result.providerName}`,
              },
              styles: {
                fontSize: "0.95em",
                color: "#444",
                whiteSpace: "normal",
                wordBreak: "break-word",
              },
            },
            {
              tag: "div",
              namespace: "html",
              properties: {
                textContent: creators,
              },
              styles: {
                fontSize: "0.92em",
                color: "#333",
                whiteSpace: "normal",
                wordBreak: "break-word",
              },
            },
            ...(doi
              ? [
                  {
                    tag: "div",
                    namespace: "html",
                    properties: {
                      textContent: `DOI: ${doi}`,
                    },
                    styles: {
                      fontSize: "0.9em",
                      color: "#555",
                      whiteSpace: "normal",
                      wordBreak: "break-all",
                    },
                  },
                ]
              : []),
          ],
        },
      ],
    };
  }

  private getSelectedResult(
    win: Window,
    radioName: string,
    results: SearchResult[],
  ): SearchResult | null {
    const selectedRadio = win.document.querySelector(
      `input[type="radio"][name="${radioName}"]:checked`,
    ) as HTMLInputElement | null;
    if (!selectedRadio) {
      return null;
    }

    const selectedIndex = Number.parseInt(selectedRadio.value, 10);
    if (Number.isNaN(selectedIndex) || selectedIndex < 0) {
      return null;
    }
    return results[selectedIndex] ?? null;
  }

  private formatCreators(creators: MetadataItem["creators"]): string {
    if (!creators?.length) {
      return "Unknown creators";
    }
    return creators
      .map((creator) =>
        creator.firstName
          ? `${creator.lastName}, ${creator.firstName}`
          : creator.lastName,
      )
      .join("; ");
  }

  private showInfoDialog(title: string, message: string) {
    const dialog = new addon.data.ztoolkit.Dialog(1, 1);
    dialog.addCell(0, 0, {
      tag: "p",
      namespace: "html",
      properties: { textContent: message },
      styles: { margin: "0", minWidth: "360px" },
    });
    dialog.addButton("OK", "ok");
    dialog.open(title, {
      fitContent: true,
      centerscreen: true,
      resizable: false,
    });
  }

  private async updateItemWithMetadata(
    item: Zotero.Item,
    metadata: MetadataItem,
  ) {
    const updateStrategy = getPref("updateStrategy");

    if (updateStrategy === "replace") {
      this.applyItemType(item, metadata.itemType);
      this.replaceFields(item, metadata);
      this.setCreatorsIfChanged(item, metadata.creators || []);
    } else {
      this.supplementFields(item, metadata);
      if (item.getCreators().length === 0 && metadata.creators?.length) {
        this.setCreatorsIfChanged(item, metadata.creators);
      }
    }

    await item.saveTx();
    Zotero.debug(
      `[kentridge] Updated item ${item.id} with metadata using "${updateStrategy}" mode.`,
    );
  }

  private applyItemType(item: Zotero.Item, itemType: string) {
    if (!itemType) {
      return;
    }

    const itemTypeID = Zotero.ItemTypes.getID(itemType);
    if (typeof itemTypeID === "number" && item.itemTypeID !== itemTypeID) {
      item.setType(itemTypeID);
    }
  }

  private replaceFields(item: Zotero.Item, metadata: MetadataItem) {
    this.setField(item, "title", metadata.title, true);
    this.setField(item, "date", metadata.date, true);
    this.setField(item, "publicationTitle", metadata.publicationTitle, true);
    this.setField(item, "volume", metadata.volume, true);
    this.setField(item, "issue", metadata.issue, true);
    this.setField(item, "pages", metadata.pages, true);
    this.setField(item, "DOI", metadata.DOI, true);
    this.setField(item, "url", metadata.url, true);
    this.setField(item, "abstractNote", metadata.abstractNote, true);
  }

  private supplementFields(item: Zotero.Item, metadata: MetadataItem) {
    this.setField(item, "title", metadata.title, false);
    this.setField(item, "date", metadata.date, false);
    this.setField(item, "publicationTitle", metadata.publicationTitle, false);
    this.setField(item, "volume", metadata.volume, false);
    this.setField(item, "issue", metadata.issue, false);
    this.setField(item, "pages", metadata.pages, false);
    this.setField(item, "DOI", metadata.DOI, false);
    this.setField(item, "url", metadata.url, false);
    this.setField(item, "abstractNote", metadata.abstractNote, false);
  }

  private setField(
    item: Zotero.Item,
    fieldName: string,
    value: unknown,
    replace: boolean,
  ) {
    const nextValue = typeof value === "string" ? value.trim() : "";
    const currentValue = String(item.getField(fieldName) || "").trim();

    if (replace) {
      if (currentValue !== nextValue) {
        item.setField(fieldName, nextValue);
      }
      return;
    }

    if (!currentValue && nextValue) {
      item.setField(fieldName, nextValue);
    }
  }

  private setCreatorsIfChanged(
    item: Zotero.Item,
    nextCreators: MetadataItem["creators"],
  ) {
    const currentCreators = item.getCreators() || [];
    if (
      this.buildCreatorsSignature(currentCreators) ===
      this.buildCreatorsSignature(nextCreators || [])
    ) {
      return;
    }
    item.setCreators(nextCreators || []);
  }

  private buildCreatorsSignature(creators: any[]): string {
    return creators
      .map((creator) =>
        [
          creator.creatorType || "",
          String(creator.firstName || "").trim(),
          String(creator.lastName || "").trim(),
        ].join("|"),
      )
      .join(";");
  }
}

export default Kentridge.getInstance();
