# Stroke data sources

## Curriculum selection

The initial 25 characters follow the displayed order of the first three lessons in the Education Cloud `生字詞彙表` for **114學年度上學期 / 一年級 / 國語 / 康軒版**:

- 第一課：拍拍手 (`TextNameId=0103011140101`): 拍、手、左、右、你、他、也、上、下
- 第二課：這是誰的? (`TextNameId=0103011140102`): 這、是、誰、的、我、分、好、了、啊、多、個
- 第三課：秋千 (`TextNameId=0103011140103`): 秋、千、和、玩、陪、高…

Source index: <https://pedia.cloud.edu.tw/Bookmark/Textword?category=%E5%9C%8B%E8%AA%9E&degree=1&press=%E5%BA%B7%E8%BB%92%E7%89%88&year=114_1>

Lesson detail pages:

- <https://pedia.cloud.edu.tw/Bookmark/TCollection?TextNameId=0103011140101>
- <https://pedia.cloud.edu.tw/Bookmark/TCollection?TextNameId=0103011140102>
- <https://pedia.cloud.edu.tw/Bookmark/TCollection?TextNameId=0103011140103>

`陪` is absent from the pinned Traditional Chinese graphics file, so it is skipped and the next listed character, `高`, is used. No Simplified Chinese or Japanese glyph is substituted. The Education Cloud pages establish the textbook list and ordering; this project does not claim that the stroke graphics are Ministry of Education certified.

The site currently also exposes 114學年度下學期 and 115學年度上學期 as semester choices. A separate 115_1 / 二年級 / 康軒版 query was confirmed to return lessons headed `第一課：新學年新希望`, `第二課：一起做早餐`, and `第三課：走過小巷`; those characters are outside this pilot. This pilot intentionally covers only the verified 114_1 selection above.

### Independent spot checks (2026-09-21)

The Ministry of Education's displayed whole-stroke hints were inspected for `我` and `右` and compared with the selected data's ordered medians: `我` has seven strokes with the upper-right dot sixth and the descending leftward stroke seventh; `右` begins with the horizontal stroke, then the descending leftward stroke. These checks matched. This is a limited spot check, not a certification or a complete 25-character review. No Ministry outline/animation assets are redistributed.

- <https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=25105>
- <https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=21491>

## Stroke graphics

Stroke paths and medians come from animCJK's `graphicsZhHant.txt`, which the upstream project identifies as Traditional Chinese for Taiwan. They are pinned to commit `ec5e17cca76c87587790bcbce5ea0b4d4fb753d6` rather than fetched from a moving branch.

- Repository: <https://github.com/parsimonhi/animCJK>
- Pinned source: <https://raw.githubusercontent.com/parsimonhi/animCJK/ec5e17cca76c87587790bcbce5ea0b4d4fb753d6/graphicsZhHant.txt>
- Local subset: `assets/strokes/graphicsZhHant-subset.jsonl`
- Selection metadata: `assets/strokes/metadata.json`

Coordinates use the upstream HanziWriter/MakeMeAHanzi-style system: a 1024-unit canvas, y increasing upward, with the conventional SVG flip baseline at 900. A direct SVG renderer should apply the equivalent of `900 - y` (commonly expressed by the matching group transform) to both paths and medians. The generated data preserves upstream path strings and median points without coordinate conversion.

## License and reproduction

animCJK's `licenses/COPYING.txt` states that files prefixed by `graphics` and character SVGs may be redistributed or modified under the Arphic Public License. The upstream notice and complete Traditional Chinese license text are preserved at:

- `assets/strokes/licenses/COPYING.txt`
- `assets/strokes/licenses/ARPHICPL.TXT`

The checked-in subset is a derivative selection dated 2026-09-22. Its first JSONL record gives the modification date, selection-only change, copyright attribution, and license paths. The generated `stroke-data.js` repeats that notice in its opening comments; its wrapper and lesson labels were added on 2026-09-22 without changing the upstream path or median geometry. These stroke-data files are offered under the Arphic Public License; the notice does not apply to unrelated application code.

To reproduce from a separately downloaded pinned upstream file:

```sh
node scripts/build-stroke-data.cjs --extract /path/to/graphicsZhHant.txt
```

To rebuild `stroke-data.js` from the checked-in subset:

```sh
node scripts/build-stroke-data.cjs
```
