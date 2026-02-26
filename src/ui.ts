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
          l10nID: getLocaleID("menu-copy-zotero-link-label"),
          onCommand: () => {
            kentridge.copyZoteroLinkForSelectedItem();
          },
        },
        {
          menuType: "menuitem",
          l10nID: getLocaleID("menu-fetch-metadata-label"),
          onCommand: () => {
            kentridge.fetchMetadataForSelectedItem();
          },
        },
        {
          menuType: "submenu",
          l10nID: getLocaleID("menu-batch-assign-submenu-label"),
          menus: [
            {
              menuType: "menuitem",
              l10nID: getLocaleID("menu-batch-assign-open-label"),
              onCommand: () => {
                kentridge.batchAssignSelectedParentItems();
              },
            },
          ],
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
