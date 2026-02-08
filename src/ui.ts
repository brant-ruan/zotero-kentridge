import kentridge from './kentridge';

export function registerContextMenu(): void {
  addon.data.ztoolkit.Menu.register('item', {
    tag: 'menu',
    label: 'Kentridge',
    children: [
      {
        tag: 'menuitem',
        label: 'Fetch Metadata by Title',
        commandListener: () => kentridge.fetchMetadataForSelectedItem(),
      },
    ],
  });
}
