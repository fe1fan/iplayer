import { getState, setState } from '../state.js';
import { showToast } from './toast.js';
import { loadPluginSource, savePluginSettings, setPluginEnabled } from '../ipc.js';
import { isTauri } from '@tauri-apps/api/core';

const sourceOptions = [
  { id: 'local', label: '本地' },
  { id: 'url', label: 'URL' },
  { id: 'npm', label: 'npm' },
  { id: 'git', label: 'Git' },
];

const sourcePlaceholder = {
  local: '/Users/me/Music/plugins/audio-curve',
  url: 'https://example.com/plugin.json',
  npm: '@iplayer/plugin-name',
  git: 'https://github.com/user/iplayer-plugin',
};

const hookGroups = [
  { id: 'system', name: '系统' },
  { id: 'library', name: '曲库' },
  { id: 'enrichment', name: '增强' },
  { id: 'playback', name: '播放' },
  { id: 'audio', name: '音频' },
  { id: 'integration', name: '同步' },
  { id: 'ui', name: '界面' },
];

export function renderPage() {
  const s = getState();
  const configPlugin = s.plugins.find(plugin => plugin.id === s.pluginPanel.configPluginId);
  if (configPlugin) return renderConfigPage(configPlugin);
  return renderOverviewPage(s);
}

export function bindPage(root) {
  root.querySelectorAll('[data-source-type]').forEach(button => {
    button.addEventListener('click', () => {
      setState({ pluginPanel: { ...getState().pluginPanel, sourceType: button.dataset.sourceType } });
    });
  });

  root.querySelector('#pluginSourceInput')?.addEventListener('input', event => {
    getState().pluginPanel.sourceInput = event.target.value;
  });

  root.querySelector('[data-action="load-plugin"]')?.addEventListener('click', () => loadPlugin());
  root.querySelector('[data-action="back-to-plugins"]')?.addEventListener('click', () => {
    const s = getState();
    setState({ view: 'plugins', pluginPanel: { ...s.pluginPanel, configPluginId: null } });
  });
  root.querySelector('[data-action="save-plugin-config"]')?.addEventListener('click', () => savePluginConfig(root));

  root.querySelectorAll('[data-hook-id]').forEach(button => {
    button.addEventListener('click', () => {
      const hooks = getState().pluginHooks.map(hook =>
        hook.id === button.dataset.hookId ? { ...hook, enabled: !hook.enabled } : hook
      );
      setState({ pluginHooks: hooks });
    });
  });

  root.querySelectorAll('[data-plugin-id]').forEach(row => {
    row.addEventListener('click', event => {
      if (event.target.closest('[data-action]')) return;
      setState({ pluginPanel: { ...getState().pluginPanel, selectedPluginId: row.dataset.pluginId } });
    });
  });

  root.querySelectorAll('[data-action="configure-plugin"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const s = getState();
      setState({
        view: 'plugin-config',
        sidebarActive: 'plugins',
        pluginPanel: { ...s.pluginPanel, selectedPluginId: button.dataset.pluginId, configPluginId: button.dataset.pluginId },
      });
    });
  });

  root.querySelectorAll('[data-action="toggle-plugin"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      togglePlugin(button.dataset.pluginId);
    });
  });
}

