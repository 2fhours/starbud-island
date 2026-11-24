# 23 张朝右背面

2026-11-24（Asia/Shanghai）接入。只替换原先正后方的 23 张 `public/portraits/*-back.jpg`。叶角鹿、翠枝鹿、森冕鹿的朝右原稿，以及焰尾狐、火纹狐、炽焰狐、汐纹獭、潮纹獭、沧澜獭的朝左原稿，都不改。全部正面也不改。

判定写在 `src/game/facing.ts`。这 23 张的 `gaze` 都是 `right`，我方槽位不得再水平翻转，否则会和朝右稿叠成朝左。苔背熊、森背熊的生成稿曾经朝左，已在素材里翻转纠正，代码同样不再翻。

## 怎么看

- 总览： [new-backs-contact.jpg](right-back/new-backs-contact.jpg)
- 新旧对照： [before-after-contact.jpg](right-back/before-after-contact.jpg)
- 两只熊纠正前后： [taibei-senbei-flip-compare.jpg](right-back/taibei-senbei-flip-compare.jpg)

规格仍是 384×576、渐进 JPEG、质量 82，没有拉伸。文件大小大约 17–26 KB，和原来的立绘接近。

## 朝向

这 23 张都朝画面右侧，也就是我方槽位面向右侧敌方。不能写成每张都是很强的四分之三侧面。

- 朝向比较清楚的，占大多数，例如鸟、羊、鼯和部分鼠、龟。
- 露珠蛙、霖露蛙、晶露蛙：身体仍接近正后方，头转幅较小；远侧眼睛或脸颊在右，所以方向是右。露珠蛙转幅最小。
- 雾灯蛾：头转幅是蛾里最小的，只能看到右侧一点眼睛。雾辉蛾、岚灯蛾比它清楚一些，仍比鸟类含蓄。
- 寒泉鲵、霜泉鲵：身体朝右（尾巴偏低左，前肢偏右），头几乎不转，后脑仍占主要位置。这是头转幅最小的两张，不是朝左。

这些限制来自对最终 JPEG 的查看，不是只看生成提示词。

## 没有放进仓库的

交付目录里的 `starbud-right-back-portraits.zip` 没有提交。需要原包时看 `/workspace/starbud-ui-right-back/deliver/`。
