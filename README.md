# 角色主题绑定 (Character Theme Binder)

SillyTavern 扩展：将主题 UI CSS 文件与角色卡绑定，切换角色时自动应用对应主题。

## 功能

- 自动读取所有角色卡和已安装的主题 CSS 文件（内置 + 用户上传）
- 在「扩展设置」面板中为每个角色选择绑定的主题
- 切换到绑定了主题的角色时，自动替换为该主题
- 面板跟随主题美化：全部使用酒馆原生组件类（`inline-drawer` / `menu_button` / `checkbox_label` / `text_pole`）与主题 CSS 变量，观感与原生扩展一致；不透明、无毛玻璃、无过渡动画
- 轻量化：面板无过渡/动画/滤镜；角色消息渲染时只切换高亮类、不重建列表
- 当前角色的绑定行高亮显示
- 支持一键刷新角色/主题列表

## 安装

1. 将整个 `character-theme-binder` 文件夹复制到 SillyTavern 扩展目录：
   ```
   SillyTavern/public/scripts/extensions/character-theme-binder/
   ```
2. 重启 SillyTavern（或刷新页面）
3. 进入「用户设置」→「扩展」，找到「角色主题绑定」

## 使用

1. 打开扩展面板，确认「启用角色切换时自动应用主题」已勾选
2. 列表中会显示所有角色卡，每个角色右侧有一个主题下拉框
3. 为角色选择要绑定的主题 CSS（选「— 不绑定 —」则取消绑定）
4. 切换到该角色时，主题会自动应用
5. 如果新增了角色或主题，点击「刷新角色 / 主题列表」更新

## 文件结构

```
character-theme-binder/
├── manifest.json    # 扩展元数据
├── index.js         # 核心逻辑
├── index.css        # 面板样式（跟随主题变量）
└── README.md        # 本文件
```

## 注意事项

- 主题切换通过触发酒馆原生主题下拉框（`#themes`）的 change 事件实现，兼容 ST 1.18+
- 面板配色直接继承酒馆主题 CSS 变量（`--SmartTheme*`），切换主题时自动变色，无需额外同步逻辑
- 面板不产生毛玻璃：不写 backdrop-filter、无半透明叠加，文字清晰
- 用户自定义主题需先通过酒馆「主题」功能上传到 `data/themes/` 目录
- 绑定关系保存在扩展设置中，不会随角色卡导出
