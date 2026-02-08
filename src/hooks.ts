import { registerContextMenu } from "./ui";
import { registerPrefsScripts } from "./modules/preferenceScript";
import {
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
