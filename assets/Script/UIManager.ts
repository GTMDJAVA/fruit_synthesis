
import { _decorator, Component, Label, Node, Sprite, Color, UITransform, director, resources, SpriteFrame } from 'cc';
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
        const sceneName = director.getScene()?.name;
        if (sceneName) {
            director.loadScene(sceneName);
        }
    }
}
