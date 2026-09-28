# 待办 · 世界文明史诗系列补画面（14 首）

**Jing 2026-09-28:「这 14 个史诗画面肯定需要补的，但不是现在，请先标记好，将来做。」**

## 现状

这 14 首**音乐、歌词、封面、曲风全部齐备**，曲风串写得很完整（见下表）。
**唯独没有画面** —— 既没有成片 MV，也没有属于自己的幻灯帧。
播放时落到 `artifacts/mv-fallback/cover-317f1e76-*` 那套**982 个作品共用的通用兜底图**上，
与各自的歌毫无关系（实测两帧分别是「红衣女子提灯夜读」和「拉美庭院里的小男孩」）。

全平台真正只能看到兜底图的作品**就是这 14 个**（另有 3 个三部曲根节点、3 个空壳，性质不同）。

## 清单

| work_id | 标题 | 音轨 | 曲风 |
|---|---|---:|---|
| `1040ce1c-…` | Ezana | 2 | epic Ethiopian Aksum, krar and masenqo, begena harp, kebero drums, liturgical chant choir |
| `f467c6a7-…` | Pele | 2 | epic Hawaiian, pahu drums, ipu gourd, conch pu, oli chant choir |
| `4dab1768-…` | uShaka | 2 | epic Zulu, isigubhu drums, powerful male chant choir, call-and-response |
| `7733e91f-…` | Sundiata | 2 | epic West African Mande, kora, balafon, djembe and dunun drums, griot call-and-response |
| `0d8574c2-…` | Cocijo | 2 | epic Zapotec Mesoamerican, clay flutes, conch, teponaztli drums, ritual chant choir |
| `4f72b1e3-…` | Inti | 2 | epic Andean, panpipes zampona, quena flute, charango, frame drums, mountain choir |
| `a31d2cb7-…` | Tāwhirimātea | 2 | epic Polynesian, haka chant, log drums pate, conch putatara, powerful male choir |
| `828da8ba-…` | Ṣàngó | 2 | epic West African, talking drums, dundun and bata, call-and-response chorus |
| `918f2c5b-…` | Cú Chulainn | 2 | epic Celtic, bodhran, uilleann pipes, fiddle, tin whistle, Gaelic battle choir |
| `d35e5d11-…` | Gilgamesh | 2 | epic Mesopotamian, lyre of Ur, frame drums, reed flute, ancient chant choir |
| `980073fd-…` | Kukulkan | 2 | epic Maya, jungle ritual drums, ocarina, conch, ceremonial chant choir |
| `63114ee5-…` | Huitzilopochtli | 2 | epic Aztec, teponaztli and huehuetl drums, conch shell, clay flutes, ritual chant choir |
| `8e751d8e-…` | Valhǫll | 2 | epic Norse, war drums, throat singing, nyckelharpa, male battle choir |
| `86a49ef7-…` | Chase the Stars | 4 | 古风礼乐 / 编钟 / 琴瑟 / 庄重史诗 |

完整 uuid 见同目录 `todo-epic-visuals.csv`。

## 动手前必须遵守的

1. **先问 Jing 拿明确的 yes**（W2086 铁律：重新生成任何已存在的作品级媒体前必须先问）。
   补画面属于新增、不是覆盖，但**批量烧钱**的性质一样，照问。
2. **画幅 21:9**（`2520×1080`，`CINEMA_LANDSCAPE` 是唯一真源）。
3. **逐镜、正面表述**约束（W: 只给上限会被读成"放一个"，否定式无效）。
4. **内容哈希命名**落 R2，走 `uploadR2NeverOverwrite()`，绝不写死 `<workId>/固定名`。
5. **封面已有，不要动** —— 这 14 首的 `cover_image` 是齐的，只缺幻灯/成片。
6. **一个一个来，不并发**（厂商队列压垮过一次，111 镜挂 48 镜）。
7. 这 14 首是**各文明的神祇/英雄**，宗教敏感度高 —— 参照「宗教类厅必须人眼过目」，
   成品要 Jing 过目再上架。

8. **别从 `artifacts/mv-fallback/` 取图。** 查 codex 时发现**数字演员的参考肖像也存在这个命名空间**
   (`cover-317f1e76-*`) —— 今天看到的所谓"兜底幻灯"(红衣女子夜读 / 庭院小孩)**很可能就是演员肖像被复用**。
   从这个池子里补, 补完还是演员肖像, 等于没补。

## 别顺手做的事

那 982 个共用兜底图的作品里，**363 个有自己的成片 MV**（默认播真片，幻灯只在用户主动切
Visuals 才看到），**不在本待办范围内**。别因为"顺手一起补"把范围扩到 982。
