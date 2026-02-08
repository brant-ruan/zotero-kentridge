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
    const selectId = "kentridge-result-select";

    dialog.addCell(0, 0, {
      tag: "div",
      namespace: "html",
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minWidth: "760px",
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
          tag: "select",
          namespace: "html",
          id: selectId,
          attributes: {
            size: 14,
          },
          styles: {
            width: "100%",
            minHeight: "320px",
            fontFamily: "monospace",
          },
          children: results.map((result, index) => ({
            tag: "option",
            namespace: "html",
            properties: {
              value: String(index),
              textContent: this.formatResultLabel(result),
            },
          })),
        },
      ],
    });
    dialog.addButton("Cancel", "cancel");
    dialog.addButton("Apply", "apply", {
      noClose: true,
      callback: () => {
        const selectedResult = this.getSelectedResult(
          dialog.window,
          selectId,
          results,
        );
        if (!selectedResult) {
          this.showInfoDialog("Kentridge", "Please select one result.");
          return;
        }

        void this.updateItemWithMetadata(item, selectedResult.metadata);
        dialog.window.close();
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

  private getSelectedResult(
    win: Window,
    selectId: string,
    results: SearchResult[],
  ): SearchResult | null {
    const selectElement = win.document.getElementById(
      selectId,
    ) as HTMLSelectElement | null;
    if (!selectElement || selectElement.selectedIndex < 0) {
      return null;
    }

    return results[selectElement.selectedIndex] ?? null;
  }

  private formatResultLabel(result: SearchResult): string {
    const creators = result.metadata.creators
      .map((creator) =>
        creator.firstName
          ? `${creator.lastName}, ${creator.firstName}`
          : creator.lastName,
      )
      .join("; ");

    const parts = [
      `[${result.providerName}]`,
      result.metadata.title || "Untitled",
      creators || "Unknown creators",
      result.metadata.date || "n.d.",
    ];
    return parts.join(" | ");
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
      item.setCreators(metadata.creators || []);
    } else {
      this.supplementFields(item, metadata);
      if (item.getCreators().length === 0 && metadata.creators?.length) {
        item.setCreators(metadata.creators);
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
    if (replace) {
      item.setField(fieldName, nextValue);
      return;
    }

    const currentValue = String(item.getField(fieldName) || "").trim();
    if (!currentValue && nextValue) {
      item.setField(fieldName, nextValue);
    }
  }
}

export default Kentridge.getInstance();
