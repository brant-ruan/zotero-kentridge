import kentridge from "./kentridge";
import { getLocaleID } from "./utils/locale";

type ItemMenu =
  _ZoteroTypes.MenuManager.MenuData<_ZoteroTypes.MenuManager.LibraryMenuContext>;

const menuID = "kentridge-item-menu";

export function registerContextMenu(): void {
  Zotero.MenuManager.unregisterMenu(menuID);

  const menus: ItemMenu[] = [
    {
      menuType: "submenu",
      l10nID: getLocaleID("menu-label"),
      menus: [
        {
          menuType: "menuitem",
          l10nID: getLocaleID("menu-fetch-metadata-label"),
          onCommand: () => {
            kentridge.fetchMetadataForSelectedItem();
          },
        },
      ],
    },
  ];

  Zotero.MenuManager.registerMenu({
    pluginID: addon.data.config.addonID,
    menuID,
    target: "main/library/item",
    menus,
  });
}
