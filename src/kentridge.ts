
import { DblpProvider } from './modules/dataprovider/dblp';
import { MetadataItem } from './modules/dataprovider/interface';
import { getPref } from './utils/prefs';

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
    if (!getPref('dataprovider.dblp.enable')) {
      Zotero.debug('[kentridge] DBLP provider is disabled.');
      return;
    }

    const pane = Zotero.getActiveZoteroPane();
    const selectedItems = pane.getSelectedItems();
    if (selectedItems.length !== 1) {
      Zotero.debug('Kentridge: Please select a single item.');
      return;
    }
    const item = selectedItems[0];
    const title = item.getField('title');
    if (!title) {
      Zotero.debug('Kentridge: Selected item has no title.');
      return;
    }

    Zotero.debug(`[kentridge] Fetching for title: ${title}`);

    const dblpApiKey = getPref('dataprovider.dblp.apiKey');
    const dblpProvider = new DblpProvider(dblpApiKey);
    const results = await dblpProvider.fetchByTitle(title);

    Zotero.debug(`[kentridge] Fetched results: ${JSON.stringify(results, null, 2)}`);

    if (results.length === 0) {
      const alert = new addon.data.ztoolkit.Dialog({
        title: 'Kentridge',
        body: 'No results found.',
        buttons: [{ label: 'OK', onClick: () => { alert.close(); } }],
      });
      alert.show();
      return;
    }

    const resultBody = results
      .map(
        (result, index) => `
      <div class="result-item" data-index="${index}">
        <div class="result-title">${result.title}</div>
        <div class="result-creators">${result.creators
          .map((c: any) => `${c.lastName}, ${c.firstName}`)
          .join('; ')}</div>
        <div class="result-date">${result.date || ''}</div>
      </div>
    `
      )
      .join('');

    let selectedIndex = -1;

    const dialog = new addon.data.ztoolkit.Dialog({
      title: 'Kentridge: Metadata Results',
      body: `
        <style>
          .result-item {
            padding: 10px;
            border-bottom: 1px solid #ccc;
            cursor: pointer;
          }
          .result-item:hover {
            background-color: #f0f0f0;
          }
          .result-item.selected {
            background-color: #cce5ff;
          }
          .result-title {
            font-weight: bold;
          }
        </style>
        <div id="results-container">${resultBody}</div>
      `,
      buttons: [
        { label: 'Cancel', onClick: () => dialog.close() },
        {
          label: 'OK',
          onClick: () => {
            if (selectedIndex > -1) {
              this.updateItemWithMetadata(item, results[selectedIndex]);
            }
            dialog.close();
          },
        },
      ],
      onLoad: () => {
        const container = dialog.getDoc().getElementById('results-container');
        if (container) {
          container.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const itemElement = target.closest('.result-item');
            if (itemElement) {
              const allItems = container.querySelectorAll('.result-item');
              allItems.forEach((el: Element) => el.classList.remove('selected'));
              itemElement.classList.add('selected');
              selectedIndex = parseInt(
                itemElement.getAttribute('data-index')!,
                10
              );
            }
          });
        }
      },
    });
    dialog.show();
  }

  private async updateItemWithMetadata(
    item: Zotero.Item,
    metadata: MetadataItem
  ) {
    const updateStrategy = getPref('updateStrategy');

    if (updateStrategy === 'replace') {
      item.setField('itemType', metadata.itemType);
      item.setField('title', metadata.title);
      item.setCreators(metadata.creators);
      if (metadata.date) item.setField('date', metadata.date);
      if (metadata.publicationTitle)
        item.setField('publicationTitle', metadata.publicationTitle);
      if (metadata.volume) item.setField('volume', metadata.volume);
      if (metadata.issue) item.setField('issue', metadata.issue);
      if (metadata.pages) item.setField('pages', metadata.pages);
      if (metadata.DOI) item.setField('DOI', metadata.DOI);
      if (metadata.url) item.setField('url', metadata.url);
      if (metadata.abstractNote)
        item.setField('abstractNote', metadata.abstractNote);
    } else {
      // Supplement
      if (!item.getField('itemType'))
        item.setField('itemType', metadata.itemType);
      if (!item.getField('title')) item.setField('title', metadata.title);
      if (item.getCreators().length === 0) item.setCreators(metadata.creators);
      if (!item.getField('date') && metadata.date)
        item.setField('date', metadata.date);
      if (!item.getField('publicationTitle') && metadata.publicationTitle)
        item.setField('publicationTitle', metadata.publicationTitle);
      if (!item.getField('volume') && metadata.volume)
        item.setField('volume', metadata.volume);
      if (!item.getField('issue') && metadata.issue)
        item.setField('issue', metadata.issue);
      if (!item.getField('pages') && metadata.pages)
        item.setField('pages', metadata.pages);
      if (!item.getField('DOI') && metadata.DOI)
        item.setField('DOI', metadata.DOI);
      if (!item.getField('url') && metadata.url)
        item.setField('url', metadata.url);
      if (!item.getField('abstractNote') && metadata.abstractNote)
        item.setField('abstractNote', metadata.abstractNote);
    }

    await item.saveTx();
    Zotero.debug(
      `[kentridge] Updated item ${item.id} with metadata from DBLP.`
    );
  }
}

export default Kentridge.getInstance();
