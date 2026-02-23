import { MetadataItem } from "./modules/dataprovider/interface";
import { getEnabledProviderConfigs } from "./modules/dataprovider/registry";
import { getPref } from "./utils/prefs";

interface SearchResult {
  providerKey: string;
  providerName: string;
  metadata: MetadataItem;
  isExactTitleMatch?: boolean;
  isCorrVenue?: boolean;
}

type SelectionAction = SearchResult | null | "abort";

interface BatchAssignInput {
  itemTypeID?: number;
  proceedingsTitle?: string;
  conferenceName?: string;
  publisher?: string;
  date?: string;
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
    if (selectedItems.length === 0) {
      Zotero.debug("[kentridge] Please select at least one item.");
      return;
    }
    const enabledProviders = getEnabledProviderConfigs();
    if (enabledProviders.length === 0) {
      this.showInfoDialog("Kentridge", "No metadata provider is enabled.");
      return;
    }

    const failedTitles: string[] = [];

    for (let index = 0; index < selectedItems.length; index++) {
      const item = selectedItems[index];
      const title = String(item.getField("title") || "").trim();
      const displayTitle = title || `(untitled item #${item.id})`;

      try {
        if (!item.isRegularItem?.()) {
          failedTitles.push(displayTitle);
          Zotero.debug(
            `[kentridge] Skip item ${item.id}: not a regular bibliographic item.`,
          );
          continue;
        }

        if (!title) {
          Zotero.debug(`[kentridge] Skip item ${item.id}: empty title.`);
          failedTitles.push(displayTitle);
          continue;
        }

        Zotero.debug(
          `[kentridge] [${index + 1}/${selectedItems.length}] Fetching for title: ${title}`,
        );
        const results = await this.fetchFromEnabledProviders(
          title,
          enabledProviders,
        );

        if (results.length === 0) {
          failedTitles.push(displayTitle);
          continue;
        }

        const rankedResults = this.rankResultsForSelection(title, results);
        const action = await this.showResultSelectionDialog(
          item,
          rankedResults,
          index + 1,
          selectedItems.length,
        );

        if (action === "abort") {
          break;
        }

        if (!action) {
          continue;
        }

        await this.updateItemWithMetadata(item, action.metadata);
      } catch (error) {
        failedTitles.push(displayTitle);
        Zotero.debug(
          `[kentridge] Failed to process item ${item.id}: ${String(error)}`,
        );
      }
    }

