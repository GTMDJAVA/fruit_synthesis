
import { _decorator, Component, Collider2D, Contact2DType, IPhysics2DContact, Node } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('DeathZone')
export class DeathZone extends Component {

    @property(GameManager)
    gameManager: GameManager | null = null;

    private _fruitsInZone: Set<Node> = new Set();

    start() {
        if (!this.gameManager) {
            // 尝试自动查找 GameManager
            // 方法1: 在场景根节点查找
            const scene = this.node.scene;
            const gmNode = scene.getChildByName('GameManager');
            if (gmNode) {
                this.gameManager = gmNode.getComponent(GameManager);
            }
            
            // 方法2: 全局查找 (备用)
            if (!this.gameManager) {
                this.gameManager = scene.getComponentInChildren(GameManager);
            }

            if (!this.gameManager) {
                console.error("[DeathZone] GameManager reference is missing and could not be found automatically!");
            } else {
                console.log("[DeathZone] GameManager automatically found and assigned.");
            }
        }

        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    update(dt: number) {
        if (this._fruitsInZone.size > 0 && this.gameManager) {
            for (const fruitNode of this._fruitsInZone) {
                if (fruitNode && fruitNode.isValid) {
                    this.gameManager.onFruitEnterDeathZone(fruitNode);
                } else {
                    this._fruitsInZone.delete(fruitNode);
                }
            }
        }
    }

    onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (otherCollider && otherCollider.node) {
            this._fruitsInZone.add(otherCollider.node);
        }
    }

    onEndContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (otherCollider && otherCollider.node) {
            this._fruitsInZone.delete(otherCollider.node);
        }
    }

    // Removed onPreSolve as it is not reliable for sensors

}