function renderOverviewPage(s) {
  const panel = s.pluginPanel;
  const selected = s.plugins.find(plugin => plugin.id === panel.selectedPluginId) || s.plugins[0];

  return `
  <div class="plugin-page" id="pluginPage">
    <section class="plugin-section plugin-hero">
      <div>
        <h2>插件系统</h2>
        <p>管理第三方插件，并把它们接入音乐库加载、播放前处理和音频输出链路。</p>
      </div>
      <div class="plugin-stats">
        <span><strong>${s.plugins.filter(plugin => plugin.enabled).length}</strong> 运行中</span>
        <span><strong>${s.pluginHooks.filter(hook => hook.enabled).length}</strong> 节点启用</span>
        <span><strong>${hookGroups.length}</strong> 生命周期</span>
      </div>
    </section>

    <section class="plugin-section">
      <div class="plugin-section-head">
        <h4>加载插件</h4>
        <span>支持任意来源</span>
      </div>
      <div class="plugin-source-tabs">
        ${sourceOptions.map(option => `
          <button class="${panel.sourceType === option.id ? 'active' : ''}" data-source-type="${option.id}">${option.label}</button>
        `).join('')}
      </div>
      <div class="plugin-load-row">
        <input id="pluginSourceInput" type="text" value="${panel.sourceInput}" placeholder="${sourcePlaceholder[panel.sourceType]}">
        <button class="btn btn-primary" data-action="load-plugin"><i data-lucide="download"></i> 加载</button>
      </div>
    </section>

    <section class="plugin-section">
      <div class="plugin-section-head">
        <h4>关键节点</h4>
        <span>${s.pluginHooks.filter(hook => hook.enabled).length}/${s.pluginHooks.length} 已启用</span>
      </div>
      <div class="hook-group-list">
        ${hookGroups.map(group => renderHookGroup(group, s)).join('')}
      </div>
    </section>

    <div class="plugin-page-layout">
      <section class="plugin-section">
        <div class="plugin-section-head">
          <h4>已安装插件</h4>
          <span>${s.plugins.length} 个插件</span>
        </div>
        <div class="plugin-list">
          ${s.plugins.map(plugin => `
            <div class="plugin-row${plugin.id === selected?.id ? ' selected' : ''}" data-plugin-id="${plugin.id}">
              <span class="plugin-status ${plugin.enabled ? 'on' : 'off'}"></span>
              <span class="plugin-row-main">
                <span class="plugin-name">${plugin.name}</span>
                <span class="plugin-source">${plugin.source}</span>
              </span>
              <span class="plugin-version">v${plugin.version}</span>
              <button class="plugin-config-btn" data-action="configure-plugin" data-plugin-id="${plugin.id}">配置</button>
            </div>
          `).join('')}
        </div>
      </section>

      ${selected ? renderPluginSummary(selected, s) : ''}
    </div>
  </div>`;
}

function renderPluginSummary(plugin, s) {
  return `
  <section class="plugin-section selected-plugin">
    <div class="plugin-section-head">
      <h4>${plugin.name}</h4>
      <button class="plugin-toggle ${plugin.enabled ? 'active' : ''}" data-action="toggle-plugin" data-plugin-id="${plugin.id}">
        ${plugin.enabled ? '停用' : '启用'}
      </button>
    </div>
    <p>${plugin.description}</p>
    <div class="plugin-meta-grid">
      <span>版本</span><strong>${plugin.version}</strong>
      <span>来源</span><strong>${plugin.source}</strong>
      <span>信任级别</span><strong>${plugin.trust}</strong>
    </div>
    <div class="plugin-hook-tags">
      ${plugin.hooks.map(hookId => {
        const hook = s.pluginHooks.find(item => item.id === hookId);
        return `<span>${hook?.name || hookId}</span>`;
      }).join('')}
    </div>
  </section>`;
}

function renderConfigPage(plugin) {
  const settings = getSettings(plugin);
  return `
  <div class="plugin-page plugin-config-page" id="pluginPage">
    <section class="plugin-section plugin-config-head">
      <button class="btn btn-ghost" data-action="back-to-plugins"><i data-lucide="arrow-left"></i> 返回</button>
      <div>
        <h2>${plugin.name}</h2>
        <p>${plugin.description}</p>
      </div>
      <button class="btn btn-primary" data-action="save-plugin-config"><i data-lucide="save"></i> 保存配置</button>
    </section>
    <div class="plugin-config-layout">
      <section class="plugin-section">
        <div class="plugin-section-head">
          <h4>插件配置界面</h4>
          <span>${plugin.configType || 'generic'}</span>
        </div>
        ${renderConfigFields(plugin, settings)}
      </section>
      <section class="plugin-section selected-plugin">
        <div class="plugin-section-head">
          <h4>接入能力</h4>
          <button class="plugin-toggle ${plugin.enabled ? 'active' : ''}" data-action="toggle-plugin" data-plugin-id="${plugin.id}">
            ${plugin.enabled ? '停用' : '启用'}
          </button>
        </div>
        <div class="plugin-meta-grid">
          <span>版本</span><strong>${plugin.version}</strong>
          <span>来源</span><strong>${plugin.source}</strong>
          <span>信任级别</span><strong>${plugin.trust}</strong>
        </div>
        <div class="plugin-hook-tags">
          ${plugin.hooks.map(hookId => {
            const hook = getState().pluginHooks.find(item => item.id === hookId);
            return `<span>${hook?.name || hookId}</span>`;
          }).join('')}
        </div>
      </section>
    </div>
  </div>`;
}

