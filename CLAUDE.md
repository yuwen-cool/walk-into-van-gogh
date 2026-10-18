# 给 agent 的说明：把一幅画变成一关

这个项目用 Viggle JST 2（经 PINOC MCP）把画变成能走进去的高斯泼溅场景，用 `@viggle/splat-engine`（PlayCanvas）在网页里跑。下面是加一关的完整流程，以及实测踩过的坑。

## 0. 连上 PINOC MCP
```
claude mcp add --scope user --transport http pinoc https://pinoc.mcp.viggle.ai/mcp
```
新会话里 `/mcp` 登录（Google 授权，Read 免费，Generate 扣积分）。先调 `get_credit_balance` 看余额。

## 1. 生成场景（约 1–2 分钟，5–11 积分）
- 画放到 `public/paintings/<id>.jpg`，长边不超过 2048 像素（4000 像素的图实测生成失败过）。
- 用户把图拖进对话：`generate_environment` 传 `referenceImageFile`。**一定再加一句美术方向的 `prompt` 和 `quality: "high"`**，例如“…as a walkable place: …, museum-quality oil painting world, thick crisp impasto brushstrokes with sharp defined edges, high detail, clean and vivid, no blur, no haze, no fog”。实测这样比只传图明显更锐、更通透；《星月夜》只传图加高画质会生成失败，加了描述就成功。
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

## 4. 关卡配置（`src/levels.js`）
- 坐标约定：场景原点是画家的眼睛，地面 y=0，单位米。原画构图**不一定**在 -Z：重新生成的场景朝向会变，先在 `film.html` 里用 `film.still(t, pitch, yaw, id)` 环绕截 6 张图，找到和原画一致的方向，填 `yaw0`（例：咖啡馆是 80）。转身 180° 就是画家没画过的那一半，玩家转过身，下一幅画的画框就出现在身后。
- 原画构图很广（如《星月夜》柏树在左侧约 65°）时，用 `introYaw` + `introFov` 让开场的“画化开”对得上。
- 画家正对着河、湖这类场景，第三人称会把人和镜头放到稀疏的水面上，用 `firstPerson: true`。
- `living`：`flow` 笔触流动幅度；`vortices` 漩涡中心（在仰视画面里量像素位置，再换算成 pitch / yaw）；`wave` 麦浪。
- 想找画里某个东西的坐标：在 ply 里按颜色和方向角筛点，不要凭感觉估。

## 5. 验证
```
npm run dev
npm run test:flow       # 无头 Chrome 跑完四关，截图在 test/shots/
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
| 想让画动起来 | `src/living.js`：替换引擎的 `modifySplatCenter`，`workBufferUpdate = 2` 每帧重算，`uTime` 走 uniform |
| 角色像贴上去的 | `src/paint.js`：只改这个角色的工作缓冲着色器，拉长泼溅、加稳定的碎色。强度别太大，`scale 1.3 / stretch 2.3` 已经糊成一团 |
| PINOC 调用一直超时 | 多半是之前超时的 mcp-remote 子进程没退出、占着授权。清掉孤儿进程；自己的脚本要在 finally 里关掉子进程 |
| 长时间逐帧渲染中途崩溃 | 浏览器越跑越慢最后崩。用打包后的静态页渲染，分段（每 150 帧）重开浏览器，`RESUME=1` 续渲 |
