
import { _decorator, Component, Node, Vec3, Vec2, PhysicsSystem2D, RigidBody2D, ERigidBody2DType, instantiate, Prefab, UITransform, EventTouch, v2, v3, director, resources, SpriteFrame, isValid, Size, view, screen } from 'cc';
import { FRUIT_CONFIGS, GAME_CONSTANTS } from './Constants';
import { Fruit } from './Fruit';
import { UIManager } from './UIManager';
import { WXManager } from './WeChat/WXManager';
import { AudioManager } from './AudioManager';
import { BoxCollider2D } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {

    @property(Prefab)
    fruitPrefab: Prefab | null = null; // 水果预制体

    @property(Node)
    fruitContainer: Node | null = null; // 水果生成的容器节点

    @property(UIManager)
    uiManager: UIManager | null = null; // UI管理器引用

    @property(Node)
    deathLine: Node | null = null; // 死亡线节点

    @property(AudioManager)
    audioManager: AudioManager | null = null; // 音效管理器

    @property({ type: Node, tooltip: '水果生成的初始位置节点，用于控制生成高度和初始X轴位置' })
    spawnPoint: Node | null = null;

    @property({ type: Node, tooltip: '左侧物理墙壁' })
    leftWall: Node | null = null;

    @property({ type: Node, tooltip: '右侧物理墙壁' })
    rightWall: Node | null = null;

    @property({ type: Node, tooltip: '左侧视觉边界' })
    leftBorder: Node | null = null;

    @property({ type: Node, tooltip: '右侧视觉边界' })
    rightBorder: Node | null = null;

    @property({ tooltip: '游戏区域的最大宽度，超过此宽度的屏幕将增加墙壁厚度' })
    maxGameWidth: number = 600;

    private _currentFruit: Node | null = null; // 当前正在操作的水果
    private _canSpawn: boolean = true; // 是否可以生成新水果
    private _isGameOver: boolean = false; // 游戏是否结束
    private _fruitSpriteFrames: Map<string, SpriteFrame> = new Map(); // 预加载的水果图片
    private _limitX: number = 300; // 水果移动的X轴限制
    private _gameAreaHalfWidth: number = 300; // 游戏区域的一半宽度
    
    // 新增属性用于控制生成逻辑
    private _waitingForCollision: boolean = false;
    private _droppedFruitNode: Node | null = null;
    private _collisionWaitTimer: number = 0;
    private _gameOverTimer: number = 0; // 游戏结束判定计时器

    onLoad() {
        // 初始化 2D 物理系统，确保在游戏开始前物理引擎就绪
        if (PhysicsSystem2D.instance) {
            PhysicsSystem2D.instance.enable = true;

            // 增加物理迭代次数，提高模拟精度，减少穿透和抖动
            // 默认值通常为 10，提高到 20 或 30 可以显著改善堆叠稳定性
            PhysicsSystem2D.instance.velocityIterations = 20; 
            PhysicsSystem2D.instance.positionIterations = 20;
            
            // 打印当前重力设置，方便调试
            console.log(`[GameManager] Physics Configured: Gravity=${PhysicsSystem2D.instance.gravity}, VelIter=${PhysicsSystem2D.instance.velocityIterations}, PosIter=${PhysicsSystem2D.instance.positionIterations}`);
        }

        // 预加载所有水果图片
        this.preloadFruitSprites();
    }

    /**
     * 预加载所有水果图片资源，防止生成时出现空白占位
     */
    preloadFruitSprites() {
        FRUIT_CONFIGS.forEach(config => {
            const path = `fruits/${config.spriteName}/spriteFrame`;
            resources.load(path, SpriteFrame, (err, spriteFrame) => {
                if (err) {
                    console.error(`[GameManager] Failed to preload fruit sprite: ${path}`, err);
                    return;
                }
                console.log(`[GameManager] Preloaded sprite: ${config.spriteName}`);
                this._fruitSpriteFrames.set(config.spriteName, spriteFrame);
            });
        });
    }

    start() {
        // 尝试自动获取 AudioManager（如果在同一节点或场景中）
        if (!this.audioManager) {
            this.audioManager = this.getComponent(AudioManager);
            if (!this.audioManager) {
                 // 也可以查找场景中的其他节点
                 const audioNode = this.node.scene.getChildByName('AudioManager'); // 假设有个节点叫这个
                 if (audioNode) {
                     this.audioManager = audioNode.getComponent(AudioManager);
                 }
                 // 或者使用单例访问
            }
        }

        // 调整墙壁位置以适配屏幕
        this.adjustWalls();
        
        // 监听屏幕尺寸变化，实时调整墙壁
        view.on('canvas-resize', this.adjustWalls, this);

        // 注册输入事件监听
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        // 添加 TOUCH_CANCEL 监听，防止意外中断触摸（如弹窗）导致逻辑错误
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        // 延迟一帧生成第一个水果，确保物理系统已完全初始化
        this.scheduleOnce(() => {
            this.spawnNextFruit();
        }, 0);
    }

    onDestroy() {
        view.off('canvas-resize', this.adjustWalls, this);
    }

    /**
     * 根据屏幕宽度调整墙壁位置和厚度
     */
    adjustWalls() {
        const canvas = this.node.scene.getChildByName('Canvas');
        if (!canvas) return;

        const transform = canvas.getComponent(UITransform);
        if (!transform) return;

        const screenWidth = transform.width;
        const screenHeight = transform.height;
        
        // 自动查找未绑定的节点
        if (!this.leftWall) this.leftWall = canvas.getChildByPath('Wall/LeftWall');
        if (!this.rightWall) this.rightWall = canvas.getChildByPath('Wall/RightWall');
        if (!this.leftBorder) this.leftBorder = canvas.getChildByPath('Border_Left');
        if (!this.rightBorder) this.rightBorder = canvas.getChildByPath('Border_Right');

        // 确保 Wall 容器节点没有缩放，防止物理墙壁坐标偏移
        const wallNode = canvas.getChildByName('Wall');
        if (wallNode) {
            wallNode.setScale(1, 1, 1);
            wallNode.setPosition(0, 0, 0);
        }

        // 计算目标游戏区域宽度
        // 如果屏幕很窄，就用屏幕宽度；如果屏幕很宽，最大不超过 maxGameWidth
        const targetWidth = Math.min(this.maxGameWidth, screenWidth);
        const halfWidth = targetWidth / 2;
        this._gameAreaHalfWidth = halfWidth;

        // 计算墙壁宽度：填满屏幕边缘到游戏区域边缘的空间
        // 屏幕左边缘 x = -screenWidth / 2
        // 游戏区域左边缘 x = -halfWidth
        // 墙壁宽度 = (-halfWidth) - (-screenWidth / 2) = screenWidth / 2 - halfWidth
        // 保证最小宽度，避免负数或过薄
        const wallWidth = Math.max(50, (screenWidth / 2) - halfWidth);
        
        // 计算统一的高度，覆盖整个屏幕，防止上下露馅
        const wallHeight = Math.max(screenHeight, 2000);

        // 更新左侧物理墙壁
        if (this.leftWall) {
            const tf = this.leftWall.getComponent(UITransform);
            if (tf) {
                tf.setContentSize(wallWidth, wallHeight);
                // 内边缘 = -halfWidth. 中心 = -halfWidth - wallWidth / 2.
                this.leftWall.setPosition(-halfWidth - wallWidth / 2, 0); // Y 轴归零
            }
            const collider = this.leftWall.getComponent(BoxCollider2D);
            if (collider) {
                collider.size = new Size(wallWidth, wallHeight);
                collider.offset = v2(0, 0); // 确保 offset 归零
                collider.apply(); // 强制应用修改（如果需要）
            }
        }

        // 更新右侧物理墙壁
        if (this.rightWall) {
            const tf = this.rightWall.getComponent(UITransform);
            if (tf) {
                tf.setContentSize(wallWidth, wallHeight);
                // 内边缘 = halfWidth. 中心 = halfWidth + wallWidth / 2.
                this.rightWall.setPosition(halfWidth + wallWidth / 2, 0); // Y 轴归零
            }
            const collider = this.rightWall.getComponent(BoxCollider2D);
            if (collider) {
                collider.size = new Size(wallWidth, wallHeight);
                collider.offset = v2(0, 0); // 确保 offset 归零
                collider.apply();
            }
        }

        // 更新左侧视觉边界 (Sprite)
        if (this.leftBorder) {
            const tf = this.leftBorder.getComponent(UITransform);
            if (tf) {
                tf.setContentSize(wallWidth, wallHeight);
                this.leftBorder.setPosition(-halfWidth - wallWidth / 2, 0); // Y 轴归零
            }
        }

        // 更新右侧视觉边界 (Sprite)
        if (this.rightBorder) {
            const tf = this.rightBorder.getComponent(UITransform);
            if (tf) {
                tf.setContentSize(wallWidth, wallHeight);
                this.rightBorder.setPosition(halfWidth + wallWidth / 2, 0); // Y 轴归零
            }
        }

        // 更新水果移动限制
        // 留出一点边距，避免水果紧贴墙壁
        this._limitX = Math.max(0, halfWidth - 35);
        
        console.log(`[GameManager] Walls adjusted. Screen: ${screenWidth}x${screenHeight}, TargetWidth: ${targetWidth}, WallWidth: ${wallWidth}, LimitX: ${this._limitX}`);
    }

    update(dt: number) {
        if (this._isGameOver) return;

        // 检查掉落的水果是否发生碰撞
        if (this._waitingForCollision) {
            this._collisionWaitTimer += dt;

            // 1. 安全超时：如果超过 3 秒还没检测到碰撞（比如掉出屏幕外未触发销毁），强制恢复生成
            if (this._collisionWaitTimer > 3.0) {
                console.warn("[GameManager] Wait collision timeout. Force spawning next.");
                this._finishDropWait();
                return;
            }

            // 2. 检查水果节点状态
            if (isValid(this._droppedFruitNode)) {
                // isValid 检查通过说明不为 null 且未被销毁
                const fruitComp = this._droppedFruitNode!.getComponent(Fruit);
                // 如果水果已经发生碰撞
                if (fruitComp && fruitComp.hasCollided) {
                    console.log("[GameManager] Fruit collision detected.");
                    this._finishDropWait();
                }
            } else {
                // 3. 节点已销毁（可能是瞬间合并或者被销毁），视为已完成
                console.log("[GameManager] Dropped fruit node destroyed. Spawning next.");
                this._finishDropWait();
            }
        }

        // 每一帧都检查是否有水果超过死亡线且静止
        this.checkGameOver(dt);
    }

    /**
     * 检查游戏结束条件：是否有水果堆叠超过死亡线并保持静止
     */
    checkGameOver(dt: number) {
        if (this._isGameOver || !this.fruitContainer) return;

        // 获取死亡线高度，优先使用节点位置，否则使用常量
        const deathY = this.deathLine ? this.deathLine.position.y : GAME_CONSTANTS.DEAD_LINE_Y;
        let isAnyFruitAboveLine = false;

        for (const child of this.fruitContainer.children) {
            // 忽略当前正在拖拽的水果
            if (child === this._currentFruit) continue;
            
            // 忽略正在下落且未发生碰撞的水果，避免刚生成时误判
            if (child === this._droppedFruitNode) continue;
            
            if (!child.active) continue;

            // 检查位置是否高于死亡线
            // 这里的 y 是相对于 fruitContainer 的局部坐标
            // 假设 fruitContainer 和 deathLine 在同一坐标系下（通常是 Canvas 子节点）
            if (child.position.y > deathY) {
                const rb = child.getComponent(RigidBody2D);
                // 检查速度是否足够小（静止状态）
                if (rb && rb.linearVelocity.length() < 5.0) {
                    isAnyFruitAboveLine = true;
                    break;
                }
            }
        }

        if (isAnyFruitAboveLine) {
            this._gameOverTimer += dt;
            // 如果状态持续超过 1.0 秒，触发游戏结束
            if (this._gameOverTimer > 1.0) {
                console.log("[GameManager] Game Over: Fruit stack reached death line.");
                this.gameOver();
            }
        } else {
            // 只要有一帧不满足条件，就重置计时器
            this._gameOverTimer = 0;
        }
    }

    /**
     * 结束等待掉落，准备生成下一个
     */
    private _finishDropWait() {
        this._waitingForCollision = false;
        this._droppedFruitNode = null;
        
        // 稍微延迟一小段时间再生成，给予视觉缓冲
        this.scheduleOnce(() => {
            if (!this._isGameOver) {
                this._canSpawn = true;
                this.spawnNextFruit();
            }
        }, 0.1);
    }

    /**
     * 生成下一个等待掉落的水果
     */
    spawnNextFruit() {
        if (!this._canSpawn || this._isGameOver) return;
        
        // 随机生成水果 ID (0-4: 对应从葡萄到奇异果)
        // Math.random() 生成 [0, 1) 的随机小数
        // 乘以 5 后范围变为 [0, 5)
        // Math.floor 向下取整，最终得到 0, 1, 2, 3, 4 这 5 个整数
        // 这代表了最初始的 5 种水果类型，避免生成过大的水果导致游戏过难
        const id = Math.floor(Math.random() * 5);
        
        // 实例化水果并设置到容器中
        if (this.fruitPrefab && this.fruitContainer) {
            this._currentFruit = instantiate(this.fruitPrefab);
            
            // 拖拽阶段设置为运动学类型，不受重力影响但可以跟随手指移动
            // 在 addChild 之前设置，避免物理系统未就绪时的报错
            const rb = this._currentFruit.getComponent(RigidBody2D);
            if (rb) {
                rb.type = ERigidBody2DType.Kinematic;
            }

            this.fruitContainer.addChild(this._currentFruit);
            
            // 确保水果 Layer 与容器一致，避免 Camera 渲染问题
            this._currentFruit.layer = this.fruitContainer.layer;

            const fruitComp = this._currentFruit.getComponent(Fruit);
            if (fruitComp) {
                // 传入预加载的 SpriteFrame
                const config = FRUIT_CONFIGS[id];
                const spriteFrame = this._fruitSpriteFrames.get(config.spriteName) || null;
                if (!spriteFrame) {
                    console.warn(`[GameManager] SpriteFrame not found in preload cache for: ${config.spriteName}`);
                }
                fruitComp.init(id, spriteFrame);
                fruitComp.setGameManager(this);
            }
            
            // 设置初始位置
            // 优化：优先使用 spawnPoint 节点的位置，如果未设置则使用默认高度
            const spawnY = this.spawnPoint ? this.spawnPoint.position.y : GAME_CONSTANTS.SPAWN_Y;
            this._currentFruit.setPosition(0, spawnY, 0);
        }
    }

    onTouchStart(event: EventTouch) {
        if (!this._canSpawn || !this._currentFruit || this._isGameOver) return;
        this.updateFruitPosition(event.getUILocation());
    }

    onTouchMove(event: EventTouch) {
        if (!this._canSpawn || !this._currentFruit || this._isGameOver) return;
        this.updateFruitPosition(event.getUILocation());
    }

    onTouchEnd() {
        if (!this._canSpawn || !this._currentFruit || this._isGameOver) return;
        
        console.log("[GameManager] Touch End - Releasing fruit");

        // 检查节点是否有效，防止在拖拽过程中因碰撞合并被销毁导致报错
        if (isValid(this._currentFruit)) {
            // 松开手指，将水果设为动态物理类型使其掉落
            const rb = this._currentFruit.getComponent(RigidBody2D);
            if (rb) {
                rb.type = ERigidBody2DType.Dynamic;
                rb.wakeUp();
                console.log("[GameManager] Fruit RigidBody set to Dynamic and Woken up");
            } else {
                console.warn("[GameManager] Fruit RigidBody component missing!");
            }
        } else {
            console.warn("[GameManager] Current fruit was destroyed before release (likely merged).");
        }
        
        this._droppedFruitNode = this._currentFruit; // 保存当前掉落的水果引用
        this._currentFruit = null;
        this._canSpawn = false;
        
        // 标记开始等待碰撞
        this._waitingForCollision = true;
        this._collisionWaitTimer = 0;
        
        console.log("[GameManager] Waiting for fruit collision...");
    }

    /**
     * 更新水果在水平方向上的位置
     */
    updateFruitPosition(screenPos: Vec2) {
        const transform = this.node.getComponent(UITransform);
        // 使用 isValid 检查节点是否已被销毁，防止访问已销毁节点的属性
        if (transform && isValid(this._currentFruit)) {
            const localPos = transform.convertToNodeSpaceAR(v3(screenPos.x, screenPos.y, 0));
            
            // 获取当前水果的半径
            let radius = 35; // 默认半径
            const fruitComp = this._currentFruit.getComponent(Fruit);
            if (fruitComp) {
                const config = FRUIT_CONFIGS[fruitComp.id];
                if (config) {
                    radius = config.radius;
                }
            }
            
            // 限制水果移动范围，防止超出边界
            // 使用游戏区域的一半宽度减去水果半径，确保水果完全在墙壁内
            // 额外减去 5 像素作为安全边距
            const limitX = Math.max(0, this._gameAreaHalfWidth - radius - 2);
            
            const x = Math.max(-limitX, Math.min(limitX, localPos.x));
            
            // 优化：优先使用 spawnPoint 节点的位置，确保拖拽时高度一致
            // 增加 isValid 检查，防止 spawnPoint 被销毁后访问报错
            const currentY = isValid(this.spawnPoint) ? this.spawnPoint.position.y : GAME_CONSTANTS.SPAWN_Y;
            this._currentFruit.setPosition(x, currentY, 0);
        }
    }

    /**
     * 当两个相同水果合成时调用
     */
    onFruitMerge(newId: number, position: Vec3) {
        if (this._isGameOver) return;
        
        console.log(`[GameManager] onFruitMerge called for ID: ${newId} at ${position}`);

        // 播放合成音效
        if (this.audioManager) {
            this.audioManager.playSound('synthesis');
        } else if (AudioManager.instance) {
             AudioManager.instance.playSound('synthesis');
        }

        // 增加得分并更新 UI
        if (this.uiManager) {
            const score = FRUIT_CONFIGS[newId] ? FRUIT_CONFIGS[newId].score : 0;
            this.uiManager.addScore(score);
        }

        // 检查是否达到了最高等级的水果，并生成合成后的新水果
        if (newId < FRUIT_CONFIGS.length && this.fruitPrefab && this.fruitContainer) {
            console.log(`[GameManager] Spawning new fruit: ${newId}`);
            // 微信环境下触发震动反馈
            if (WXManager.instance) {
                WXManager.instance.vibrateShort();
            }

            // 如果合成了大西瓜，可以播放成功音效
            if (newId === FRUIT_CONFIGS.length - 1) {
                if (this.audioManager) this.audioManager.playSound('success');
                else if (AudioManager.instance) AudioManager.instance.playSound('success');
            }

            const newFruit = instantiate(this.fruitPrefab);
            
            // 关键修复：先设置物理类型为 Dynamic，但延迟一帧激活
            // 这里我们先不设置 position，而是直接添加到节点树
            this.fruitContainer.addChild(newFruit);
            
            // 确保水果 Layer 与容器一致，避免 Camera 渲染问题
            newFruit.layer = this.fruitContainer.layer;
            
            // 确保坐标正确设置
            newFruit.setPosition(position);
            
            const fruitComp = newFruit.getComponent(Fruit);
            if (fruitComp) {
                // 传入预加载的 SpriteFrame
                const config = FRUIT_CONFIGS[newId];
                const spriteFrame = this._fruitSpriteFrames.get(config.spriteName) || null;
                if (!spriteFrame) {
                    console.warn(`[GameManager] SpriteFrame not found in preload cache for: ${config.spriteName}`);
                }
                fruitComp.init(newId, spriteFrame);
                fruitComp.setGameManager(this);
            }
            
            const rb = newFruit.getComponent(RigidBody2D);
            if (rb) {
                // 确保它是 Dynamic 类型
                rb.type = ERigidBody2DType.Dynamic;
                // 强制唤醒，防止生成时是休眠状态
                this.scheduleOnce(() => {
                    if (rb && rb.isValid) {
                        rb.wakeUp();
                    }
                }, 0);
            }
        }
    }

    /**
     * 检测水果是否进入危险区域
     */
    public onFruitEnterDeathZone(fruitNode: Node) {
        if (this._isGameOver) return;
        
        // 忽略当前正在拖拽的水果
        if (fruitNode === this._currentFruit) return;

        // 如果水果在危险区停稳（速度极小），则判定游戏结束
        const rb = fruitNode.getComponent(RigidBody2D);
        if (rb && rb.linearVelocity.length() < 1.0) {
             this.gameOver();
        }
    }

    /**
     * 触发游戏结束逻辑
     */
    gameOver() {
        this._isGameOver = true;
        if (this.uiManager) {
            this.uiManager.showGameOver();
        }
    }

    /**
     * 重新开始游戏
     */
    restartGame() {
        const sceneName = director.getScene()?.name;
        if (sceneName) {
            director.loadScene(sceneName);
        }
    }
}