function renderConfigFields(plugin, settings) {
  if (plugin.configType === 'library') {
    return `
    <div class="plugin-form">
      ${textField('roots', '扫描来源', settings.roots, '~/Music, /Volumes/Music')}
      ${selectField('duplicateStrategy', '重复歌曲策略', settings.duplicateStrategy, [
        ['prefer-lossless', '优先无损版本'],
        ['prefer-newest', '优先最近修改'],
        ['keep-all', '全部保留'],
      ])}
      ${checkboxField('autoPlaylist', '导入后自动生成播放列表', settings.autoPlaylist)}
    </div>`;
  }
  if (plugin.configType === 'audio') {
    return `
    <div class="plugin-form">
      ${selectField('preset', '输出曲线', settings.preset, [
        ['warm', '温暖'],
        ['flat', '平直'],
        ['bright', '明亮'],
      ])}
      ${rangeField('bass', '低频增益', settings.bass, -6, 6)}
      ${rangeField('treble', '高频增益', settings.treble, -6, 6)}
      ${checkboxField('loudness', '启用响度归一', settings.loudness)}
    </div>`;
  }
  if (plugin.configType === 'metadata') {
    return `
    <div class="plugin-form">
      ${selectField('provider', '服务提供方', settings.provider, [
        ['open-metadata', 'Open Metadata'],
        ['musicbrainz', 'MusicBrainz'],
        ['netease', '网易云音乐'],
      ])}
      ${textField('apiKey', 'API Key', settings.apiKey, '可选')}
      ${checkboxField('translateLyrics', '同步翻译歌词', settings.translateLyrics)}
    </div>`;
  }
  return `
  <div class="plugin-form">
    ${selectField('sandbox', '运行模式', settings.sandbox, [
      ['strict', '严格沙箱'],
      ['trusted', '可信插件'],
    ])}
    ${rangeField('timeout', '超时秒数', settings.timeout, 1, 30)}
  </div>`;
}

function textField(name, label, value = '', placeholder = '') {
  return `<label class="plugin-field"><span>${label}</span><input data-config-field="${name}" type="text" value="${value}" placeholder="${placeholder}"></label>`;
}