    if (failedTitles.length > 0) {
      this.showBatchFailureSummaryDialog(failedTitles);
    }
  }

  public async batchAssignSelectedParentItems() {
    const selectedItems = this.getSelectedParentRegularItems();
    if (selectedItems.length === 0) {
      this.showInfoDialog(
        "Kentridge",
        "Please select at least one parent bibliographic item.",
      );
      return;
    }

    const input = await this.showBatchAssignDialog(selectedItems.length);
    if (!input) {
      return;
    }

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const item of selectedItems) {
      const changed = await this.applyBatchAssignToItem(item, input);
      if (changed) {
        updatedCount += 1;
      } else {
        unchangedCount += 1;
      }
    }

    this.showInfoDialog(
      "Kentridge",
      `Batch assign completed. Updated: ${updatedCount}; Unchanged: ${unchangedCount}.`,
    );
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
    currentIndex: number,
    totalCount: number,
  ): Promise<SelectionAction> {
    const dialog = new addon.data.ztoolkit.Dialog(1, 1);
    const resultRadioName = `kentridge-result-radio-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (action: SelectionAction) => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(action);
      };

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
              textContent: `Item ${currentIndex}/${totalCount}: ${String(item.getField("title") || "Untitled")}`,
            },
          },
          {
            tag: "p",
            namespace: "html",
            styles: { margin: "0", color: "#444" },
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
      dialog.addButton("Skip", "skip", {
        callback: () => finish(null),
      });
      dialog.addButton("Stop", "stop", {
        callback: () => finish("abort"),
      });
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

          finish(selectedResult);
          dialog.window.close();
        },
      });
      dialog.setDialogData({
        beforeUnloadCallback: () => {
          finish(null);
        },
      });

      dialog.open("Kentridge: Metadata Results", {
        width: 900,
        height: 600,
        fitContent: false,
        centerscreen: true,
        resizable: true,
      });
    });
  }

  private getSelectedParentRegularItems(): Zotero.Item[] {
    const pane = Zotero.getActiveZoteroPane();
    const selectedItems = pane.getSelectedItems();
    return selectedItems.filter((item) => {
      if (!item.isRegularItem?.()) {
        return false;
      }
      if (item.isTopLevelItem?.() === false) {
        return false;
      }
      return !item.parentID;
    });
  }

  private showBatchAssignDialog(
    selectedCount: number,
  ): Promise<BatchAssignInput | null> {
    const dialog = new addon.data.ztoolkit.Dialog(1, 1);
    const itemTypes = Zotero.ItemTypes.getTypes()
      .filter((itemType: { id: number; name?: string }) =>
        Number.isInteger(itemType.id),
      )
      .sort((a: { id: number }, b: { id: number }) =>
        Zotero.ItemTypes.getLocalizedString(a.id).localeCompare(
          Zotero.ItemTypes.getLocalizedString(b.id),
        ),
      );

    const itemTypeSelectID = "kentridge-batch-assign-item-type";
    const proceedingsTitleID = "kentridge-batch-assign-proceedings-title";
    const conferenceNameID = "kentridge-batch-assign-conference-name";
    const publisherID = "kentridge-batch-assign-publisher";
    const dateID = "kentridge-batch-assign-date";

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (value: BatchAssignInput | null) => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(value);
      };

      dialog.addCell(0, 0, {
        tag: "div",
        namespace: "html",
        styles: {
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
          minWidth: "760px",
        },
        children: [
          {
            tag: "p",
            namespace: "html",
            styles: { margin: "0", fontWeight: "bold" },
            properties: {
              textContent: `Batch assign fields for ${selectedCount} selected parent item(s)`,
            },
          },
          {
            tag: "p",
            namespace: "html",
            styles: { margin: "0", color: "#444" },
            properties: {
              textContent:
                "Only filled values will be written. Empty values keep each item unchanged.",
            },
          },
          {
            tag: "table",
            namespace: "html",
            styles: {
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            },
            children: [
              {
                tag: "tbody",
                namespace: "html",
                children: [
                  this.buildBatchAssignRow("Item Type", {
                    tag: "select",
                    namespace: "html",
                    attributes: { id: itemTypeSelectID },
                    styles: { width: "100%", boxSizing: "border-box" },
                    children: [
                      {
                        tag: "option",
                        namespace: "html",
                        attributes: { value: "" },
                        properties: { textContent: "(Keep unchanged)" },
                      },
                      ...itemTypes.map((itemType: { id: number }) => ({
                        tag: "option",
                        namespace: "html",
                        attributes: { value: String(itemType.id) },
                        properties: {
                          textContent: Zotero.ItemTypes.getLocalizedString(
                            itemType.id,
                          ),
                        },
                      })),
                    ],
                  }),
                  this.buildBatchAssignRow("Proceedings Title", {
                    tag: "input",
                    namespace: "html",
                    attributes: {
                      id: proceedingsTitleID,
                      type: "text",
                      placeholder: "e.g. Proceedings of ...",
                    },
                    styles: { width: "100%", boxSizing: "border-box" },
                  }),
                  this.buildBatchAssignRow("Conference Name", {
                    tag: "input",
                    namespace: "html",
                    attributes: {
                      id: conferenceNameID,
                      type: "text",
                      placeholder: "e.g. ICML 2026",
                    },
                    styles: { width: "100%", boxSizing: "border-box" },
                  }),
                  this.buildBatchAssignRow("Publisher", {
                    tag: "input",
                    namespace: "html",
                    attributes: {
                      id: publisherID,
                      type: "text",
                      placeholder: "e.g. ACM",
                    },
                    styles: { width: "100%", boxSizing: "border-box" },
                  }),
                  this.buildBatchAssignRow("Date", {
                    tag: "input",
                    namespace: "html",
                    attributes: {
                      id: dateID,
                      type: "text",
                      placeholder: "YYYY or YYYY-MM-DD",
                    },
                    styles: { width: "100%", boxSizing: "border-box" },
                  }),
                ],
              },
            ],
          },
        ],
      });

      dialog.addButton("Cancel", "cancel", {
        callback: () => finish(null),
      });
      dialog.addButton("Apply", "apply", {
        noClose: true,
        callback: () => {
          const win = dialog.window;
          const doc = win.document;

          const itemTypeValue = (
            doc.getElementById(itemTypeSelectID) as HTMLSelectElement | null
          )?.value;
          const proceedingsTitle = (
            doc.getElementById(proceedingsTitleID) as HTMLInputElement | null
          )?.value?.trim();
          const conferenceName = (
            doc.getElementById(conferenceNameID) as HTMLInputElement | null
          )?.value?.trim();
          const publisher = (
            doc.getElementById(publisherID) as HTMLInputElement | null
          )?.value?.trim();
          const date = (
            doc.getElementById(dateID) as HTMLInputElement | null
          )?.value?.trim();

          const input: BatchAssignInput = {};
          if (itemTypeValue) {
            const nextItemTypeID = Number.parseInt(itemTypeValue, 10);
            if (Number.isNaN(nextItemTypeID)) {
              this.showInfoDialog("Kentridge", "Invalid item type.");
              return;
            }
            input.itemTypeID = nextItemTypeID;
          }
          if (proceedingsTitle) {
            input.proceedingsTitle = proceedingsTitle;
          }
          if (conferenceName) {
            input.conferenceName = conferenceName;
          }
          if (publisher) {
            input.publisher = publisher;
          }
          if (date) {
            input.date = date;
          }

          if (!this.hasBatchAssignInput(input)) {
            this.showInfoDialog(
              "Kentridge",
              "Please fill at least one field before applying.",
            );
            return;
          }

          finish(input);
          win.close();
        },
      });
      dialog.setDialogData({
        beforeUnloadCallback: () => finish(null),
      });

      dialog.open("Kentridge: Batch Assign", {
        width: 860,
        height: 520,
        fitContent: false,
        centerscreen: true,
        resizable: true,
      });
    });
  }

  private buildBatchAssignRow(fieldLabel: string, inputCell: any) {
    return {
      tag: "tr",
      namespace: "html",
      children: [
        {
          tag: "td",
          namespace: "html",
          styles: {
            width: "240px",
            padding: "8px 10px",
            verticalAlign: "top",
            borderBottom: "1px solid #e6e6e6",
            fontWeight: "bold",
          },
          properties: { textContent: fieldLabel },
        },
        {
          tag: "td",
          namespace: "html",
          styles: {
            padding: "8px 10px",
            borderBottom: "1px solid #e6e6e6",
          },
          children: [inputCell],
        },
      ],
    };
  }

  private hasBatchAssignInput(input: BatchAssignInput): boolean {
    return Boolean(
      input.itemTypeID ||
      input.proceedingsTitle ||
      input.conferenceName ||
      input.publisher ||
      input.date,
    );
  }

  private async applyBatchAssignToItem(
    item: Zotero.Item,
    input: BatchAssignInput,
  ): Promise<boolean> {
    const beforeSignature = this.buildItemSignature(item);

    if (
      typeof input.itemTypeID === "number" &&
      item.itemTypeID !== input.itemTypeID
    ) {
      item.setType(input.itemTypeID);
    }
    if (input.proceedingsTitle) {
      this.setField(item, "proceedingsTitle", input.proceedingsTitle, true);
    }
    if (input.conferenceName) {
      this.setField(item, "conferenceName", input.conferenceName, true);
    }
    if (input.publisher) {
      this.setField(item, "publisher", input.publisher, true);
    }
    if (input.date) {
      this.setField(item, "date", input.date, true);
    }

    const afterSignature = this.buildItemSignature(item);
    if (beforeSignature === afterSignature) {
      return false;
    }
    await item.saveTx();
    return true;
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
    const isExactMatch = Boolean(result.isExactTitleMatch);

    return {
      tag: "label",
      namespace: "html",
      styles: {
        display: "grid",
        gridTemplateColumns: "22px 1fr",
        gap: "10px",
        width: "100%",
        boxSizing: "border-box",
        border: isExactMatch ? "1px solid #96c7b8" : "1px solid #c7c7c7",
        borderRadius: "6px",
        padding: "10px",
        cursor: "pointer",
        backgroundColor: isExactMatch ? "#f2faf7" : "#fff",
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
                color: isExactMatch ? "#155f49" : "inherit",
                whiteSpace: "normal",
                wordBreak: "break-word",
              },
            },
            ...(isExactMatch
              ? [
                  {
                    tag: "div",
                    namespace: "html",
                    properties: {
                      textContent: "Exact title match",
                    },
                    styles: {
                      display: "inline-block",
                      alignSelf: "flex-start",
                      fontSize: "0.82em",
                      color: "#155f49",
                      backgroundColor: "#e1f3ec",
                      border: "1px solid #b5dbcf",
                      borderRadius: "999px",
                      padding: "2px 8px",
                    },
                  },
                ]
              : []),
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

  private rankResultsForSelection(
    originalTitle: string,
    results: SearchResult[],
  ): SearchResult[] {
    const demoteCorr = Boolean(getPref("sorting.demoteCorr"));
    const normalizedOriginalTitle =
      this.normalizeTitleForComparison(originalTitle);

    return results
      .map((result) => {
        const normalizedCandidateTitle = this.normalizeTitleForComparison(
          result.metadata.title,
        );
        const venue = String(result.metadata.publicationTitle || "")
          .trim()
          .toLowerCase();
        return {
          ...result,
          isExactTitleMatch:
            normalizedOriginalTitle.length > 0 &&
            normalizedCandidateTitle === normalizedOriginalTitle,
          isCorrVenue: venue === "corr",
        };
      })
      .sort((a, b) => {
        if (Boolean(a.isExactTitleMatch) !== Boolean(b.isExactTitleMatch)) {
          return a.isExactTitleMatch ? -1 : 1;
        }
        if (demoteCorr && Boolean(a.isCorrVenue) !== Boolean(b.isCorrVenue)) {
          return a.isCorrVenue ? 1 : -1;
        }
        return 0;
      });
  }

  private normalizeTitleForComparison(value: unknown): string {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .trim()
      .replace(/[.。]+$/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
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

  private showBatchFailureSummaryDialog(failedTitles: string[]) {
    const dialog = new addon.data.ztoolkit.Dialog(1, 1);
    const uniqueTitles = Array.from(new Set(failedTitles));

    dialog.addCell(0, 0, {
      tag: "div",
      namespace: "html",
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "100%",
        minWidth: "720px",
      },
      children: [
        {
          tag: "p",
          namespace: "html",
          styles: { margin: "0", fontWeight: "bold", fontSize: "1.1em" },
          properties: {
            textContent: `Failed to fetch metadata for ${uniqueTitles.length} item(s):`,
          },
        },
        {
          tag: "div",
          namespace: "html",
          styles: {
            width: "100%",
            minHeight: "220px",
            maxHeight: "420px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxSizing: "border-box",
            paddingRight: "4px",
          },
          children: uniqueTitles.map((title, index) => ({
            tag: "div",
            namespace: "html",
            styles: {
              border: "1px solid #c7c7c7",
              borderRadius: "6px",
              padding: "10px",
              backgroundColor: "#fff",
              whiteSpace: "normal",
              wordBreak: "break-word",
            },
            properties: {
              textContent: `${index + 1}. ${title}`,
            },
          })),
        },
      ],
    });
    dialog.addButton("OK", "ok");
    dialog.open("Kentridge: Batch Summary", {
      width: 860,
      height: 520,
      fitContent: false,
      centerscreen: true,
      resizable: true,
    });
  }

  private async updateItemWithMetadata(
    item: Zotero.Item,
    metadata: MetadataItem,
  ) {
    const updateStrategy = getPref("updateStrategy");
    const beforeSignature = this.buildItemSignature(item);

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

    const afterSignature = this.buildItemSignature(item);
    if (beforeSignature !== afterSignature) {
      await item.saveTx();
      Zotero.debug(
        `[kentridge] Updated item ${item.id} with metadata using "${updateStrategy}" mode.`,
      );
    } else {
      Zotero.debug(
        `[kentridge] Item ${item.id} unchanged after metadata merge, skipped save.`,
      );
    }
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
    this.setVenueField(item, metadata.publicationTitle, true);
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
    this.setVenueField(item, metadata.publicationTitle, false);
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
    if (!this.isFieldValidForItemType(item, fieldName)) {
      return;
    }

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

  private setVenueField(item: Zotero.Item, venue: unknown, replace: boolean) {
    const candidateFields = [
      "publicationTitle",
      "proceedingsTitle",
      "bookTitle",
      "seriesTitle",
    ];

    for (const fieldName of candidateFields) {
      if (!this.isFieldValidForItemType(item, fieldName)) {
        continue;
      }
      this.setField(item, fieldName, venue, replace);
      return;
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

  private buildItemSignature(item: Zotero.Item): string {
    const fields = [
      "itemTypeID",
      "title",
      "date",
      "publicationTitle",
      "proceedingsTitle",
      "bookTitle",
      "seriesTitle",
      "volume",
      "issue",
      "pages",
      "DOI",
      "url",
      "abstractNote",
    ];

    const fieldPart = fields
      .map((field) => {
        if (field === "itemTypeID") {
          return `${field}=${String(item.itemTypeID)}`;
        }
        return `${field}=${String(item.getField(field) || "").trim()}`;
      })
      .join("||");

    const creatorPart = this.buildCreatorsSignature(item.getCreators() || []);
    return `${fieldPart}||creators=${creatorPart}`;
  }

  private isFieldValidForItemType(
    item: Zotero.Item,
    fieldName: string,
  ): boolean {
    const fieldID = Zotero.ItemFields.getID(fieldName);
    if (typeof fieldID !== "number") {
      return false;
    }
    return Zotero.ItemFields.isValidForType(fieldID, item.itemTypeID);
  }
}

export default Kentridge.getInstance();
