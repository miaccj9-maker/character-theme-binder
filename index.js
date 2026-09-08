import {
    saveSettingsDebounced,
    eventSource,
    event_types,
} from '../../../../script.js';
// ST 1.18+：extension_settings、getContext 由 scripts/extensions.js 导出，script.js 不导出
import { extension_settings, getContext } from '../../../../scripts/extensions.js';

const MODULE_NAME = 'character-theme-binder';
const MODULE_VERSION = '1.1.1';

// 初始化扩展设置
if (!extension_settings[MODULE_NAME]) {
    extension_settings[MODULE_NAME] = {
        bindings: {},
        enabled: true,
    };
}

const settings = extension_settings[MODULE_NAME];
let themeList = [];
let panelContent = null;

// ========== 工具函数 ==========

function getCurrentCharacter() {
    const ctx = getContext();
    // 1.18+：characterId 是数组下标，角色名用 name2
    return ctx.name2 || '';
}

function getAllCharacters() {
    const ctx = getContext();
    const chars = ctx.characters || [];
    // 1.18+：characters 为角色数组，取 name；兼容旧版对象结构
    if (Array.isArray(chars)) {
        return chars.map(c => c && c.name).filter(Boolean);
    }
    return Object.keys(chars);
}

// 获取主题列表：用户自定义主题 + 从DOM下拉框读取内置主题
async function fetchThemeList() {
    const themes = new Set();

    // 方式1：API 获取用户上传的主题
    try {
        const res = await fetch('/api/files/list?dir=themes');
        if (res.ok) {
            const data = await res.json();
            const files = Array.isArray(data) ? data : (data.files || data.items || []);
            files.forEach(f => {
                if (typeof f === 'string' && f.endsWith('.css')) {
                    themes.add(f.replace(/\.css$/, ''));
                }
            });
        }
    } catch (e) {
        console.warn(`[${MODULE_NAME}] 获取用户主题列表失败:`, e);
    }

    // 方式2：从设置页面的主题下拉框读取（包含所有内置主题）
    try {
        const selects = document.querySelectorAll('select');
        for (const sel of selects) {
            const id = (sel.id || '').toLowerCase();
            const name = (sel.name || '').toLowerCase();
            if (id.includes('theme') || name.includes('theme')) {
                Array.from(sel.options).forEach(opt => {
                    if (opt.value) themes.add(opt.value);
                });
                break;
            }
        }
    } catch (e) {}

    themeList = Array.from(themes).sort();
    return themeList;
}

// 应用主题：通过酒馆原生主题下拉框触发切换（ST 1.18 起主题以 CSS 变量方式应用，无 #theme-css 链接）
function applyTheme(themeName) {
    if (!themeName) return false;

    try {
        const select = document.getElementById('themes');
        if (!select) {
            console.warn(`[${MODULE_NAME}] 未找到主题下拉框 #themes`);
            return false;
        }
        if (!Array.from(select.options).some(opt => opt.value === themeName)) {
            console.warn(`[${MODULE_NAME}] 主题 "${themeName}" 不在列表中`);
            return false;
        }
        // 触发酒馆原生 change 事件：写入 power_user.theme、应用主题并保存设置
        select.value = themeName;
        $(select).trigger('change');
        return true;
    } catch (e) {
        console.warn(`[${MODULE_NAME}] 应用主题失败:`, e);
        return false;
    }
}

// ========== 事件处理 ==========

let lastHighlightChar = null;

function onCharacterChanged() {
    // 无论开关状态都更新“当前角色”高亮（只切类，不重建列表）
    updateCurrentHighlight();

    if (!settings.enabled) return;

    const charName = getCurrentCharacter();
    if (!charName) return;

    const boundTheme = settings.bindings[charName];
    if (boundTheme) {
        applyTheme(boundTheme);
    }
}

// ========== UI 构建（全部用酒馆原生组件类 + 主题变量，跟随主题美化） ==========

function createBindingRow(charName) {
    const row = document.createElement('div');
    row.className = 'ctb-binding-row';
    row.dataset.char = charName; // 供高亮类快速定位，避免重建列表
    // 内联主题变量：实色底 + 主题边框，观感与原生扩展一致，无毛玻璃
    row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 12px; min-width:0; border:1px solid var(--SmartThemeBorderColor); background:var(--SmartThemeBlurTintColor); border-radius:10px;';

    // 角色名
    const charLabel = document.createElement('span');
    charLabel.className = 'ctb-char-name';
    charLabel.textContent = charName;
    charLabel.title = charName;

    // 主题下拉
    const themeSelect = document.createElement('select');
    themeSelect.className = 'text_pole ctb-theme-select';
    themeSelect.style.cssText = 'flex-shrink:0; min-width:150px; max-width:200px; margin:0;';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— 不绑定 —';
    themeSelect.appendChild(defaultOpt);

    themeList.forEach(theme => {
        const opt = document.createElement('option');
        opt.value = theme;
        opt.textContent = theme;
        themeSelect.appendChild(opt);
    });

    themeSelect.value = settings.bindings[charName] || '';

    themeSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value) {
            settings.bindings[charName] = value;
        } else {
            delete settings.bindings[charName];
        }
        saveSettingsDebounced();
    });

    row.appendChild(charLabel);
    row.appendChild(themeSelect);
    return row;
}

