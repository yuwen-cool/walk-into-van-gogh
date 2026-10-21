# Walk Into Van Gogh

**Play:** https://yuwen-cool.github.io/walk-into-van-gogh/ (desktop browser, keyboard + mouse)

Four of Vincent van Gogh's paintings, turned into worlds you can walk into. Every painting shows only what was in front of him. Turn around, and you see the half he never painted.

| Painting | |
|---|---|
| The Starry Night · Saint-Rémy, June 1889 | The swirls overhead actually turn |
| Café Terrace at Night · Arles, September 1888 | Behind him: a lamplit street under the stars |
| Starry Night Over the Rhône · Arles, 1888 | Seen through his own eyes, the town on the bank behind |
| Wheatfield with Crows · Auvers-sur-Oise, July 1890 | Walk toward the horizon |

WASD to walk · click, then move the mouse to look · turn around to find the next painting.

## How it was made

No modelling, no rigging, no Blender.

1. **Worlds (Viggle JST 2):** each painting went to `generate_environment` through the PINOC MCP, together with a short art-direction prompt and `quality: "high"`. One image, a minute or two, 5–11 credits. JST 2 builds real 3D Gaussian splats, so the other half is there when you turn around.
2. **Vincent (Viggle JST 2):** `generate_character` from one sentence, already rigged; walk and idle come from the free PINOC motion library.
3. **Code (Claude Code):** everything that moves or glows is code layered on top of the splats.
   - `src/living.js` rewrites the splat shader so every brushstroke drifts along its own direction, the Starry Night vortices spin and the wheat sways.
   - `src/paint.js` stretches Vincent's splats into strokes and breaks up his colours, so he looks painted rather than pasted in.
   - `src/fx.js` adds dust, lamp sparks, glints on the water and wheat chaff.
   - Walls and furniture are worked out from the point cloud itself (`tools/prep-scene.py`); there are no hand-placed colliders.

`film.html` + `test/render-film.mjs` render the 60-second film frame by frame (4K supersampled down to 1080p).

## Make your own

```bash
npm install
npm run dev                     # http://localhost:5188
```

Add a painting as a new level: connect the PINOC MCP to Claude Code (or Cursor / Codex), drop the image into the chat, and ask it to follow [`CLAUDE.md`](CLAUDE.md). It covers the whole pipeline and every pitfall we hit, for example that PINOC returns SPZ v4 scenes which the web engine can't read yet.

```bash
claude mcp add --scope user --transport http pinoc https://pinoc.mcp.viggle.ai/mcp
python3 tools/prep-scene.py "<splatUrl>" --id my-painting
npm run test:flow               # headless Chrome plays all four paintings
```

## Credits

- Paintings by Vincent van Gogh (public domain). Images via Wikimedia Commons.
- Quotes from Vincent's letters, English translations from [vangoghletters.org](https://vangoghletters.org) (Van Gogh Museum & Huygens ING). Chinese translations are ours.
- Worlds and character generated with Viggle JST 2. Engine: `@viggle/splat-engine` + PlayCanvas.
- Code: MIT.

---

## 中文说明

试玩：https://yuwen-cool.github.io/walk-into-van-gogh/ （电脑浏览器，键盘加鼠标）

梵高每一幅画，都只画了眼前的那一半。这里把他的四幅画变成可以走进去的世界，转过身，就能看到他从来没画过的另一半：《星月夜》头顶的漩涡在转，咖啡馆身后是亮着路灯的星空街道，罗纳河对岸的小镇亮着窗，最后是 1890 年 7 月的麦田。

**怎么做的：**
- **世界和角色（Viggle JST 2）：** 每幅画加一句美术方向描述，通过 PINOC MCP 生成一个高斯泼溅的真 3D 场景（一两分钟）；梵高这个角色用文字描述生成，自带骨骼，动作用免费动作库。
- **代码（Claude Code）：** 改泼溅着色器让笔触流动、漩涡旋转、麦浪起伏；给梵高加油画质感；加光尘、灯火、水面光点；碰撞直接从点云算。

**自己做一个：** 让你的 agent 读 [`CLAUDE.md`](CLAUDE.md)，里面有从“一张画”到“一关”的完整流程和我们踩过的所有坑。
