import { getPref } from "../../utils/prefs";
import { DblpProvider } from "./dblp";
import { DataProvider } from "./interface";

type ProviderPrefKey = keyof _ZoteroTypes.Prefs["PluginPrefsMap"];

export interface ProviderConfig {
  key: string;
  name: string;
  enabledPrefKey: ProviderPrefKey;
  apiKeyPrefKey?: ProviderPrefKey;
  requiresApiKey: boolean;
  createProvider: (apiKey?: string) => DataProvider;
}

const PROVIDERS: ProviderConfig[] = [
  {
    key: "dblp",
    name: "DBLP",
    enabledPrefKey: "dataprovider.dblp.enable",
    apiKeyPrefKey: "dataprovider.dblp.apiKey",
    requiresApiKey: false,
    createProvider: (apiKey?: string) => new DblpProvider(apiKey),
  },
];

export function getProviderConfigs(): ProviderConfig[] {
  return [...PROVIDERS];
}

export function getEnabledProviderConfigs(): ProviderConfig[] {
  return PROVIDERS.filter((provider) =>
    Boolean(getPref(provider.enabledPrefKey)),
  );
}
