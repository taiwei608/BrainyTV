# 寶可夢專區資料來源

- 結構化資料、繁體中文名稱、18 × 18 屬性倍率、種族值、特性、圖鑑編號、進化條件與招式：公開的 [PokéAPI CSV](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)，欄位定義見 [API 文件](https://pokeapi.co/docs/v2)。
- 圖鑑涵蓋帕底亞 400、北上 200、藍莓 243；同種寶可夢在不同圖鑑有不同編號。另收錄具有 `scarlet-violet` 學招紀錄的種類與型態，不以全國編號範圍冒充遊戲可用名單。
- 招式學習資料嚴格使用 `version_groups.csv` 中 `scarlet-violet` 的 ID；不合併其他世代。區分升級、招式學習器、蛋招式與教授。Lv. 0 是進化時招式；空威力或命中率保留為「—」，PP、分類、威力與命中率来自 `moves.csv`。
- 進化資料保留分支及區域型態；排除朱／紫之後的版本，優先使用來源標示的預設條件。資料可能有來源缺漏；特殊進化與不能在朱／紫進化的家族另作明確註記。中文解釋參考 [Serebii 的朱／紫進化方法](https://www.serebii.net/scarletviolet/evolution.shtml)、[詭角鹿的前身驚角鹿](https://www.serebii.net/pokedex-sv/stantler/)。
- 來源仍有舊世代的親密度 220，重建時修正為朱／紫所用的 160，參考 [親密度進化的世代差異](https://bulbapedia.bulbagarden.net/wiki/Friendship_evolution)。
- 18 個朱／紫英文屬性標籤 PNG 保存於 `assets/pokemon/types/`，來自 [PokéAPI sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/types/generation-ix/scarlet-violet)。按鈕截取標籤左側的原版符號，完整標籤另顯示於屬性頁，附繁體中文名稱。
- 寶可夢圖片從該 sprites 專案的 `sprites/pokemon/{id}.png` 載入，需要網路；文字資料與屬性圖示隨網站提供。圖像著作權屬 Pokémon / Nintendo / Creatures / GAME FREAK；本專區為非官方資料瀏覽工具。

重建文字資料：`node scripts/build-pokemon-data.cjs`（Node 18+，需網路）。快照日期在 `POKEMON_DATA.updated`。驗證：`node pokemon.test.cjs`。

屬性倍率為一般對戰規則，不包含特性、道具、太晶化或招式特例；威力是招式資料的基礎威力，不等於最終傷害。來源沒有完整繁體中文型態名稱時，保留英文型態名稱。
