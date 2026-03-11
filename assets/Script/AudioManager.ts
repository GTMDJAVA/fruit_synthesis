
import { _decorator, Component, AudioSource, AudioClip, resources } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {

    public static instance: AudioManager | null = null;

    private _audioSource: AudioSource | null = null;

    // 缓存加载的音频剪辑
    private _clips: { [key: string]: AudioClip } = {};

    onLoad() {
        // 如果存在其他有效的单例实例，销毁当前实例
        if (AudioManager.instance && AudioManager.instance.isValid && AudioManager.instance !== this) {
            this.destroy();
            return;
        }
        AudioManager.instance = this;

        this._audioSource = this.getComponent(AudioSource);
        if (!this._audioSource) {
            this._audioSource = this.addComponent(AudioSource);
        }

        // 预加载所有音效
        this.preloadSound('sound/destroy'); // 消除音效
        this.preloadSound('sound/random'); // 随机音效
        this.preloadSound('sound/random_bell'); // 随机铃声音效
        this.preloadSound('sound/success'); // 成功音效
        this.preloadSound('sound/synthesis'); // 合成音效
    }

    onDestroy() {
        if (AudioManager.instance === this) {
            AudioManager.instance = null;
        }
    }

    private preloadSound(path: string) {
        resources.load(path, AudioClip, (err, clip) => {
            if (err) {
                console.error(`Failed to load audio: ${path}`, err);
                return;
            }
            // 存储时只用文件名作为 key，方便调用
            const key = path.split('/').pop() || path;
            this._clips[key] = clip;
        });
    }

    /**
     * 播放音效
     * @param name 音效文件名（不含路径和后缀），例如 "synthesis"
     * @param volume 音量 (0-1)
     */
    public playSound(name: string, volume: number = 1.0) {
        // 去掉可能传入的后缀
        const key = name.replace(/\.(mp3|wav|ogg)$/, '');
        
        const clip = this._clips[key];
        if (clip && this._audioSource) {
            this._audioSource.playOneShot(clip, volume);
        } else {
            // 如果还没加载好，尝试直接加载播放（虽然不太推荐实时加载）
            // 这里我们只打印警告，依赖预加载
            console.warn(`Audio clip not found or not loaded yet: ${key}`);
        }
    }
}
