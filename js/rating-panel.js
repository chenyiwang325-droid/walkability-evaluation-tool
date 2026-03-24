/**
 * 可步行性专家评价工具 - 评价面板模块
 */

const RatingPanel = {
  /**
   * 渲染评价面板
   */
  render() {
    const container = document.getElementById('ratingPanel');
    if (!container) return;

    const levelConfig = AppState.getCurrentLevelConfig();
    if (!levelConfig) {
      container.innerHTML = '<div class="rating-empty"><i class="fas fa-clipboard-list"></i><p>请先选择评价层级并加载图像</p></div>';
      return;
    }

    const currentImage = AppState.getCurrentImage();
    if (!currentImage) {
      container.innerHTML = '<div class="rating-empty"><i class="fas fa-image"></i><p>暂无图像</p></div>';
      return;
    }

    // 获取当前评价数据
    const rating = AppState.getCurrentRating();
    const answers = rating?.answers || {};

    // 构建HTML
    let html = '';

    // 评分标准按钮
    html += `
      <div class="rating-standards-btn-container">
        <button class="btn btn-outline" onclick="RatingPanel.showRatingStandards()">
          <i class="fas fa-book"></i> 查看评分标准
        </button>
      </div>
    `;

    // 层级评价
    html += this.renderLevelRating(levelConfig, answers);

    // 各维度评价
    html += this.renderDimensionRatings(levelConfig, answers);

    // 问题归因选择
    html += this.renderIssueSelection(levelConfig, answers);

    // 自动保存状态
    html += `
      <div class="save-status" id="saveStatus">
        <i class="fas fa-check-circle"></i>
        <span>已自动保存</span>
      </div>
    `;

    container.innerHTML = html;

    // 绑定事件
    this.bindEvents();
  },

  /**
   * 显示评分标准侧边面板
   */
  async showRatingStandards() {
    const levelId = AppState.currentLevel;
    const levelConfig = AppState.getCurrentLevelConfig();

    // 检查是否为服务器模式
    if (!DataManager.useServer) {
      alert('查看评分标准需要启动服务器模式。\n\n请通过"启动工具.bat"启动服务器。');
      return;
    }

    // 显示加载中
    this.showStandardsPanel('<div class="standards-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>');

    try {
      const result = await DataManager.getRatingStandards(levelId);
      if (result.success && result.content) {
        const htmlContent = this.parseMarkdown(result.content);
        this.showStandardsPanel(htmlContent, levelConfig?.name || levelId);
      } else {
        this.showStandardsPanel('<div class="standards-error"><i class="fas fa-exclamation-circle"></i> 加载失败：' + (result.message || '未知错误') + '</div>');
      }
    } catch (error) {
      console.error('加载评分标准失败:', error);
      this.showStandardsPanel('<div class="standards-error"><i class="fas fa-exclamation-circle"></i> 加载失败</div>');
    }
  },

  /**
   * 显示评分标准面板
   */
  showStandardsPanel(content, title = '评分标准') {
    // 移除已存在的面板
    const existingPanel = document.getElementById('standardsPanel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // 创建侧边面板
    const panel = document.createElement('div');
    panel.id = 'standardsPanel';
    panel.className = 'standards-side-panel';
    panel.innerHTML = `
      <div class="standards-panel-header">
        <h3><i class="fas fa-book"></i> ${title}评分标准</h3>
        <div class="standards-panel-controls">
          <button class="standards-toggle-btn" onclick="RatingPanel.toggleStandardsPanel()" title="折叠/展开">
            <i class="fas fa-chevron-right"></i>
          </button>
          <button class="standards-close-btn" onclick="RatingPanel.hideRatingStandards()" title="关闭">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="standards-panel-content">
        ${content}
      </div>
    `;

    document.body.appendChild(panel);

    // 动画显示
    setTimeout(() => {
      panel.classList.add('show');
    }, 10);
  },

  /**
   * 折叠/展开评分标准面板
   */
  toggleStandardsPanel() {
    const panel = document.getElementById('standardsPanel');
    if (!panel) return;

    const isCollapsed = panel.classList.toggle('collapsed');
    const toggleBtn = panel.querySelector('.standards-toggle-btn i');

    if (toggleBtn) {
      toggleBtn.className = isCollapsed ? 'fas fa-chevron-left' : 'fas fa-chevron-right';
    }
  },

  /**
   * 隐藏评分标准面板
   */
  hideRatingStandards() {
    const panel = document.getElementById('standardsPanel');
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        panel.remove();
      }, 300);
    }
  },

  /**
   * 简单的 Markdown 解析
   */
  parseMarkdown(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // 转义 HTML 特殊字符
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // === 第一步：按行分割，逐块处理表格 ===
    const lines = html.split('\n');
    let result = [];
    let inTable = false;
    let tableHeader = null;
    let tableSeparator = null;
    let tableBody = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 检测表格行：以 | 开头和结尾
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // 检测分隔行：只包含 |、-、:、空格，且必须包含至少一个 -
        const trimmed = line.trim();
        if (/^\|[\s\-:|]+\|$/.test(trimmed) && trimmed.includes('-')) {
          if (tableHeader && !tableSeparator) {
            tableSeparator = line;
          }
          continue;
        }

        if (!tableHeader) {
          // 第一行是表头
          tableHeader = line;
          inTable = true;
        } else if (tableSeparator) {
          // 表格数据行
          tableBody.push(line);
        }
      } else {
        // 非表格行，如果之前在处理表格，则先输出表格
        if (inTable && tableHeader && tableSeparator && tableBody.length > 0) {
          result.push(this.renderTable(tableHeader, tableSeparator, tableBody));
          tableHeader = null;
          tableSeparator = null;
          tableBody = [];
          inTable = false;
        }
        result.push(line);
      }
    }

    // 处理文件末尾的表格
    if (inTable && tableHeader && tableSeparator && tableBody.length > 0) {
      result.push(this.renderTable(tableHeader, tableSeparator, tableBody));
    }

    html = result.join('\n');

    // === 第二步：处理分隔线 ===
    html = html.replace(/^(---|\*\*\*|___)$/gm, '<hr class="standards-divider">');

    // === 第三步：处理标题 ===
    html = html.replace(/^#### (.+)$/gm, '<h4 class="standards-h4">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="standards-h3">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="standards-h2">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="standards-h1">$1</h1>');

    // === 第四步：处理行内格式 ===
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // === 第五步：处理列表 ===
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    // === 第六步：处理警告/注意 ===
    html = html.replace(/⚠️\s*(.+)/g, '<div class="standards-warning"><i class="fas fa-exclamation-triangle"></i> $1</div>');

    // === 第七步：包装内容 ===
    html = '<div class="standards-content">' + html + '</div>';

    return html;
  },

  /**
   * 渲染表格
   */
  renderTable(headerRow, separatorRow, bodyRows) {
    // 解析表头：| col1 | col2 | → ['col1', 'col2']
    const headers = headerRow.split('|').slice(1, -1).map(h => h.trim());

    // 解析对齐方式
    const alignments = separatorRow.split('|').slice(1, -1).map(s => {
      s = s.trim();
      if (s.startsWith(':') && s.endsWith(':')) return 'center';
      if (s.endsWith(':')) return 'right';
      return 'left';
    });

    // 解析数据行
    const rows = bodyRows.map(row =>
      row.split('|').slice(1, -1).map(cell => cell.trim())
    );

    // 构建 HTML
    let tableHtml = '<table class="standards-table">\n<thead>\n<tr>\n';
    headers.forEach((h, i) => {
      const align = alignments[i] || 'left';
      tableHtml += `<th style="text-align:${align}">${h}</th>\n`;
    });
    tableHtml += '</tr>\n</thead>\n<tbody>\n';

    rows.forEach(row => {
      tableHtml += '<tr>\n';
      row.forEach((cell, i) => {
        const align = alignments[i] || 'left';
        tableHtml += `<td style="text-align:${align}">${cell}</td>\n`;
      });
      tableHtml += '</tr>\n';
    });

    tableHtml += '</tbody>\n</table>\n';
    return tableHtml;
  },

  /**
   * 渲染层级评价
   */
  renderLevelRating(levelConfig, answers) {
    const ratingScale = AppState.config.ratingScale;
    const currentRating = answers.level_rating || null;

    let optionsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const label = ratingScale[i];
      const selected = currentRating == i ? 'selected' : '';
      optionsHtml += `
        <button class="scale-btn ${selected}" data-value="${i}" data-question="level_rating">
          ${label}
        </button>
      `;
    }

    return `
      <div class="rating-section animate-slide-up">
        <div class="rating-section-header">
          <div class="rating-section-title">
            <i class="fas fa-layer-group"></i>
            ${levelConfig.name}评价
          </div>
        </div>

        <div class="collapsible">
          <div class="collapsible-header" onclick="RatingPanel.toggleCollapsible(this)">
            <div class="collapsible-title">
              <i class="fas fa-info-circle"></i>
              <span>查看层级说明</span>
            </div>
            <i class="fas fa-chevron-down collapsible-arrow"></i>
          </div>
          <div class="collapsible-content">
            <div class="collapsible-inner">
              ${levelConfig.description}
            </div>
          </div>
        </div>

        <div class="rating-question">该街道断面${levelConfig.name}的评价应为？</div>
        <div class="scale-buttons">
          ${optionsHtml}
        </div>
      </div>
    `;
  },

  /**
   * 渲染各维度评价
   */
  renderDimensionRatings(levelConfig, answers) {
    const ratingScale = AppState.config.ratingScale;
    let html = '<div class="rating-section animate-slide-up" style="animation-delay: 0.1s">';

    html += `
      <div class="rating-section-header">
        <div class="rating-section-title">
          <i class="fas fa-th-list"></i>
          分维度评价
        </div>
      </div>
    `;

    levelConfig.dimensions.forEach((dim) => {
      const currentRating = answers[`dim_${dim.id}`] || null;

      let optionsHtml = '';
      for (let i = 1; i <= 5; i++) {
        const label = ratingScale[i];
        const selected = currentRating == i ? 'selected' : '';
        optionsHtml += `
          <button class="scale-btn ${selected}" data-value="${i}" data-question="dim_${dim.id}">
            ${label}
          </button>
        `;
      }

      html += `
        <div class="rating-card ${currentRating ? 'completed' : ''}">
          <div class="collapsible">
            <div class="collapsible-header" onclick="RatingPanel.toggleCollapsible(this)">
              <div class="collapsible-title">
                <i class="fas fa-info-circle"></i>
                <span>${dim.name}说明</span>
              </div>
              <i class="fas fa-chevron-down collapsible-arrow"></i>
            </div>
            <div class="collapsible-content">
              <div class="collapsible-inner">
                ${dim.description}
              </div>
            </div>
          </div>

          <div class="rating-question">${dim.name}的评价应为？</div>
          <div class="scale-buttons">
            ${optionsHtml}
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  /**
   * 渲染问题归因选择
   */
  renderIssueSelection(levelConfig, answers) {
    const selectedIssues = answers.issue_selection || [];

    // 构建选项：各维度 + 无明显问题
    const options = [
      ...levelConfig.dimensions.map(d => ({ id: d.id, name: d.name })),
      { id: 'no_issue', name: '无明显问题或影响较为轻微' }
    ];

    let tagsHtml = '';
    options.forEach(opt => {
      const checked = selectedIssues.includes(opt.id) ? 'checked' : '';
      const icon = checked ? 'fa-check-circle' : 'fa-circle';
      tagsHtml += `
        <label class="checkbox-tag ${checked}" data-value="${opt.id}">
          <i class="fas ${icon}"></i>
          <span>${opt.name}</span>
          <input type="checkbox" hidden ${checked ? 'checked' : ''}>
        </label>
      `;
    });

    return `
      <div class="rating-section animate-slide-up" style="animation-delay: 0.2s">
        <div class="rating-section-header">
          <div class="rating-section-title">
            <i class="fas fa-tags"></i>
            问题归因选择
          </div>
        </div>

        <div class="rating-question">若该街道空间的${levelConfig.name}感知存在问题，其问题归因为？（可多选）</div>
        <div class="checkbox-tags" id="issueTags">
          ${tagsHtml}
        </div>
      </div>
    `;
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    // 量表按钮点击
    document.querySelectorAll('.scale-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.handleScaleClick(e.target.closest('.scale-btn'));
      });
    });

    // 多选标签点击
    document.querySelectorAll('.checkbox-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleTagClick(e.currentTarget);
      });
    });
  },

  /**
   * 处理量表按钮点击
   */
  handleScaleClick(btn) {
    const questionId = btn.dataset.question;
    const value = parseInt(btn.dataset.value);

    // 更新UI
    const container = btn.closest('.scale-buttons');
    container.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    // 更新卡片状态
    const card = btn.closest('.rating-card');
    if (card) {
      card.classList.add('completed');
    }

    // 保存数据
    this.saveAnswer(questionId, value);
  },

  /**
   * 处理标签点击
   */
  handleTagClick(tag) {
    const value = tag.dataset.value;
    const checkbox = tag.querySelector('input');
    const icon = tag.querySelector('i');

    // 切换状态
    if (tag.classList.contains('checked')) {
      tag.classList.remove('checked');
      checkbox.checked = false;
      icon.className = 'fas fa-circle';
    } else {
      tag.classList.add('checked');
      checkbox.checked = true;
      icon.className = 'fas fa-check-circle';
    }

    // 收集所有选中的值
    const selected = [];
    document.querySelectorAll('#issueTags .checkbox-tag.checked').forEach(t => {
      selected.push(t.dataset.value);
    });

    // 保存数据
    this.saveAnswer('issue_selection', selected);
  },

  /**
   * 保存答案
   */
  saveAnswer(questionId, value) {
    const currentImage = AppState.getCurrentImage();
    if (!currentImage || !AppState.currentLevel) return;

    // 获取当前评价数据
    let rating = AppState.getCurrentRating() || { answers: {}, timestamp: null };
    if (!rating.answers) rating.answers = {};

    rating.answers[questionId] = value;
    rating.timestamp = new Date().toISOString();

    // 保存到状态和localStorage
    DataManager.saveRating(AppState.currentLevel, currentImage.name, rating.answers);

    // 显示保存状态
    this.showSaveStatus();

    // 更新进度
    if (typeof App !== 'undefined') {
      App.updateProgress();
    }
  },

  /**
   * 显示保存状态
   */
  showSaveStatus() {
    const status = document.getElementById('saveStatus');
    if (status) {
      status.classList.add('visible');
      setTimeout(() => {
        status.classList.remove('visible');
      }, 2000);
    }
  },

  /**
   * 切换折叠面板
   */
  toggleCollapsible(header) {
    const collapsible = header.closest('.collapsible');
    collapsible.classList.toggle('expanded');
  },

  /**
   * 加载当前图像的评价状态
   */
  loadCurrentState() {
    const rating = AppState.getCurrentRating();
    if (!rating || !rating.answers) return;

    // 更新量表按钮
    Object.entries(rating.answers).forEach(([questionId, value]) => {
      if (questionId === 'issue_selection') return;

      const btn = document.querySelector(`.scale-btn[data-question="${questionId}"][data-value="${value}"]`);
      if (btn) {
        const container = btn.closest('.scale-buttons');
        if (container) {
          container.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        }

        const card = btn.closest('.rating-card');
        if (card) card.classList.add('completed');
      }
    });

    // 更新多选标签
    const selectedIssues = rating.answers.issue_selection || [];
    document.querySelectorAll('#issueTags .checkbox-tag').forEach(tag => {
      const value = tag.dataset.value;
      const icon = tag.querySelector('i');
      const checkbox = tag.querySelector('input');

      if (selectedIssues.includes(value)) {
        tag.classList.add('checked');
        checkbox.checked = true;
        icon.className = 'fas fa-check-circle';
      } else {
        tag.classList.remove('checked');
        checkbox.checked = false;
        icon.className = 'fas fa-circle';
      }
    });
  }
};

// 导出
window.RatingPanel = RatingPanel;
