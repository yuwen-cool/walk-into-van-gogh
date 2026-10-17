# 给 agent 的说明：把一幅画变成一关

这个项目用 Viggle JST 2（经 PINOC MCP）把画变成能走进去的高斯泼溅场景，用 `@viggle/splat-engine`（PlayCanvas）在网页里跑。下面是加一关的完整流程，以及实测踩过的坑。

## 0. 连上 PINOC MCP
```
claude mcp add --scope user --transport http pinoc https://pinoc.mcp.viggle.ai/mcp
```
新会话里 `/mcp` 登录（Google 授权，Read 免费，Generate 扣积分）。先调 `get_credit_balance` 看余额。

## 1. 生成场景（约 1–2 分钟，5–11 积分）
- 画放到 `public/paintings/<id>.jpg`，长边不超过 2048 像素（4000 像素的图实测生成失败过）。
- 用户把图拖进对话：`generate_environment` 传 `referenceImageFile`，不用写 prompt。
  本地文件：先 `prepare_upload`，跑它返回的 curl，再传 `referenceUploadKey`。
- `wait_for_tasks`（kind: `environment`）。场景先出，之后 PINOC 会自动补全最多两次（每次 3 积分），再等两分钟用 `search_library` 或 `list_my_environments` 拿最新的 `splatUrl`（URL 里 `iter/2` 是补全后的版本）。

## 2. 处理场景
```
python3 tools/prep-scene.py "<splatUrl>" --id <id>            # 室内
python3 tools/prep-scene.py "<splatUrl>" --id <id> --open 4   # 麦田、草地这类能穿行的开放场景
```
它会输出 `public/scenes/<id>.compressed.ply`、`public/levels/<id>.grid.json`，并打印关卡配置，粘进 `src/levels.js`。

## 3. 角色和动作
- 角色：`generate_character`（文字或 1–5 张照片，约 6 分钟，10 积分）。画风要和场景一致，就在 prompt 里写画家的笔触风格。
  `get_asset` 取 `high` 档（约 1.3MB）的 URL，curl 到 `public/characters/`。
- 动作：先 `list_motion_library`（108 条，免费），再 `take_library_motions`，然后 `get_asset` 传 `format: "splat-skeleton-glb"`，curl 到 `public/motions/`。

## 4. 摆任务物件和传送门
- 坐标约定：场景原点是画家的眼睛；从原点朝 **-Z** 看就是原画构图，**+Z** 是画家身后、原画里没有的那一半。地面 y=0，单位米。
- `items` 里的物件放在 +Z 那一侧，玩家就会转身去看画家没画过的地方。这是这个项目最好看的一刻。
- 想找画里某个东西的坐标：在 ply 里按颜色和方向角筛点（参考 git 历史里找草帽的做法），不要凭感觉估。

## 5. 验证
```
npm run dev
npm run test:flow       # 无头 Chrome 跑完三关，截图在 test/shots/
```
内置浏览器面板被隐藏时页面会停止渲染，用 `test/drive.mjs` 驱动本机 Chrome 更稳。

## 实测踩过的坑
| 现象 | 原因和做法 |
|---|---|
| Spark / `@viggle/splat-engine` 报 gzip 错误 | MCP 给的是 SPZ v4（zstd），用 splat-transform 转 `.compressed.ply`（prep-scene.py 已处理） |
| 场景倒着、角色陷进地里 | 场景单位不固定，原点是拍摄点。prep-scene.py 从原点往下找地面 |
| 房间和家具偏大 | “原点离地 1.5 米”只是假设。卧室实测要用 `--eye 1.2` 左右（scale 2.5） |
| 光球、画框被场景盖住看不见 | WebGPU 下泼溅走计算着色器，不和普通网格做深度合成。`Scene.create` 用 `backend: 'webgl'` + `depth: true` |
| 叠加光晕变成一整块亮板 | 用 `BLEND_ADDITIVEALPHA`，`BLEND_ADDITIVE` 不吃透明度 |
| WebGPU 下贴图报 Unsupported texture source | 用 `createImageBitmap` |
| 动作库同名动作有两个 id | 其中一个查不到，`get_asset` 能返回的那个才是 |
| 角色穿墙、镜头跑到墙外 | `levels/*.grid.json` 管角色和镜头，镜头被挡时自动拉近抬高 |
| 角色总画在场景前面 | 两个泼溅之间只按绘制顺序叠，不做深度遮挡。别让角色走到家具后面 |
