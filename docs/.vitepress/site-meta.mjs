export function createSiteMeta({ base = '/' } = {}) {
  return {
    base,
    title: 'heliosApp',
    description: 'heliosApp documentation',
    themeConfig: {
      nav: [
        { text: 'Home', link: base || '/' },
        { text: 'Guide', link: '/guide/' },
      ],
    },
  }
}
