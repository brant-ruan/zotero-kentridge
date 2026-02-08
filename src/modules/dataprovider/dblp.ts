
import { DataProvider, MetadataItem } from './interface';

export class DblpProvider implements DataProvider {
  public readonly key = 'dblp';
  public readonly name = 'DBLP';
  public apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  public async fetchByTitle(title: string): Promise<MetadataItem[]> {
    const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(
      title
    )}&format=json`;
    Zotero.debug(`[kentridge-dblp] Fetching from DBLP: ${url}`);

    try {
      const response = await Zotero.HTTP.request('GET', url);
      if (response.status !== 200 || !response.responseText) {
        Zotero.debug(
          `[kentridge-dblp] DBLP request failed with status ${response.status}`
        );
        return [];
      }

      const data = JSON.parse(response.responseText);
      if (!data.result?.hits?.hit) {
        return [];
      }

      return data.result.hits.hit.map((hit: any) =>
        this.transformToMetadataItem(hit.info)
      );
    } catch (error) {
      Zotero.debug(`[kentridge-dblp] DBLP request error: ${error}`);
      return [];
    }
  }

  private transformToMetadataItem(info: any): MetadataItem {
    const creators = (info.authors?.author || []).map((author: any) => {
      // DBLP author format can be a string or an object with a 'text' property
      const authorName = typeof author === 'string' ? author : author.text;
      const names = Zotero.Utilities.cleanAuthor(
        authorName,
        'author',
        true
      );
      return {
        creatorType: 'author',
        firstName: names.firstName,
        lastName: names.lastName,
      };
    });

    const item: MetadataItem = {
      itemType: this.mapDblpTypeToZotero(info.type),
      title: info.title,
      creators: creators,
      date: info.year,
      publicationTitle: info.venue,
      volume: info.volume,
      issue: info.number,
      pages: info.pages,
      DOI: info.doi,
      url: info.ee,
    };
    return item;
  }

  private mapDblpTypeToZotero(type: string): string {
    switch (type) {
      case 'Conference and Workshop Papers':
        return 'conferencePaper';
      case 'Journal Articles':
        return 'journalArticle';
      case 'Book Chapters':
        return 'bookSection';
      case 'Books':
        return 'book';
      default:
        return 'document';
    }
  }
}
