# 切水果音频

- `cut.mp3`：当前挥刀音效，从用户提供的 `freesound_community-slashkut-108175.mp3` 的 0.085 秒处截取 130 毫秒，转为单声道，并做 3 毫秒淡入、15 毫秒淡出。一段挥刀动作仅播放一次。
- `fruit-music.mp3`：用户提供的 `64_30_200000421090972_S64.mp3`，约 30 秒。仅在正式回合开始后循环播放。
- `slash.mp3`、`tear.mp3`：保留的原始切割/撕裂素材，当前不参与播放或生产构建。

声音触发与播放在 `src/fruit-feedback.js` 中维护，游戏阶段控制在 `src/fruit-stage.js` 中维护。
