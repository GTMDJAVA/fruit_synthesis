
import { _decorator, Component, Label, Node, Sprite, Color, UITransform, director, resources, SpriteFrame, log } from 'cc';
import { FRUIT_CONFIGS } from './Constants';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {

    @property(Label)
    scoreLabel: Label | null = null;

    @property(Node)
    gameOverNode: Node | null = null;

    private _score: number = 0;

    start() {
        this.updateScoreUI();
        if (this.gameOverNode) {
            this.gameOverNode.active = false;
            console.log(this.gameOverNode);
            // 修复：手动绑定重新开始按钮的点击事件
            const restartBtn = this.gameOverNode.getChildByName('RestartButton');
            if (restartBtn) {
                console.log('重新开始按钮绑定点击事件')
                restartBtn.on('click', this.onRestartClicked, this);
            }
        }
    }

    addScore(points: number) {
        this._score += points;
        this.updateScoreUI();
    }

    updateScoreUI() {
        if (this.scoreLabel) {
            this.scoreLabel.string = this._score.toString();
        }
    }

    showGameOver() {
        if (this.gameOverNode) {
            this.gameOverNode.active = true;
        }
    }
    
    // Linked to Restart Button in Editor
    onRestartClicked() {
        console.log('重新开始按钮触发')
        const sceneName = director.getScene()?.name;
        if (sceneName) {
            director.loadScene(sceneName);
        }
    }
}
