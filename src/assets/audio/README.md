# 切水果音效素材

用户提供的原始 MP3，直接随 Vite 构建打包：

- `slash.mp3`：`freesound_community-slashkut-108175.mp3`，用于挥刀。
- `tear.mp3`：`creatorshome-tear-a-paper-328149.mp3`，用于切中水果时的短撕裂质感。
- `fruit-music.mp3`：`64_30_200000421090972_S64.mp3`，约 30 秒，用于切水果模式的循环背景音乐。

播放时跳过起始静音并截取瞬态，保留原文件便于后续调整。加载、音量、淡入淡出、音高和并发控制在 `src/fruit-feedback.js` 的 `FruitAudio` 中维护。