function selectField(name, label, value, options) {
  return `<label class="plugin-field"><span>${label}</span><select data-config-field="${name}">${options.map(([id, text]) => `<option value="${id}" ${value === id ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
}

function rangeField(name, label, value = 0, min, max) {
  return `<label class="plugin-field"><span>${label} <strong>${value}</strong></span><input data-config-field="${name}" type="range" min="${min}" max="${max}" value="${value}"></label>`;
}

function checkboxField(name, label, checked) {
  return `<label class="plugin-check"><input data-config-field="${name}" type="checkbox" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
}

function savePluginConfig(root) {
  const s = getState();
  const pluginId = s.pluginPanel.configPluginId;
  if (!pluginId) return;
  const next = { ...(s.pluginSettings[pluginId] || {}) };
  root.querySelectorAll('[data-config-field]').forEach(field => {
    if (field.type === 'checkbox') next[field.dataset.configField] = field.checked;
    else if (field.type === 'range') next[field.dataset.configField] = Number(field.value);
    else next[field.dataset.configField] = field.value;
  });
  setState({ pluginSettings: { ...s.pluginSettings, [pluginId]: next } });
  if (isTauri()) {
    savePluginSettings(pluginId, next).catch(error => {
      console.warn('[plugin] save settings failed', error);
      showToast('插件配置保存失败', 'error');
    });
  }
  showToast('插件配置已保存');
}

function togglePlugin(pluginId) {
  const current = getState().plugins.find(plugin => plugin.id === pluginId);
  if (!current) return;
  const nextEnabled = !current.enabled;
  applyPluginUpdate({ ...current, enabled: nextEnabled });
  if (!isTauri()) return;
  setPluginEnabled(pluginId, nextEnabled)
    .then(updated => {
      if (updated) applyPluginUpdate(updated);
    })
    .catch(error => {
      console.warn('[plugin] toggle failed', error);
      applyPluginUpdate(current);
      showToast('切换插件失败', 'error');
    });
}

function applyPluginUpdate(plugin) {
  const s = getState();
  const exists = s.plugins.some(item => item.id === plugin.id);
  const plugins = exists
    ? s.plugins.map(item => (item.id === plugin.id ? { ...item, ...plugin } : item))
    : [plugin, ...s.plugins];
  const pluginSettings = plugin.settings && typeof plugin.settings === 'object'
    ? { ...s.pluginSettings, [plugin.id]: plugin.settings }
    : s.pluginSettings;
  setState({ plugins, pluginSettings });
}

function loadPlugin() {
  const s = getState();
  const input = s.pluginPanel.sourceInput.trim();
  if (!input) {
    showToast('请输入插件来源', 'error');
    return;
  }

  const resolvedType = inferSourceType(input, s.pluginPanel.sourceType);
  const sourcePayload = { type: resolvedType, value: input, name: inferPluginName(input) };

  if (!isTauri()) {
    const id = `plug-${Date.now()}`;
    const plugin = {
      id,
      name: sourcePayload.name,
      version: '0.1.0',
      source: `${resolvedType}:${input}`,
      enabled: true,
      trust: resolvedType === 'local' ? 'local' : 'sandboxed',
      hooks: ['app:init', 'library:source-resolve', 'playback:before-play', 'ui:plugin-view'],
      description: '从界面模拟加载的第三方插件，运行时接入后会按声明节点执行。',
      configType: 'generic',
      settings: { sandbox: 'strict', timeout: 10 },
    };
    applyPluginUpdate(plugin);
    setState({ pluginPanel: { ...getState().pluginPanel, sourceInput: '', selectedPluginId: id } });
    showToast('插件已加入模拟列表');
    return;
  }

  loadPluginSource(sourcePayload)
    .then(plugin => {
      if (!plugin) {
        showToast('插件加载失败', 'error');
        return;
      }
      applyPluginUpdate(plugin);
      setState({ pluginPanel: { ...getState().pluginPanel, sourceInput: '', selectedPluginId: plugin.id } });
      showToast('插件已加载');
    })
    .catch(error => {
      console.warn('[plugin] load failed', error);
      showToast('插件加载失败', 'error');
    });
}

function renderHookGroup(group, s) {
  const hooks = s.pluginHooks.filter(hook => hook.group === group.id);
  if (!hooks.length) return '';
  const enabled = hooks.filter(hook => hook.enabled).length;
  return `
  <div class="hook-group">
    <div class="hook-group-head">
      <h5>${group.name}</h5>
      <span>${enabled}/${hooks.length}</span>
    </div>
    <div class="hook-grid page-grid">
      ${hooks.map(hook => {
        const count = s.plugins.filter(plugin => plugin.enabled && plugin.hooks.includes(hook.id)).length;
        return `
        <button class="hook-card${hook.enabled ? ' active' : ''}" data-hook-id="${hook.id}">
          <span class="hook-top">
            <span>${hook.name}</span>
            <span class="hook-switch">${hook.enabled ? '开' : '关'}</span>
          </span>
          <span class="hook-desc">${hook.description}</span>
          <span class="hook-count">${count} 个插件接入</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function getSettings(plugin) {
  const settings = getState().pluginSettings[plugin.id];
  if (settings) return settings;
  if (plugin.configType === 'audio') return { preset: 'flat', bass: 0, treble: 0, loudness: false };
  if (plugin.configType === 'metadata') return { provider: 'musicbrainz', apiKey: '', translateLyrics: false };
  if (plugin.configType === 'library') return { roots: '~/Music', duplicateStrategy: 'prefer-lossless', autoPlaylist: true };
  return { sandbox: 'strict', timeout: 10 };
}

function inferPluginName(input) {
  const clean = input.replace(/\/+$/, '');
  const last = clean.split(/[/:]/).filter(Boolean).pop() || 'Custom Plugin';
  return last.replace(/^@/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function inferSourceType(input, selectedType) {
  if (/^https?:\/\//.test(input)) return input.endsWith('.git') || input.includes('github.com') ? 'git' : 'url';
  if (input.startsWith('@') || /^[a-z0-9-]+\/[a-z0-9-]+$/i.test(input)) return 'npm';
  return selectedType === 'local' ? 'local' : selectedType;
}
