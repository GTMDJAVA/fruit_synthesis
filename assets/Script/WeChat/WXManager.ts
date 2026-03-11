
import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

declare const wx: any;

@ccclass('WXManager')
export class WXManager extends Component {

    public static instance: WXManager | null = null;

    onLoad() {
        WXManager.instance = this;
    }

    onDestroy() {
        if (WXManager.instance === this) {
            WXManager.instance = null;
        }
    }

    start() {
        if (typeof wx === 'undefined') {
            console.log("Not in WeChat environment");
            return;
        }

        this.login();
        this.initShare();
    }

    login() {
        wx.login({
            success: (res: any) => {
                console.log("Login success code: " + res.code);
                // Send code to server for session_key (if backend exists)
            }
        });
    }

    initShare() {
        wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
        });
        
        // 监听用户点击右上角菜单的“转发”按钮时触发的事件
        wx.onShareAppMessage(() => {
            return {
                title: '快来合成大西瓜！', // 默认分享标题
                imageUrl: '' // TODO: Set share image
            }
        });
    }

    submitScore(score: number) {
        if (typeof wx === 'undefined') return;
        
        // Use Open Data Context to display leaderboard
        // Here we just submit to cloud storage
        wx.setUserCloudStorage({
            KVDataList: [{ key: 'score', value: score.toString() }], // 排行榜 key 为 'score'
            success: (res: any) => {
                console.log("Score submitted");
            }
        });
    }

    vibrateShort() {
        if (typeof wx !== 'undefined') {
            wx.vibrateShort({ type: 'medium' });
        }
    }
}
