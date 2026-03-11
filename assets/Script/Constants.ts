
import { _decorator, CCInteger, CCString, Color } from 'cc';
const { ccclass, property } = _decorator;

export enum GameState {
    /** 游戏进行中 */
    Playing,
    /** 游戏结束 */
    GameOver
}

export interface FruitConfig {
    /** 水果唯一标识符（等级），从0开始 */
    id: number;
    /** 水果的物理碰撞半径（像素） */
    radius: number;
    /** 合成该水果获得的得分 */
    score: number;
    /** 备用颜色（当图片资源加载失败时显示） */
    color: Color;
    /** 图片资源名称（对应 resources 目录下的图片） */
    spriteName: string;
}

// 11 levels of fruits (Grape -> Cherry -> Orange -> Lemon -> Kiwi -> Tomato -> Peach -> Pineapple -> Coconut -> Watermelon -> Big Watermelon)
// Radius values are relative and need tuning based on screen size (assuming 720x1280 design resolution)
export const FRUIT_CONFIGS: FruitConfig[] = [
    // Level 1: 葡萄 (Grape) - 最小的水果
    { id: 0, radius: 20, score: 2, color: new Color(146, 39, 143), spriteName: "grape" },
    // Level 2: 樱桃 (Cherry)
    { id: 1, radius: 30, score: 4, color: new Color(237, 28, 36), spriteName: "cherry" },
    // Level 3: 橘子 (Orange)
    { id: 2, radius: 42, score: 8, color: new Color(247, 147, 30), spriteName: "orange" },
    // Level 4: 柠檬 (Lemon)
    { id: 3, radius: 50, score: 16, color: new Color(255, 242, 0), spriteName: "lemon" },
    // Level 5: 猕猴桃 (Kiwi)
    { id: 4, radius: 65, score: 32, color: new Color(141, 198, 63), spriteName: "kiwi" },
    // Level 6: 番茄 (Tomato)
    { id: 5, radius: 78, score: 64, color: new Color(237, 28, 36), spriteName: "tomato" }, // Darker red
    // Level 7: 桃子 (Peach)
    { id: 6, radius: 90, score: 128, color: new Color(241, 158, 194), spriteName: "peach" },
    // Level 8: 菠萝 (Pineapple)
    { id: 7, radius: 105, score: 256, color: new Color(255, 242, 0), spriteName: "pineapple" },
    // Level 9: 椰子 (Coconut)
    { id: 8, radius: 120, score: 512, color: new Color(255, 255, 255), spriteName: "coconut" },
    // Level 10: 半个西瓜 (Half Watermelon)
    { id: 9, radius: 135, score: 1024, color: new Color(146, 39, 143), spriteName: "watermelon_half" },
    // Level 11: 大西瓜 (Big Watermelon) - 最大的水果
    { id: 10, radius: 150, score: 2048, color: new Color(0, 166, 81), spriteName: "watermelon_full" }
];

export const GAME_CONSTANTS = {
    /** 水果生成的高度（相对于屏幕中心，假设中心为 0,0） */
    SPAWN_Y: 550,
    /** 死亡判定线高度（当水果堆积超过此线时游戏结束） */
    DEAD_LINE_Y: 500,
    /** 物理碰撞分组配置 */
    PHYSICS_GROUP: {
        /** 默认分组 */
        DEFAULT: 1 << 0,
        /** 水果分组 */
        FRUIT: 1 << 1,
        /** 墙壁/地面分组 */
        WALL: 1 << 2
    }
};
