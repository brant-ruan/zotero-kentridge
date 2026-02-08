/**
 * A comprehensive list of Zotero creator types.
 */
export type ZoteroCreatorType =
  | "author"
  | "contributor"
  | "editor"
  | "translator"
  | "seriesEditor"
  | "interviewee"
  | "interviewer"
  | "director"
  | "scriptwriter"
  | "producer"
  | "castMember"
  | "sponsor"
  | "cosponsor"
  | "wordsBy"
  | "performer"
  | "composer"
  | "artist"
  | "commenter"
  | "bookAuthor"
  | "counsel"
  | "recipient"
  | "reviewedAuthor";

/**
 * Standardized metadata structure for an item.
 * Each data provider must transform its result into this format.
 */
export interface MetadataItem {
  itemType: string;
  title: string;
  creators: {
    creatorType: ZoteroCreatorType;
    firstName?: string;
    lastName: string;
  }[];
  date?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  DOI?: string;
  url?: string;
  abstractNote?: string;
  [key: string]: any; // Allow other fields
}

/**
 * Interface for all data providers.
 */
export interface DataProvider {
  /**
   * The unique key for the provider (e.g., 'dblp', 'crossref').
   */
  readonly key: string;

  /**
   * The display name of the provider for the UI.
   */
  readonly name: string;

  /**
   * Optional API key for the provider.
   */
  apiKey?: string;

  /**
   * Fetches metadata from the source by title.
   * @param title The title of the item to search for.
   * @returns A promise that resolves to an array of standardized metadata items.
   */
  fetchByTitle(title: string): Promise<MetadataItem[]>;
}