function renderBindingList() {
    if (!panelContent) return;

    const listContainer = panelContent.querySelector('#ctb-binding-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const characters = getAllCharacters();
    const currentChar = getCurrentCharacter();

    if (characters.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'ctb-empty';
        empty.textContent = '未找到角色卡，请先导入角色';
        listContainer.appendChild(empty);
        lastHighlightChar = null;
        return;
    }

    characters.forEach(charName => {
        const row = createBindingRow(charName);
        if (charName === currentChar) {
            row.classList.add('ctb-current');
        }
        listContainer.appendChild(row);
    });

    // 列表已重建，重置高亮缓存，允许下次消息更新高亮
    lastHighlightChar = null;
}

// 仅更新“当前角色”高亮类；当前角色未变化时直接跳过，避免无谓遍历（角色卡很多时尤为重要）
function updateCurrentHighlight() {
    if (!panelContent) return;
    const current = getCurrentCharacter();
    if (current === lastHighlightChar) return;
    lastHighlightChar = current;

    const list = panelContent.querySelector('#ctb-binding-list');
    if (!list) return;
    const rows = list.querySelectorAll('.ctb-binding-row');
    for (const row of rows) {
        row.classList.toggle('ctb-current', row.dataset.char === current);
    }
}

function createSettingsPanel() {
    const container = document.createElement('div');
    container.id = 'ctb-extension-panel';
    container.className = 'inline-drawer';

    // 标题栏：酒馆原生 inline-drawer 头 + 展开图标（原生逻辑自动切换 up/down）
    const header = document.createElement('div');
    header.className = 'inline-drawer-toggle inline-drawer-header ctb-toggle-header';
    header.innerHTML = `
        <span class="ctb-panel-title">🎭 角色主题绑定</span>
        <span class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></span>
    `;

    // 内容区
    const content = document.createElement('div');
    content.className = 'inline-drawer-content ctb-panel-content';

    // 开关行：原生 checkbox_label
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'checkbox_label';
    const toggleCheckbox = document.createElement('input');
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.id = 'ctb-enabled';
    toggleCheckbox.checked = settings.enabled;
    toggleCheckbox.addEventListener('change', (e) => {
        settings.enabled = e.target.checked;
        saveSettingsDebounced();
    });
    toggleLabel.appendChild(toggleCheckbox);
    toggleLabel.appendChild(document.createTextNode(' 启用角色切换时自动应用主题'));

    // 刷新按钮：原生 menu_button
    const refreshBtn = document.createElement('div');
    refreshBtn.className = 'menu_button menu_button_icon ctb-refresh-btn';
    refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i><span>刷新角色 / 主题列表</span>';
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('ctb-refreshing');
        await fetchThemeList();
        renderBindingList();
        refreshBtn.classList.remove('ctb-refreshing');
    });

    // 说明
    const hint = document.createElement('div');
    hint.className = 'ctb-hint';
    hint.textContent = '为每个角色选择绑定的主题CSS文件。切换到该角色时，主题会自动替换。当前角色的行会高亮显示。';

    // 绑定列表
    const listContainer = document.createElement('div');
    listContainer.id = 'ctb-binding-list';
    listContainer.className = 'ctb-binding-list';

    content.appendChild(toggleLabel);
    content.appendChild(refreshBtn);
    content.appendChild(hint);
    content.appendChild(listContainer);

    container.appendChild(header);
    container.appendChild(content);

    // 插入扩展设置区域
    const extensionsSettings = document.getElementById('extensions_settings')
        || document.getElementById('extensions_settings2');

    if (extensionsSettings) {
        extensionsSettings.appendChild(container);
    } else {
        console.warn(`[${MODULE_NAME}] 未找到扩展设置容器，面板将不可用`);
    }

    panelContent = content;
    return content;
}

// ========== 扩展入口 ==========

export async function init() {
    console.log(`[${MODULE_NAME}] v${MODULE_VERSION} 初始化中...`);

    // 创建设置面板（配色直接继承酒馆主题变量，无需 JS 合成颜色）
    createSettingsPanel();

    // 加载主题列表
    await fetchThemeList();

    // 渲染绑定列表
    renderBindingList();

    // 角色切换：延迟执行确保角色上下文已更新；自动应用绑定主题并更新高亮
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(onCharacterChanged, 150);
    });

    // 角色消息渲染：只更新高亮类，不再重建整个列表（避免每次消息都卡顿）
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, updateCurrentHighlight);

    // 角色列表加载/变化时刷新绑定列表（防抖，避免加载过程中重复重建）
    let charListTimer = null;
    eventSource.on(event_types.CHARACTER_PAGE_LOADED, () => {
        if (charListTimer) clearTimeout(charListTimer);
        charListTimer = setTimeout(renderBindingList, 150);
    });

    // 兜底：页面初始化时角色数据可能稍后填充完成，延迟重渲染一次
    setTimeout(renderBindingList, 1500);

    console.log(`[${MODULE_NAME}] 初始化完成，已加载 ${themeList.length} 个主题`);
}

export async function loop() {
    // 无需循环逻辑
}
