# Fruit Synthesis (合成大西瓜) - Code Wiki

## 1. 项目整体架构 (Project Architecture)

本项目是一个基于 **Cocos Creator 3.8.8** 引擎开发的 2D 休闲类游戏，核心玩法类似于经典的“合成大西瓜”。
游戏采用 TypeScript 作为主要开发语言，利用 Cocos Creator 内置的 2D 物理引擎 (Box2D) 来模拟水果下落、碰撞、堆叠和挤压的物理效果。

### 核心运行机制：
1. **交互下落**：玩家在屏幕上方左右滑动来决定水果初始位置，松手后水果受重力自由下落。
2. **物理碰撞**：水果通过 `CircleCollider2D` 和 `RigidBody2D` 进行物理交互。
3. **合成升级**：当两个具有相同 ID (等级) 的水果发生物理碰撞时，它们会销毁自身并在中心点生成一个更高等级的新水果。
4. **游戏结束**：当水果堆积高度超过指定的死亡线 (`DeathZone`) 且完全静止时，触发游戏结束。

---

## 2. 主要模块职责 (Main Modules)

项目代码集中在 `assets/Script` 目录下，按照功能划分为以下几个主要模块：

| 模块名称 | 文件 | 职责描述 |
| :--- | :--- | :--- |
| **游戏主控模块** | `GameManager.ts` | 控制游戏生命周期、屏幕边界适配、水果生成、输入交互以及全局状态判定（如游戏结束）。 |
| **水果逻辑模块** | `Fruit.ts` | 挂载在水果预制体上，负责单个水果的初始化、物理碰撞检测、合成逻辑以及动态物理属性（阻尼、弹性）调整。 |
| **UI数值模块** | `UIManager.ts` | 负责游戏分数记录、UI 文本更新、游戏结束界面的显示及重玩操作。 |
| **音效管理模块** | `AudioManager.ts` | 采用单例模式，负责音效资源的预加载以及播放（合成音效、消除音效等）。 |
| **边界判定模块** | `DeathZone.ts` | 用于顶部死亡线区域，利用碰撞体监听进入该区域的水果，并向 `GameManager` 汇报。 |
| **微信平台模块** | `WeChat/WXManager.ts` | 封装微信小游戏平台的原生 API，处理登录、分享、排行榜和短震动反馈。 |
| **配置数据模块** | `Constants.ts` | 统一定义游戏常量，包括各等级水果的配置（半径、得分、贴图）、物理层级以及坐标高度常量。 |

---

## 3. 关键类与函数说明 (Key Classes & Functions)

### 3.1 GameManager (游戏主控)
负责全局调度的核心类。
* **`onLoad()`**: 初始化物理系统，**提升物理系统的迭代次数** (`velocityIterations` 和 `positionIterations`) 以增强水果堆叠的稳定性；同时预加载所有水果贴图。
* **`adjustWalls()`**: 响应式适配函数，根据不同设备的屏幕宽度，动态计算并调整左右物理墙壁及视觉边界的位置，防止水果掉出屏幕。
* **`spawnNextFruit()`**: 在顶部生成一个新的水果，随机初始等级为 0-4（葡萄到猕猴桃）。此时水果设为**运动学刚体** (Kinematic)，不掉落。
* **`onTouchStart` / `onTouchMove` / `onTouchEnd`**: 监听用户触摸事件，更新水果的X轴位置；松手时将水果刚体切换为**动态** (Dynamic)，触发下落。
* **`onFruitMerge(newId: number, position: Vec3)`**: 被 `Fruit.ts` 调用。负责播放音效、增加分数并在合成位置实例化高一级的新水果。
* **`checkGameOver(dt: number)`**: 在 `update` 中持续检测，若有水果停留在死亡线上方且速度极小，则触发游戏结束。

### 3.2 Fruit (水果逻辑)
处理物理微操和核心合成规则。
* **`init(id: number, spriteFrame: SpriteFrame)`**: 根据传入的 ID 从 `Constants.ts` 读取配置，设置碰撞体半径。**动态分配重力比例**：水果越大，重力越大 (`0.5 + id * 0.2`)，使大水果能压住小水果，防止下部反弹导致整体崩溃。
* **`onBeginContact(...)`**: 物理引擎的碰撞回调。
   * **去抖动处理**：如果两水果相对速度较小，临时将恢复系数 (`restitution`) 设为0，防止轻微挤压时持续弹跳。
   * **合成判定**：如果碰到相同 ID 的水果，通过比较 `uuid` 确保合成逻辑只执行一次，随后延迟一帧调用 `merge()`。
* **`update(dt: number)`**: 动态阻尼策略。当水果处于挤压状态（`_contactCount > 0`）时，大幅增加阻尼；在空中时保持低阻尼，实现流畅下落。
* **`merge(other: Fruit)`**: 计算两个水果的中心点坐标，销毁二者，并通知 `GameManager` 生成新水果。

### 3.3 UIManager (UI数值)
* **`addScore(points: number)`**: 累加分数并刷新界面。
* **`onRestartClicked()`**: 绑定在结束界面的重新开始按钮上，通过 `director.loadScene` 重新加载当前场景。

### 3.4 WXManager (微信接口)
* **`initShare()`**: 注册微信右上角的转发与分享朋友圈菜单。
* **`vibrateShort()`**: 在水果合成时调用，触发手机的轻微震动反馈。

---

## 4. 依赖关系 (Dependencies)

* **引擎依赖**：深度依赖 `cc` 模块 (Cocos Creator API)，尤其是 `PhysicsSystem2D`, `RigidBody2D`, `Collider2D` 等 2D 物理组件。
* **外部依赖**：微信小游戏 API (`wx`)，通过 `declare const wx: any;` 绕过 TS 检查，实际运行时依赖微信环境。代码中做了环境判断 (`typeof wx !== 'undefined'`)，确保在 Web 浏览器预览时不会报错。

---

## 5. 项目运行与构建方式 (How to Run & Build)

### 环境要求
* 操作系统：Windows / macOS
* 编辑器版本：**Cocos Creator 3.8.8** (由 `package.json` 中的 `creator.version` 确认)

### 运行方式
1. 打开 Cocos Creator 3.8.8 Dashboard，点击“添加”并选择本项目的根目录 `/Users/panhaiqi/githubObject/fruit_synthesis`。
2. 双击打开项目，等待引擎导入并编译资源。
3. 在资源管理器 (`Assets`) 中找到 `assets/Scene/main.scene`，双击打开主场景。
4. 点击编辑器正上方的 **预览 (Play)** 按钮（或按 `Ctrl+P` / `Cmd+P`），即可在浏览器中预览游戏。

### 构建发布
1. 在顶部菜单栏选择 **项目 (Project) -> 构建发布 (Build...)**。
2. 若要发布网页版：发布平台选择 **Web Desktop** 或 **Web Mobile**，点击“构建”。
3. 若要发布微信小游戏：
   * 发布平台选择 **WeChat Mini Game**。
   * 填写小游戏 AppID。
   * 构建完成后，使用“微信开发者工具”打开构建生成的 `build/wechatgame` 目录即可真机预览和上传。
