import { DataProvider, MetadataItem } from "./interface";

export class DblpProvider implements DataProvider {
  public readonly key = "dblp";
  public readonly name = "DBLP";
  public apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  public async fetchByTitle(title: string): Promise<MetadataItem[]> {
    const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(
      title,
    )}&format=json`;
    Zotero.debug(`[kentridge-dblp] Fetching from DBLP: ${url}`);

    try {
      const response = await Zotero.HTTP.request("GET", url);
      if (response.status !== 200 || !response.responseText) {
        Zotero.debug(
          `[kentridge-dblp] DBLP request failed with status ${response.status}`,
        );
        return [];
      }

      const data = JSON.parse(response.responseText);
      if (!data.result?.hits?.hit) {
        return [];
      }

      return data.result.hits.hit.map((hit: any) =>
        this.transformToMetadataItem(hit.info),
      );
    } catch (error) {
      Zotero.debug(`[kentridge-dblp] DBLP request error: ${error}`);
      return [];
    }
  }

  private transformToMetadataItem(info: any): MetadataItem {
    const creators = (info.authors?.author || []).map((author: any) => {
      // DBLP author format can be a string or an object with a 'text' property
      const authorName = typeof author === "string" ? author : author.text;
      const normalizedAuthorName = this.normalizeAuthorName(authorName);
      const names = Zotero.Utilities.cleanAuthor(
        normalizedAuthorName,
        "author",
        false,
      );
      return {
        creatorType: "author",
        firstName: names.firstName,
        lastName: names.lastName,
      };
    });

    const item: MetadataItem = {
      itemType: this.mapDblpTypeToZotero(info.type),
      title: this.normalizeTitle(info.title),
      creators: creators,
      date: info.year,
      publicationTitle: this.normalizeText(info.venue),
      volume: info.volume,
      issue: info.number,
      pages: info.pages,
      DOI: info.doi,
      url: info.ee,
    };
    return item;
  }

  private normalizeTitle(title: unknown): string {
    const raw = this.normalizeText(title);
    if (!raw) {
      return "";
    }
    // DBLP titles often end with a trailing period that is not desired in Zotero fields.
    return raw.replace(/\.\s*$/, "");
  }

  private normalizeAuthorName(name: unknown): string {
    const raw = this.normalizeText(name);
    if (!raw) {
      return "";
    }
    // DBLP disambiguation suffix like "0001"/"0002" should not be kept in creator names.
    return raw.replace(/\s+\d{4}\s*$/, "");
  }

  private normalizeText(value: unknown): string {
    if (typeof value !== "string") {
      return "";
    }
    return this.decodeHtmlEntities(value).trim();
  }

  private decodeHtmlEntities(value: string): string {
    const namedEntities: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
      nbsp: " ",
    };

    return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const code = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (entity.startsWith("#")) {
        const code = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return namedEntities[entity] ?? match;
    });
  }

  private mapDblpTypeToZotero(type: string): string {
    switch (type) {
      case "Conference and Workshop Papers":
        return "conferencePaper";
      case "Journal Articles":
        return "journalArticle";
      case "Book Chapters":
        return "bookSection";
      case "Books":
        return "book";
      default:
        return "document";
    }
  }
}
