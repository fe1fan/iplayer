import { getState, setState } from '../state.js';
import { showToast } from './toast.js';

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

export function render() {
  const s = getState();
  const panel = s.pluginPanel;
  const selected = s.plugins.find(plugin => plugin.id === panel.selectedPluginId) || s.plugins[0];
  const openCls = panel.open ? ' open' : '';

  return `
  <div class="plugin-panel${openCls}" id="pluginPanel" role="dialog" aria-label="插件系统">
    <div class="panel-header">
      <div>
        <h3>插件系统</h3>
        <p>关键节点扩展配置</p>
      </div>
      <button data-action="close" aria-label="关闭"><i data-lucide="x"></i></button>
    </div>
    <div class="panel-body">
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
        <div class="hook-grid">
          ${s.pluginHooks.map(hook => {
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
      </section>

      <section class="plugin-section">
        <div class="plugin-section-head">
          <h4>已安装插件</h4>
          <span>${s.plugins.filter(plugin => plugin.enabled).length}/${s.plugins.length} 运行中</span>
        </div>
        <div class="plugin-list">
          ${s.plugins.map(plugin => `
            <button class="plugin-row${plugin.id === selected?.id ? ' selected' : ''}" data-plugin-id="${plugin.id}">
              <span class="plugin-status ${plugin.enabled ? 'on' : 'off'}"></span>
              <span class="plugin-row-main">
                <span class="plugin-name">${plugin.name}</span>
                <span class="plugin-source">${plugin.source}</span>
              </span>
              <span class="plugin-version">v${plugin.version}</span>
            </button>
          `).join('')}
        </div>
      </section>

      ${selected ? `
      <section class="plugin-section selected-plugin">
        <div class="plugin-section-head">
          <h4>${selected.name}</h4>
          <button class="plugin-toggle ${selected.enabled ? 'active' : ''}" data-action="toggle-plugin" data-plugin-id="${selected.id}">
            ${selected.enabled ? '停用' : '启用'}
          </button>
        </div>
        <p>${selected.description}</p>
        <div class="plugin-meta-grid">
          <span>版本</span><strong>${selected.version}</strong>
          <span>来源</span><strong>${selected.source}</strong>
          <span>信任级别</span><strong>${selected.trust}</strong>
        </div>
        <div class="plugin-hook-tags">
          ${selected.hooks.map(hookId => {
            const hook = s.pluginHooks.find(item => item.id === hookId);
            return `<span>${hook?.name || hookId}</span>`;
          }).join('')}
        </div>
      </section>` : ''}
    </div>
  </div>`;
}

export function bind(root) {
  const el = root.querySelector('#pluginPanel');
  if (!el) return;

  el.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    setState({ pluginPanel: { ...getState().pluginPanel, open: false } });
  });

  el.querySelectorAll('[data-source-type]').forEach(button => {
    button.addEventListener('click', () => {
      setState({ pluginPanel: { ...getState().pluginPanel, sourceType: button.dataset.sourceType } });
    });
  });

  el.querySelector('#pluginSourceInput')?.addEventListener('input', event => {
    getState().pluginPanel.sourceInput = event.target.value;
  });

  el.querySelector('[data-action="load-plugin"]')?.addEventListener('click', () => loadPlugin());

  el.querySelectorAll('[data-hook-id]').forEach(button => {
    button.addEventListener('click', () => {
      const hooks = getState().pluginHooks.map(hook =>
        hook.id === button.dataset.hookId ? { ...hook, enabled: !hook.enabled } : hook
      );
      setState({ pluginHooks: hooks });
    });
  });

  el.querySelectorAll('.plugin-row[data-plugin-id]').forEach(row => {
    row.addEventListener('click', () => {
      setState({ pluginPanel: { ...getState().pluginPanel, selectedPluginId: row.dataset.pluginId } });
    });
  });

  el.querySelector('[data-action="toggle-plugin"]')?.addEventListener('click', event => {
    const pluginId = event.currentTarget.dataset.pluginId;
    const plugins = getState().plugins.map(plugin =>
      plugin.id === pluginId ? { ...plugin, enabled: !plugin.enabled } : plugin
    );
    setState({ plugins });
  });
}

function loadPlugin() {
  const s = getState();
  const input = s.pluginPanel.sourceInput.trim();
  if (!input) {
    showToast('请输入插件来源', 'error');
    return;
  }

  const id = `plug-${Date.now()}`;
  const resolvedType = inferSourceType(input, s.pluginPanel.sourceType);
  const plugin = {
    id,
    name: inferPluginName(input),
    version: '0.1.0',
    source: `${resolvedType}:${input}`,
    enabled: true,
    trust: resolvedType === 'local' ? 'local' : 'sandboxed',
    hooks: ['library:before-load', 'playback:before-play'],
    description: '从界面模拟加载的第三方插件，运行时接入后会按声明节点执行。',
  };

  setState({
    plugins: [plugin, ...s.plugins],
    pluginPanel: { ...s.pluginPanel, sourceInput: '', selectedPluginId: id },
  });
  showToast('插件已加入模拟列表');
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
