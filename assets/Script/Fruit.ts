
import { _decorator, Component, Node, Collider2D, Contact2DType, IPhysics2DContact, RigidBody2D, Vec3, Vec2, Sprite, Color, UITransform, CircleCollider2D, resources, SpriteFrame } from 'cc';
import { FRUIT_CONFIGS } from './Constants';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

@ccclass('Fruit')
export class Fruit extends Component {
    @property
    public id: number = 0;

    private _isMerging: boolean = false;
    private _gameManager: GameManager | null = null;
    private _logTimer: number = 0;
    private _contactCount: number = 0; // 记录当前接触的物体数量
    public hasCollided: boolean = false; // 标记是否发生过碰撞

    public setGameManager(gm: GameManager) {
        this._gameManager = gm;
    }

    start() {

        const collider = this.getComponent(Collider2D);
        if (collider) {
            // Listen for collision events
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
        
        // 如果还没有设置 GameManager，尝试自动查找（兼容旧逻辑）
        if (!this._gameManager) {
            const canvas = this.node.scene.getChildByName('Canvas');
            if (canvas) {
                this._gameManager = canvas.getComponent(GameManager);
            }
            if (!this._gameManager) {
                 const gmNode = this.node.scene.getChildByName('GameManager');
                 if (gmNode) this._gameManager = gmNode.getComponent(GameManager);
            }
        }
    }

    /**
     * Initialize fruit properties based on ID
     */
    init(id: number, spriteFrame: SpriteFrame | null = null) {
        this.id = id;
        this._isMerging = false;
        this.hasCollided = false;
        const config = FRUIT_CONFIGS[id];
        
        // 1. Set Size
        const uiTransform = this.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(config.radius * 2, config.radius * 2);
        }

        // 2. Set Collider Radius
        const collider = this.getComponent(CircleCollider2D);
        if (collider) {
            // 恢复物理半径为标准值，避免视觉穿透
            collider.radius = config.radius;
            
            // 物理材质调整：
            // 默认设置为弹性碰撞（0.2），保证下落时的弹跳感
            // 在碰撞回调中动态调整为非弹性
            collider.restitution = 0.2;
            collider.friction = 0.3;
            
            collider.apply();
        }

        // 3. Set Color/Sprite
        const sprite = this.getComponent(Sprite);
        if (sprite) {
            // 设置 sizeMode 为 CUSTOM，确保图片大小跟随 UITransform 的设置，而不是使用原图大小
            // 这样可以保证视觉大小和物理碰撞体大小一致
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;

            // 如果提供了预加载的 SpriteFrame，直接设置
            if (spriteFrame) {
                console.log(`[Fruit] Using preloaded sprite for: ${config.spriteName}`);
                sprite.spriteFrame = spriteFrame;
                sprite.color = Color.WHITE;
            } else {
                // 否则先保留颜色设置作为fallback，防止图片加载失败时不可见
                sprite.color = Color.WHITE; // 加载图片时通常需要设为白色，避免颜色叠加
                
                // 动态加载图片资源
                // 路径格式：fruits/spriteName
                // 注意：resources.load 加载的是 assets/resources/ 下的资源，不需要带扩展名
                const path = `fruits/${config.spriteName}/spriteFrame`;
                console.log(`[Fruit] Loading sprite from path: ${path}`);
                resources.load(path, SpriteFrame, (err, loadedSpriteFrame) => {
                    if (err) {
                        console.error(`Failed to load fruit sprite: ${path}`, err);
                        // 加载失败时回退到纯色块
                        sprite.color = config.color;
                        return;
                    }
                    if (sprite && sprite.node && sprite.node.isValid) {
                        console.log(`[Fruit] Sprite loaded successfully: ${config.spriteName}`);
                        sprite.spriteFrame = loadedSpriteFrame;
                    }
                });
            }
        }

        // 4. Set Initial Damping & Gravity Scale
        const rb = this.getComponent(RigidBody2D);
        if (rb) {
            rb.linearDamping = 0.2;
            rb.angularDamping = 0.2;

            // 动态重力分配方案：
            // 基础重力为 1.0，随水果等级（体积）增加而增加
            // 公式：1.0 + (id * 0.1)
            // 这样大水果会更“沉”，能压住下面的小水果，减少因小水果反弹造成的整体松动
            // 例如：葡萄(id:0)重力1.0，大西瓜(id:10)重力2.0
            rb.gravityScale = 0.5 + (id * 0.2);
        }
    }

    onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        this._contactCount++;
        this.hasCollided = true;
        
        if (this._isMerging) return;

        // 动态非弹性碰撞逻辑：
        // 获取相对速度
        if (contact) {
            const worldManifold = contact.getWorldManifold();
            // 注意：Cocos Creator 3.x 物理接触点可能没有直接提供相对速度
            // 我们通过刚体速度计算
            const rbSelf = selfCollider.getComponent(RigidBody2D);
            const rbOther = otherCollider.getComponent(RigidBody2D);
            
            if (rbSelf && rbOther) {
                const v1 = rbSelf.linearVelocity;
                const v2 = rbOther.linearVelocity;
                // 计算相对速度的平方
                const relativeVelSqr = Vec2.distance(v1, v2); // 这里 distance 其实就是 (v1-v2).length()
                
                // 阈值判断：如果相对速度小于 2.0 (约为轻微碰撞/挤压)，则强制设为无弹性
                if (relativeVelSqr < 5.0) {
                    contact.setRestitution(0); // 仅对本次碰撞生效
                }
            }
        }

        const otherFruit = otherCollider.getComponent(Fruit);
        if (!otherFruit) return;

        // Check if same ID
        if (otherFruit.id === this.id) {
            // Prevent double processing: decide based on instance ID
            // The one with lower ID processes the merge (arbitrary but consistent)
            if (this.node.uuid < otherFruit.node.uuid) {
                // Check if the other fruit is already merging
                if (otherFruit._isMerging) return;

                // Mark both as merging immediately to prevent re-entry
                this._isMerging = true;
                otherFruit._isMerging = true;

                // Defer the actual merge logic to the next frame
                // This prevents changing physics world state (creating/destroying bodies) during a physics callback
                this.scheduleOnce(() => {
                    this.merge(otherFruit);
                }, 0);
            }
        } else {
            // Log collision with different fruit to check for jitter causes
            // console.log(`[Fruit Jitter Check] Collision Start: Fruit ${this.id} <-> Fruit ${otherFruit.id}`);
        }
    }

    onEndContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (this._contactCount > 0) {
            this._contactCount--;
        }
    }

    update(dt: number) {
        if (this._isMerging) return;

        const rb = this.getComponent(RigidBody2D);
        if (rb) {
            // 策略：基于接触状态的动态阻尼
            // 只要有接触（挤压中），就施加较大的阻尼来吸收动能
            if (this._contactCount > 0) {
                // 挤压状态：增加阻尼，模拟粘滞感，防止微小抖动
                // 不需要过大的值，3.0 足够抑制大部分反弹
                rb.linearDamping = 3.0;
                rb.angularDamping = 3.0;
            } else {
                // 空中状态：低阻尼，保证下落流畅
                rb.linearDamping = 0.1;
                rb.angularDamping = 0.1;
                
                // 空中也稍微加一点点衰减，防止飞得太快（可选）
                const v = rb.linearVelocity;
                if (v.y > -10.0) { // 非极速下落
                     const decay = 0.99;
                     rb.linearVelocity = v.multiplyScalar(decay);
                }
            }
        }
    }

    merge(other: Fruit) {
        // Ensure nodes are still valid (they might have been destroyed by other logic)
        if (!this.node.isValid || !other.node.isValid) return;
        
        const newId = this.id + 1;
        
        // Calculate midpoint for new fruit
        const midPos = new Vec3();
        Vec3.add(midPos, this.node.position, other.node.position);
        midPos.multiplyScalar(0.5);

        console.log(`[Fruit] Merging fruits: ${this.id} + ${other.id} -> ${newId} at ${midPos}`);

        if (this._gameManager) {
            this._gameManager.onFruitMerge(newId, midPos);
        } else {
            console.error('[Fruit] GameManager reference missing in merge!');
        }

        // Destroy both fruits
        this.node.destroy();
        other.node.destroy();
    }
}
