# Walk Into Van Gogh

**Play:** _link coming soon_

Three of Vincent van Gogh's paintings, turned into worlds you can walk into. Turn around and you see the half of the room, the street and the field that he never painted.

| Level | You do |
|---|---|
| The Bedroom · Arles, 1888 | Find his straw hat, hanging behind where he stood |
| Café Terrace at Night · Arles, 1888 | Gather three fallen stars in the half of the street he never painted |
| Wheatfield with Crows · Auvers-sur-Oise, July 1890 | Walk toward the horizon |

WASD to walk · Space to jump · click, then move the mouse to look.

## How it was made

No modelling, no rigging, no Blender.

1. **Worlds:** each painting went into [Viggle JST 2](https://viggle.ai/pinoc/app) through the PINOC MCP (`generate_environment`). One image, about a minute, 5–11 credits. JST 2 builds real 3D Gaussian splats, so the back of the room is there when you turn around.
2. **Vincent:** `generate_character` from one sentence, already rigged. Walk, idle and pick-up motions come from the free PINOC motion library.
3. **Game:** built with Claude Code on top of [`@viggle/splat-engine`](https://www.npmjs.com/package/@viggle/splat-engine). Walls and furniture are worked out from the splat point cloud itself (`tools/prep-scene.py`), so there are no hand-placed colliders.

The whole project used 146 PINOC credits, test scenes included.

## Make your own

```bash
npm install
npm run dev                     # http://localhost:5188
```

Add a painting as a new level: connect the PINOC MCP to Claude Code (or Cursor / Codex), drop the image into the chat, and ask it to follow [`CLAUDE.md`](CLAUDE.md). It covers the whole pipeline and every pitfall we hit, for example that PINOC returns SPZ v4 scenes which the web engine can't read yet.

```bash
claude mcp add --scope user --transport http pinoc https://pinoc.mcp.viggle.ai/mcp
python3 tools/prep-scene.py "<splatUrl>" --id my-painting
npm run test:flow               # headless Chrome plays all three levels
```

## Credits

- Paintings by Vincent van Gogh (public domain). Images via Wikimedia Commons.
- Quotes from Vincent's letters, English translations from [vangoghletters.org](https://vangoghletters.org) (Van Gogh Museum & Huygens ING). Chinese translations are ours.
- Worlds and character generated with Viggle JST 2. Engine: `@viggle/splat-engine` + PlayCanvas.
- Code: MIT.

---

## 中文说明

把梵高的三幅画变成可以走进去的世界。转身就能看到他从来没画过的那一半：卧室的另一面墙、咖啡馆身后的半条街、麦田小路的来处。

**怎么做的：** 每幅画丢给 Viggle JST 2（通过 PINOC MCP），一张图一分钟出一个真 3D 的高斯泼溅场景；梵高角色一句话生成，自带骨骼，动作用免费动作库；游戏用 Claude Code 写，碰撞直接从点云算，不用建模、不用绑骨、不用 Blender。

**自己做一个：** 让你的 agent 读 [`CLAUDE.md`](CLAUDE.md)，里面有从“一张画”到“一关游戏”的完整流程和我们踩过的所有坑。
