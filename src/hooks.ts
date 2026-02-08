import { registerContextMenu } from "./ui";
import { registerPrefsScripts } from "./modules/preferenceScript";
import {
  getString,
  initLocale,
  registerMainWindowLocale,
  unregisterMainWindowLocale,
} from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();
  await registerPreferencePane();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win as any)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  Zotero.debug("[kentridge] onMainWindowLoad");
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  registerMainWindowLocale(win);
  registerContextMenu();
}

async function onMainWindowUnload(win: _ZoteroTypes.MainWindow) {
  unregisterMainWindowLocale(win);
}

function onShutdown() {
  Zotero.debug("Bye-bye, Kentridge!");
}

async function registerPreferencePane() {
  await Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  if (type === "load") {
    registerPrefsScripts(data.window as Window);
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};
