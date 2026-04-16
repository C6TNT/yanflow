# YanFlow

YanFlow 是一款面向医学考研场景的轻量级复习规划工具，围绕遗忘曲线自动生成复习任务，帮助用户从“手写复习计划”切换到“按系统安排滚动复习”。

## V1 功能

- 新增科目与学习条目
- 为每条内容记录首次学习日期
- 按默认遗忘曲线自动生成复习节点
- 聚合今日任务与逾期任务
- 支持完成复习、掌握反馈、顺延一天
- 显示未来 7 天任务分布
- 使用 `localStorage` 本地持久化，无需后端即可运行
- 支持作为 `PWA` 安装到平板桌面

## 使用说明

详细使用说明见 `USAGE.md`。

## Android APK

- 已提供 Android 打包脚本：`build-android.ps1`
- 默认输出 APK：`android-build/output/YanFlow-release.apk`
- Android 外壳会把当前网页版本打包进原生 `WebView`，适合直接装到平板

## 本地运行

这是一个零构建的静态前端项目，直接打开 `index.html` 即可使用。

如果想用本地服务器运行：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`
