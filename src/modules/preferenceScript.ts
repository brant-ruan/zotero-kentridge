import { getProviderConfigs } from "./dataprovider/registry";

export function registerPrefsScripts(window: Window) {
  const doc = window.document;
  const providers = getProviderConfigs();

  providers.forEach((provider) => {
    const enableInput = doc.getElementById(
      `kentridge-pref-provider-${provider.key}`,
    ) as HTMLInputElement | null;
    const apiKeyBox = doc.getElementById(
      `kentridge-pref-provider-${provider.key}-apikey-box`,
    ) as HTMLElement | null;
    const apiKeyInput = doc.getElementById(
      `kentridge-pref-provider-${provider.key}-apikey`,
    ) as HTMLInputElement | null;

    if (apiKeyBox) {
      apiKeyBox.hidden = !provider.requiresApiKey;
    }

    if (apiKeyInput) {
      apiKeyInput.disabled = !provider.requiresApiKey || !enableInput?.checked;
    }

    if (enableInput && apiKeyInput) {
      enableInput.addEventListener("command", () => {
        apiKeyInput.disabled = !provider.requiresApiKey || !enableInput.checked;
      });
    }
  });
}
