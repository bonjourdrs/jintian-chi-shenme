# v106 内置生图记录

工具：内置 `image_gen.imagegen`，按用户明确确认使用。接口不暴露具体模型版本，未把模型名称推定为 image2.5。所有最终图片均已复制进项目。下列为成功生成的原始提示词；独立双人插画曾有一次连接失败，重试后成功。

| 产物 | 文件 | 用途 |
| --- | --- | --- |
| UI 设计总图 | `design/v106/ui-design-board.png` | 六个核心页面、桌面布局和设计体系的实现参考 |
| 双人晚餐插画 | `public/assets/v106/dinner-couple.png` | 首页晚餐摘要、同步标识和引导 |
| 六格状态插画 | `public/assets/v106/state-illustrations.png` | 空菜单、采购、账本、搜索、收藏及主题引导；CSS 按格显示 |

设计稿 1536×1024 RGB；两张素材为 1536×1024 RGBA，已检查含透明区域。未把设计稿中的文字直接作为产品图片文字使用；界面中文由真实 HTML 控件呈现。按钮小字号的橙色在实现中略加深，以满足白字对比度；主视觉大按钮保留设计稿的亮橙。

## 1. UI 设计总图

```text
Use case: ui-mockup
Asset type: complete high-fidelity UI design board for an existing Chinese mobile-first dinner-planning PWA named 今天吃什么, for two people. This image will be the actual design reference used to rebuild the interface. Deliver a polished landscape design board with six large, clearly separated phone screen designs (not devices photographed on a table), a small desktop layout inset and concise design tokens. Prioritize readable Chinese labels and real, plausible app content.
Primary request: redesign all core user tasks with one coherent, tasteful visual language: 1 home with prominent 今晚吃什么 heading, two-person dinner summary, primary 摇一桌 button, search, small curated recipe cards; 2 菜单 catalog with category pills and food-photo card grid; 3 菜品详情 香辣花甲虾 with real food photo, 2人, 食材 with 花甲 400克 and 基围虾 200克, 做法, 今晚就做 primary; 4 今晚 with 3 selected dishes and one soup, adjust portions and 去采购; 5 采购清单 with readable checkboxes, amounts, main ingredients vs seasonings, optional subtle source labels; 6 我们的账本 with two personal recipe notes, add button and a small two-person sync/settings entry. Global navigation must use 菜单 / 今晚 / 采购 / 账本 / 我们, consistent icons and active state. Include subtle favorite, empty/loading/error/offline status samples in the design token area if space allows.
Style/medium: premium yet friendly everyday cooking app, editorial clarity, clean components, restrained warm feeling, excellent typographic hierarchy, spacious touch targets, real food photographs and a few small hand-drawn kitchen illustrations. The visual designer should choose a harmonious restrained palette and show exact color swatches, type scale, radii and spacing. Keep decoration subordinate to practical cooking tasks. Desktop inset should show an expanded sidebar with the same navigation and a useful two-column dinner layout.
Constraints: flat screen designs, no perspective, no watermark, no developer implementation text, no fake shopping-cart integration or payment flow. Do not show the app as one large flat poster: make each screen a coherent usable UI. All visible interface copy must be Chinese. Large enough screen layouts to inspect and implement.
```

透明背景：false。

## 2. 双人晚餐插画

```text
Use case: illustration-story
Asset type: production transparent hero illustration for a Chinese two-person dinner planning app called 今天吃什么. Create ONLY two young adults sharing a home-cooked dinner: person on left wears muted sage green, person on right wears warm apricot, ceramic rice bowls and chopsticks, one shared vegetable plate on a simple table, small green sprigs at the sides. Balanced horizontal composition, friendly warm everyday happiness. Modern crisp dark-brown hand-drawn outlines and restrained flat apricot, sage and cream color fills with a tiny amount of watercolor texture. All objects contained inside frame, generous negative space around figures, front view. It must work as a small clean app illustration at 220–500 CSS pixels wide. Transparent background. No text, logo, mockup, UI, border, photorealism, extra objects or characters.
```

透明背景：true。

## 3. 状态插画

```text
Use case: illustration-story
Asset type: production UI illustration sprite sheet for a friendly two-person Chinese dinner app. One exact 3-column by 2-row grid on a transparent canvas, six equal square cells. No visible grid lines. In every cell center ONE small illustration in the same hand-drawn dark-brown outline with softly textured cream, apricot-orange and sage-green fills. Keep every illustration inside the center 65 percent of its square cell, with generous transparent padding. Equal object scale. Order is essential: top left an empty ceramic dinner plate with chopsticks (no meal selected); top center a small empty woven grocery basket with a single green leaf (empty shopping list); top right a closed notebook and pencil (empty personal recipe ledger); bottom left a magnifying glass and small tomato (no search results); bottom center a ceramic rice bowl with one small heart above it (no favorites yet); bottom right two simple overlapping color palette cards with a tiny green sprig (theme selection). Cozy modern app illustration matching cream/orange everyday cooking UI. Flat front or gentle overhead views. Transparent background in every cell. No text, labels, letters, numbers, UI, border, watermark, perspective mockups, or extra illustrations. The sheet will be displayed via CSS background positions, so exact regular grid alignment is mandatory.
```

透明背景：true。
