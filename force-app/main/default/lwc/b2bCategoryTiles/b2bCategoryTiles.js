import { LightningElement, api } from 'lwc';

const DEFAULT_TILES = [
    {
        id: '1',
        label: 'Mais',
        url: '/de-AT/category/detail/0ZGJ9000000D1WMOA0',
        image: '/sesam24/sfsites/c/cms/delivery/media/MCBBATYSJ7ERAANOBXBZ6BQT7HPM?version=1.1&channelId=0apJ9000000p0uU&oid=00DJ9000001vDdp'
    },
    {
        id: '2',
        label: 'Sojabohnen',
        url: '/de-AT/category/detail/0ZGJ9000000D1WROA0',
        image: '/sesam24/sfsites/c/cms/delivery/media/MCWZAN7EWJKVEFFM4O2OJNJJZECU?version=1.1&channelId=0apJ9000000p0uU&oid=00DJ9000001vDdp'
    },
    {
        id: '3',
        label: 'Ölpflanzen',
        url: '/de-AT/category/detail/0ZGJ9000000D1WgOAK',
        image: '/sesam24/sfsites/c/cms/delivery/media/MCWBCFZXNG7NBWNFZFWUW3KDHUUI?version=1.1&channelId=0apJ9000000p0uU&oid=00DJ9000001vDdp'
    },
    {
        id: '4',
        label: 'Zwischenfrüchte',
        url: '/de-AT/category/detail/0ZGJ9000000D1WvOAK',
        image: '/sesam24/sfsites/c/cms/delivery/media/MC4WY7XYBAX5EO7FBJEEGB2P2ZSE?version=1.1&channelId=0apJ9000000p0uU&oid=00DJ9000001vDdp'
    },
    {
        id: '5',
        label: 'Wintergetreide',
        url: '/de-AT/category/detail/0ZGJ9000000D1X5OAK',
        image: '/sesam24/sfsites/c/cms/delivery/media/MCNWG46TBLSJHN5I3ETOFWWALJNM?version=1.1&channelId=0apJ9000000p0uU&oid=00DJ9000001vDdp'
    },
    {
        id: '6',
        label: 'Futter- und Grünland',
        url: '/de-AT/category/detail/0ZGJ9000000D1WqOAK',
        image: '/sesam24/sfsites/c/cms/delivery/media/MCJACQZK6ECBG4NPJH7ZSS6RFYKQ?version=1.1&channelId=0apJ9000000p0uU&oid=00DJ9000001vDdp'
    }
];

export default class B2bCategoryTiles extends LightningElement {
    @api title = 'Kategorien';
    @api subtitle = 'Schnell zu den wichtigsten Produktbereichen.';
    @api tilesJson = '';

    get parsedTiles() {
        if (!this.tilesJson || !this.tilesJson.trim()) {
            return DEFAULT_TILES;
        }

        try {
            const parsed = JSON.parse(this.tilesJson);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                return DEFAULT_TILES;
            }

            return parsed.map((item, index) => ({
                id: String(item.id ?? index + 1),
                label: item.label ?? `Kategorie ${index + 1}`,
                url: item.url ?? '/search',
                image: item.image ?? DEFAULT_TILES[index % DEFAULT_TILES.length].image
            }));
        } catch (e) {
            return DEFAULT_TILES;
        }
    }
}
