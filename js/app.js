/**
 * 可步行性专家评价工具 - 主应用入口
 */

const App = {
  /**
   * 初始化应用
   */
  async init() {
    console.log('初始化可步行性专家评价工具...');

    try {
      // 加载配置
      await DataManager.loadDefaultConfig();
      await DataManager.loadRatings();

      // 设置默认层级
      if (AppState.config && AppState.config.levels && AppState.config.levels.length > 0) {
        AppState.currentLevel = AppState.config.levels[0].id;
      }

      // 检查可用图像（填充缓存）
      await this.checkAvailableImages();

      // 初始化状态
      AppState.initialized = true;

      // 渲染界面
      this.render();

      // 绑定全局事件
      this.bindGlobalEvents();

      console.log('应用初始化完成');
    } catch (error) {
      console.error('应用初始化失败:', error);
      alert('应用初始化失败，请刷新页面重试');
    }
  },

  /**
   * 渲染界面
   */
  render() {
    // 更新层级标签
    this.renderLevelTabs();

    // 更新模式切换器
    this.updateModeSwitcher();

    // 更新层级主题
    this.updateLevelTheme();

    // 根据模式渲染内容
    if (AppState.currentMode === 'edit') {
      this.renderEditorMode();
    } else if (AppState.showWelcome || AppState.images.length === 0) {
      this.renderWelcomeScreen();
    } else if (AppState.currentMode === 'browse') {
      // 浏览模式：单页和画册都由 renderBrowseView 处理
      this.renderBrowseView();
    } else if (AppState.currentView === 'gallery') {
      this.renderGalleryView();
    } else {
      this.renderSingleView();
    }
  },

  /**
   * 渲染层级标签
   */
  renderLevelTabs() {
    const container = document.getElementById('levelTabs');
    if (!container || !AppState.config) return;

    const levels = AppState.config.levels;
    let html = '';

    levels.forEach(level => {
      const isActive = AppState.currentLevel === level.id;
      const icons = {
        'accessibility': 'route',
        'safety': 'shield-alt',
        'comfort': 'couch',
        'pleasantness': 'smile-beam'
      };
      html += `
        <button class="level-tab ${isActive ? 'active' : ''}"
                data-level="${level.id}"
                onclick="App.selectLevel('${level.id}')">
          <i class="fas fa-${icons[level.id] || 'circle'}"></i>
          ${level.name}
        </button>
      `;
    });

    container.innerHTML = html;
  },

  /**
   * 选择层级
   */
  async selectLevel(levelId) {
    const previousLevel = AppState.currentLevel;
    AppState.currentLevel = levelId;
    AppState.currentImageIndex = 0;

    // 更新缓存的当前层级数量
    if (this._availableImagesCache) {
      const levelMap = {
        'accessibility': ['通达性', 'accessibility'],
        'safety': ['安全性', 'safety'],
        'comfort': ['舒适性', 'comfort'],
        'pleasantness': ['愉悦性', 'pleasantness']
      };

      this._availableImagesCache.currentLevelCount = 0;
      for (const key in this._availableImagesCache.levels) {
        const level = this._availableImagesCache.levels[key];
        if (level.folder === levelMap[levelId]?.[0] ||
            level.folder.toLowerCase() === levelMap[levelId]?.[1]) {
          this._availableImagesCache.currentLevelCount = level.count;
          break;
        }
      }
    }

    // 检查新层级是否已有数据
    const hasLevelData = AppState.hasLevelData(levelId);

    // 如果使用服务器模式，自动加载新层级的图像
    if (DataManager.useServer) {
      try {
        const result = await ImageLoader.loadFromServer(levelId);
        if (result.images.length > 0) {
          this.showToast(`已加载 ${result.images.length} 张图像`, 'success');
          // 保持之前的模式选择，如果已经在评价界面则继续，否则显示欢迎页
          if (!AppState.showWelcome && AppState.currentMode) {
            // 已在评价界面，保持当前模式
            this.render();
          } else {
            // 在欢迎页，保持欢迎页让用户选择模式
            this.render();
          }
          return;
        }
      } catch (error) {
        console.warn('切换层级加载图像失败:', error);
        // 服务器没有该层级数据，清空该层级图像，回到欢迎页
        AppState.levelImages[levelId] = [];
        AppState.levelReferenceData[levelId] = {};
        AppState.showWelcome = true;
      }
    } else {
      // 静态/本地模式：若该层级尚未加载，尝试从静态 manifest 自动加载
      if (!hasLevelData) {
        try {
          const result = await ImageLoader.loadFromStatic(levelId);
          if (result.images.length > 0) {
            this.showToast(`已加载 ${result.images.length} 张图像`, 'success');
            if (!AppState.showWelcome && AppState.currentMode) {
              this.render();
            } else {
              this.render();
            }
            return;
          }
        } catch (error) {
          console.warn('静态加载图像失败:', error);
        }
        // 静态加载也失败，回退到欢迎页让用户手动导入
        AppState.showWelcome = true;
        this.render();
        return;
      }
      // 有数据，继续显示（保持盲评模式状态）
      AppState.showWelcome = false;
      this.showToast(`已切换到${AppState.getCurrentLevelConfig()?.name || levelId}`, 'success');
    }

    this.render();
  },

  /**
   * 更新模式切换器
   */
  updateModeSwitcher() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      const mode = btn.dataset.mode;
      btn.classList.toggle('active', mode === AppState.currentMode);

      // 盲评模式下禁用所有模式切换按钮
      if (AppState.blindRatingMode) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.title = '盲评模式下无法切换模式，请返回欢迎页';
      } else {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.cursor = '';
        btn.title = '';
      }
    });
  },

  /**
   * 切换模式
   */
  switchMode(mode) {
    // 盲评模式下禁止切换任何模式
    if (AppState.blindRatingMode) {
      this.showToast('盲评模式下无法切换模式，请返回欢迎页重新选择', 'warning');
      return;
    }
    AppState.currentMode = mode;
    this.render();
  },

  /**
   * 更新层级主题
   */
  updateLevelTheme() {
    const level = AppState.currentLevel || 'accessibility';
    document.body.setAttribute('data-level', level);
  },

  /**
   * 渲染欢迎页面
   */
  renderWelcomeScreen() {
    const container = document.getElementById('mainContent');
    if (!container) return;

    const currentLevel = AppState.currentLevel;
    const levelConfig = AppState.getCurrentLevelConfig();

    // 检查可用的预置图像
    const availableImages = this.checkAvailableImagesSync();
    console.log('渲染欢迎页，可用图像:', availableImages);

    // 检查当前层级是否已加载数据
    const hasCurrentLevelData = currentLevel &&
      AppState.levelImages[currentLevel] &&
      AppState.levelImages[currentLevel].length > 0;
    const loadedImageCount = hasCurrentLevelData ? AppState.levelImages[currentLevel].length : 0;
    const hasReferenceData = currentLevel &&
      AppState.levelReferenceData[currentLevel] &&
      Object.keys(AppState.levelReferenceData[currentLevel]).length > 0;

    // 当前选择的模式
    const selectedMode = AppState.blindRatingMode ? 'blind' : 'browse';

    container.innerHTML = `
      <div class="welcome-screen-v2">
        <!-- 背景装饰 -->
        <div class="welcome-bg-decoration">
          <div class="welcome-circle welcome-circle-1"></div>
          <div class="welcome-circle welcome-circle-2"></div>
          <div class="welcome-circle welcome-circle-3"></div>
        </div>

        <!-- 主内容 -->
        <div class="welcome-content">
          <!-- 标题区 -->
          <div class="welcome-header">
            <div class="welcome-badge">
              <i class="fas fa-walking"></i>
              <span>专业评价工具</span>
            </div>
            <h1 class="welcome-title">可步行性专家评价系统</h1>
            <p class="welcome-desc">
              基于建成环境步行性评估框架，为街道空间提供多维度专业评价支持
            </p>
          </div>

          <!-- 当前层级显示 -->
          ${levelConfig ? `
          <div class="welcome-current-level">
            <div class="level-badge level-badge-${currentLevel}">
              <i class="fas fa-${this.getLevelIcon(currentLevel)}"></i>
              <span>当前层级：${levelConfig.name}</span>
            </div>
            <p class="level-desc">${levelConfig.description}</p>
          </div>
          ` : ''}

          <!-- 已加载数据状态 -->
          ${hasCurrentLevelData ? `
          <div class="welcome-status-card">
            <div class="status-card-header">
              <i class="fas fa-check-circle"></i>
              <span>数据已就绪</span>
            </div>
            <div class="status-card-body">
              <div class="status-item">
                <i class="fas fa-images"></i>
                <span>已加载 <strong>${loadedImageCount}</strong> 张图像</span>
              </div>
              <div class="status-item">
                <i class="fas fa-file-code"></i>
                <span>参考数据：${hasReferenceData ? '已加载' : '未加载'}</span>
              </div>
            </div>
            <div class="status-card-actions">
              <button class="status-action-btn" onclick="App.loadImages()" title="重新选择图像文件夹">
                <i class="fas fa-folder-open"></i>
                重新加载
              </button>
              <button class="status-action-btn status-action-btn-danger" onclick="App.clearCurrentLevelData()" title="清空当前层级数据">
                <i class="fas fa-trash"></i>
                清空数据
              </button>
            </div>
          </div>
          ` : ''}

          <!-- 模式选择区域（已加载数据时显示）-->
          ${hasCurrentLevelData ? `
          <div class="welcome-mode-selector">
            <h3>选择评价模式</h3>
            <div class="mode-options">
              <div class="mode-option ${selectedMode === 'blind' ? 'active' : ''}" onclick="App.selectWelcomeMode('blind')">
                <div class="mode-option-icon">
                  <i class="fas fa-eye-slash"></i>
                </div>
                <div class="mode-option-content">
                  <h4>盲评模式</h4>
                  <p>直接进入打分，无法查看模型输出，避免评价偏差</p>
                </div>
                <div class="mode-option-check">
                  ${selectedMode === 'blind' ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>'}
                </div>
              </div>
              <div class="mode-option ${selectedMode === 'browse' ? 'active' : ''}" onclick="App.selectWelcomeMode('browse')">
                <div class="mode-option-icon">
                  <i class="fas fa-eye"></i>
                </div>
                <div class="mode-option-content">
                  <h4>浏览模式</h4>
                  <p>可以先浏览图像和模型输出，再手动进入打分模式</p>
                </div>
                <div class="mode-option-check">
                  ${selectedMode === 'browse' ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>'}
                </div>
              </div>
            </div>
            <button class="welcome-enter-btn" onclick="App.enterSelectedMode()">
              <i class="fas fa-arrow-right"></i>
              进入评价
            </button>
          </div>
          ` : ''}

          <!-- 一键加载区域（如果有预置图像且未加载）-->
          ${!hasCurrentLevelData && availableImages.hasImages && availableImages.currentLevelCount > 0 ? `
          <div class="welcome-quick-load">
            <div class="quick-load-banner">
              <div class="quick-load-icon">
                <i class="fas fa-magic"></i>
              </div>
              <div class="quick-load-info">
                <h4>发现预置图像</h4>
                <p>当前层级「${levelConfig ? levelConfig.name : ''}」已有 <strong>${availableImages.currentLevelCount}</strong> 张图像待评价</p>
              </div>
              <button class="quick-load-btn" onclick="App.quickLoadImages()">
                <i class="fas fa-bolt"></i>
                一键加载
              </button>
            </div>
          </div>
          ` : ''}

          <!-- 上传区域（未加载数据时显示）-->
          ${!hasCurrentLevelData ? `
          <div class="welcome-upload-v2">
            <div class="upload-zone-v2" onclick="App.loadImages()">
              <div class="upload-zone-icon">
                <i class="fas fa-folder-open"></i>
              </div>
              <div class="upload-zone-text">
                <h4>选择图像文件夹</h4>
                <p>或将图像文件夹拖拽到此区域</p>
              </div>
              <div class="upload-zone-hint">
                <span><i class="fas fa-magic"></i> 支持自动识别层级</span>
                <span><i class="fas fa-file-image"></i> 支持 JPG / PNG / WebP</span>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- 快捷操作 -->
          <div class="welcome-actions">
            <button class="action-btn action-btn-secondary" onclick="App.showImportOptions()">
              <i class="fas fa-file-import"></i>
              导入评价数据
            </button>
            <button class="action-btn action-btn-secondary" onclick="App.switchMode('edit')">
              <i class="fas fa-cog"></i>
              配置问卷选项
            </button>
          </div>
        </div>

        <!-- 底部信息 -->
        <div class="welcome-footer">
          <div class="footer-status ${DataManager.useServer ? 'status-online' : 'status-offline'}">
            <i class="fas fa-${DataManager.useServer ? 'server' : 'database'}"></i>
            <span>${DataManager.useServer ? '服务器模式 · 数据自动保存到文件' : '浏览器模式 · 数据保存在本地存储'}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 在欢迎页面选择模式
   */
  selectWelcomeMode(mode) {
    AppState.blindRatingMode = (mode === 'blind');
    this.render();
  },

  /**
   * 进入选择的模式
   */
  enterSelectedMode() {
    AppState.showWelcome = false;
    if (AppState.blindRatingMode) {
      AppState.currentMode = 'rate';
    } else {
      AppState.currentMode = 'browse';
    }
    AppState.currentView = 'single';
    AppState.currentImageIndex = 0;
    this.render();
  },

  /**
   * 同步检查可用图像（用于渲染）
   */
  checkAvailableImagesSync() {
    // 如果有缓存，使用缓存
    if (this._availableImagesCache && this._availableImagesCache.hasImages) {
      return this._availableImagesCache;
    }

    // 本地模式：检查 AppState.levelImages
    if (!DataManager.useServer) {
      const result = {
        hasImages: false,
        levels: {},
        total: 0,
        currentLevelCount: 0
      };

      // 检查每个层级是否有数据
      const levelIds = ['accessibility', 'safety', 'comfort', 'pleasantness'];
      const levelNames = {
        'accessibility': '通达性',
        'safety': '安全性',
        'comfort': '舒适性',
        'pleasantness': '愉悦性'
      };

      for (const levelId of levelIds) {
        const images = AppState.levelImages[levelId] || [];
        if (images.length > 0) {
          result.hasImages = true;
          result.levels[levelId] = {
            folder: levelNames[levelId],
            count: images.length
          };
          result.total += images.length;

          if (levelId === AppState.currentLevel) {
            result.currentLevelCount = images.length;
          }
        }
      }

      return result;
    }

    // 服务器模式：使用缓存
    if (this._availableImagesCache) {
      return this._availableImagesCache;
    }

    return { hasImages: false, levels: {}, total: 0, currentLevelCount: 0 };
  },

  /**
   * 异步检查可用图像
   */
  async checkAvailableImages() {
    console.log('检查可用图像, useServer:', DataManager.useServer);

    // 本地模式：使用同步检查
    if (!DataManager.useServer) {
      return this.checkAvailableImagesSync();
    }

    try {
      const url = `${DataManager.API_BASE}/available-images`;
      console.log('请求:', url);

      const response = await fetch(url);
      console.log('响应状态:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('API返回数据:', data);

        if (data.success) {
          const result = data.data;
          result.currentLevelCount = 0;

          // 计算当前层级数量
          const currentLevel = AppState.currentLevel;
          const levelMap = {
            'accessibility': ['通达性', 'accessibility'],
            'safety': ['安全性', 'safety'],
            'comfort': ['舒适性', 'comfort'],
            'pleasantness': ['愉悦性', 'pleasantness']
          };

          console.log('当前层级:', currentLevel);
          console.log('层级映射:', levelMap[currentLevel]);
          console.log('可用层级:', result.levels);

          for (const key in result.levels) {
            const level = result.levels[key];
            console.log(`检查层级 ${key}:`, level);
            if (level.folder === levelMap[currentLevel]?.[0] ||
                level.folder.toLowerCase() === levelMap[currentLevel]?.[1]) {
              result.currentLevelCount = level.count;
              console.log('匹配成功，数量:', level.count);
              break;
            }
          }

          this._availableImagesCache = result;
          console.log('缓存结果:', result);
          return result;
        }
      }
    } catch (error) {
      console.error('检查可用图像失败:', error);
    }

    return { hasImages: false, levels: {}, total: 0, currentLevelCount: 0 };
  },

  /**
   * 一键加载预置图像
   */
  async quickLoadImages() {
    const levelConfig = AppState.getCurrentLevelConfig();
    if (!levelConfig) {
      alert('请先选择评价层级');
      return;
    }

    // 静态托管（GitHub Pages 等）或本地模式：走静态 manifest 加载；
    // 服务器模式：走 server API。两者都支持"一键加载"。
    try {
      this.showToast('正在加载图像...', 'info');

      const result = DataManager.useServer
        ? await ImageLoader.loadFromServer(AppState.currentLevel)
        : await ImageLoader.loadFromStatic(AppState.currentLevel);

      if (result.images.length > 0) {
        this.showToast(`已加载 ${result.images.length} 张图像，参考数据 ${result.referenceCount} 条`, 'success');
        // 重新渲染欢迎页，显示模式选择区域
        this.render();
      } else {
        alert('该层级没有找到图像');
      }
    } catch (error) {
      console.error('快速加载失败:', error);
      alert('快速加载失败: ' + error.message);
    }
  },

  /**
   * 显示提示消息
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    // 使用 app-toast 前缀避免与CSS中的 .toast-success 等类冲突
    toast.className = `app-toast app-toast-${type}`;

    const icons = {
      'success': 'check-circle',
      'info': 'info-circle',
      'warning': 'exclamation-triangle',
      'error': 'times-circle'
    };

    const colors = {
      'success': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'info': 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      'warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'error': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    };

    toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 16px 24px;
      background: ${colors[type] || colors['info']};
      color: white;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 9999;
      max-width: 320px;
      word-wrap: break-word;
      white-space: normal;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * 获取层级图标
   */
  getLevelIcon(levelId) {
    const icons = {
      'accessibility': 'route',
      'safety': 'shield-alt',
      'comfort': 'couch',
      'pleasantness': 'smile-beam'
    };
    return icons[levelId] || 'circle';
  },

  /**
   * 渲染单页视图
   */
  renderSingleView() {
    const container = document.getElementById('mainContent');
    if (!container) return;

    // 浏览模式：两栏布局，图片 + 模型输出
    if (AppState.currentMode === 'browse') {
      this.renderBrowseView();
      return;
    }

    // 评价模式：原有布局
    const progress = AppState.getProgress();
    // 确保进度值有效
    const rated = progress.rated || 0;
    const total = progress.total || 0;
    const percentage = progress.percentage || 0;

    container.innerHTML = `
      <div class="controls-bar">
        <div class="controls-left">
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill" style="width: ${percentage}%"></div>
            </div>
            <span class="progress-text" id="progressText">${rated}/${total} (${percentage}%)</span>
          </div>
        </div>
        <div class="controls-center">
          <div class="view-switcher">
            <button class="view-btn ${AppState.currentView === 'single' ? 'active' : ''}"
                    onclick="App.switchView('single')">
              <i class="fas fa-file-image"></i> 单页
            </button>
            <button class="view-btn ${AppState.currentView === 'gallery' ? 'active' : ''}"
                    onclick="App.switchView('gallery')">
              <i class="fas fa-th"></i> 画册
            </button>
          </div>
        </div>
        <div class="controls-right">
          <button class="btn btn-secondary" onclick="App.confirmReload()">
            <i class="fas fa-folder-open"></i> 返回
          </button>
          <button class="btn btn-secondary" onclick="App.uploadReferenceData()" title="上传参考数据（JSON格式）">
            <i class="fas fa-file-code"></i> 参考数据
          </button>
          <button class="btn btn-secondary" onclick="App.showExportOptions()">
            <i class="fas fa-download"></i> 导出
          </button>
          <button class="btn btn-secondary" onclick="App.showImportOptions()">
            <i class="fas fa-upload"></i> 导入
          </button>
          <button class="btn btn-danger" onclick="App.confirmResetRatings()" title="重置当前层级的所有评价">
            <i class="fas fa-trash-alt"></i> 重置评分
          </button>
        </div>
      </div>

      ${AppState.currentView === 'single' ? `
      <div class="single-view rate-mode" data-level="${AppState.currentLevel}">
        <div class="single-view-left" id="rateLeftPane">
          <div class="image-viewer card" id="imageViewer"></div>
          <div id="referencePanel"></div>
        </div>
        <div class="view-divider" id="rateViewDivider">
          <div class="divider-handle"></div>
        </div>
        <div class="single-view-right" id="rateRightPane">
          <div class="rating-panel" id="ratingPanel"></div>
        </div>
      </div>
      ` : `
      <div class="gallery-view" id="galleryContainer"></div>
      `}
    `;

    // 渲染子组件
    if (AppState.currentView === 'single') {
      ImageViewer.render();
      RatingPanel.render();
      // 初始化分割条拖拽（打分模式默认60/40分屏）
      this.initDivider('rateViewDivider', 'rateLeftPane', 'rateRightPane', 60);
    } else {
      GalleryView.render();
    }
    this.updateProgress();
  },

  /**
   * 渲染浏览视图
   */
  renderBrowseView() {
    const container = document.getElementById('mainContent');
    if (!container) return;

    const currentImage = AppState.getCurrentImage();
    // 从当前层级获取参考数据
    const levelRefData = AppState.levelReferenceData[AppState.currentLevel] || {};
    const refData = currentImage ? levelRefData[currentImage.name] : null;

    // 浏览模式控制栏（不包含图片导航，因为图像查看器已有）
    container.innerHTML = `
      <div class="controls-bar">
        <div class="controls-left">
          <div class="view-switcher">
            <button class="view-btn ${AppState.currentView === 'single' ? 'active' : ''}"
                    onclick="App.switchView('single')">
              <i class="fas fa-file-image"></i> 单页
            </button>
            <button class="view-btn ${AppState.currentView === 'gallery' ? 'active' : ''}"
                    onclick="App.switchView('gallery')">
              <i class="fas fa-th"></i> 画册
            </button>
          </div>
        </div>
        <div class="controls-right">
          <button class="btn btn-secondary" onclick="App.confirmReload()">
            <i class="fas fa-folder-open"></i> 返回
          </button>
          <button class="btn btn-secondary" onclick="App.uploadReferenceData()" title="上传参考数据（JSON格式）">
            <i class="fas fa-file-code"></i> 参考数据
          </button>
          <button class="btn btn-primary" onclick="App.startRating()">
            <i class="fas fa-star"></i> 开始评价
          </button>
        </div>
      </div>

      ${AppState.currentView === 'single' ? `
      <div class="single-view browse-mode" data-level="${AppState.currentLevel}">
        <div class="single-view-left" id="browseLeftPane">
          <div class="image-viewer card" id="imageViewer"></div>
        </div>
        <div class="view-divider" id="browseViewDivider">
          <div class="divider-handle"></div>
        </div>
        <div class="single-view-right" id="browseRightPane">
          <div class="model-output-panel" id="modelOutputPanel"></div>
        </div>
      </div>
      ` : `
      <div class="gallery-view browse-gallery" id="galleryContainer"></div>
      `}
    `;

    if (AppState.currentView === 'single') {
      // 单页模式：渲染图像查看器和模型输出
      ImageViewer.render();
      this.renderModelOutput(refData, 'browse');
      // 初始化分割条拖拽（浏览模式默认50/50）
      this.initDivider('browseViewDivider', 'browseLeftPane', 'browseRightPane', 50);
    } else {
      // 画册模式：渲染画册（浏览模式）
      GalleryView.render('browse');
    }
  },

  /**
   * 浏览模式上一张
   */
  browsePrev() {
    if (AppState.currentImageIndex > 0) {
      AppState.currentImageIndex--;
      if (AppState.currentView === 'single') {
        this.renderBrowseView();
      } else {
        GalleryView.selectImage(AppState.currentImageIndex);
      }
    }
  },

  /**
   * 浏览模式下一张
   */
  browseNext() {
    if (AppState.currentImageIndex < AppState.images.length - 1) {
      AppState.currentImageIndex++;
      if (AppState.currentView === 'single') {
        this.renderBrowseView();
      } else {
        GalleryView.selectImage(AppState.currentImageIndex);
      }
    }
  },

  /**
   * 切换视图模式（单页/画册）
   */
  switchView(view) {
    AppState.currentView = view;
    if (AppState.currentMode === 'browse') {
      this.renderBrowseView();
    } else {
      this.renderSingleView();
    }
  },

  /**
   * 初始化分割条拖拽功能
   * @param {string} dividerId - 分割条元素ID
   * @param {string} leftPaneId - 左侧面板ID
   * @param {string} rightPaneId - 右侧面板ID
   * @param {number} defaultLeftPercent - 左侧默认宽度百分比
   */
  initDivider(dividerId, leftPaneId, rightPaneId, defaultLeftPercent = 50) {
    const divider = document.getElementById(dividerId);
    const leftPane = document.getElementById(leftPaneId);
    const rightPane = document.getElementById(rightPaneId);

    if (!divider || !leftPane || !rightPane) {
      console.warn('initDivider: 找不到元素', { dividerId, leftPaneId, rightPaneId });
      return;
    }

    // 设置初始宽度
    leftPane.style.flex = `0 0 ${defaultLeftPercent}%`;
    rightPane.style.flex = `1 1 ${100 - defaultLeftPercent}%`;

    let isDragging = false;

    const handleMouseDown = (e) => {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const container = leftPane.parentElement;
      const rect = container.getBoundingClientRect();
      let newLeftPercent = ((e.clientX - rect.left) / rect.width) * 100;

      // 限制范围 20% - 80%
      newLeftPercent = Math.max(20, Math.min(80, newLeftPercent));

      leftPane.style.flex = `0 0 ${newLeftPercent}%`;
      rightPane.style.flex = `1 1 ${100 - newLeftPercent}%`;
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    divider.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  },

  /**
   * 渲染模型输出面板
   */
  renderModelOutput(refData, mode = 'browse') {
    const container = document.getElementById('modelOutputPanel');
    if (!container) return;

    // 设置层级属性以应用对应颜色
    const currentLevel = AppState.currentLevel || 'accessibility';
    container.setAttribute('data-level', currentLevel);

    // 获取当前层级的参考数据
    const levelRefData = AppState.levelReferenceData[currentLevel] || {};
    const hasAnyReferenceData = Object.keys(levelRefData).length > 0;

    if (!refData) {
      if (hasAnyReferenceData) {
        // 有参考数据但当前图像没有匹配的
        container.innerHTML = `
          <div class="model-output-empty">
            <i class="fas fa-file-alt"></i>
            <p>当前图像暂无参考数据</p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 8px;">可能有其他图像的参考数据</p>
          </div>
        `;
      } else {
        // 完全没有参考数据，提供上传按钮
        container.innerHTML = `
          <div class="model-output-empty">
            <i class="fas fa-file-code"></i>
            <p>暂无参考数据</p>
            <button class="btn btn-primary" style="margin-top: 16px;" onclick="App.uploadReferenceData()">
              <i class="fas fa-upload"></i> 上传参考数据
            </button>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 12px;">支持 JSON 格式的参考数据文件</p>
          </div>
        `;
      }
      return;
    }

    // 打分模式：只显示要素识别结果
    if (mode === 'rate') {
      this.renderElementRecognitionOnly(refData, container);
      return;
    }

    // 浏览模式：显示所有结果
    let html = `
      <div class="model-output-header">
        <h3><i class="fas fa-robot"></i> 模型分析结果</h3>
      </div>
      <div class="model-output-content">
    `;

    // 层级评级
    if (refData.level_rating) {
      html += `
        <div class="output-section">
          <div class="output-section-header">
            <i class="fas fa-star"></i> 层级评级
          </div>
          <div class="output-section-body">
            <span class="rating-badge rating-${refData.level_rating}">${refData.level_rating}</span>
          </div>
        </div>
      `;
    }

    // 问题归因
    if (refData.issue_names && refData.issue_names.length > 0) {
      html += `
        <div class="output-section">
          <div class="output-section-header">
            <i class="fas fa-exclamation-triangle"></i> 问题归因
          </div>
          <div class="output-section-body">
            <div class="issue-tags">
              ${refData.issue_names.map(name => `<span class="issue-tag">${name}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // 要素识别结果（可视化）
    html += this.renderElementRecognition(refData.element_recognition);

    // 完整诊断
    if (refData.diagnosis) {
      html += `
        <div class="output-section">
          <div class="output-section-header">
            <i class="fas fa-file-medical-alt"></i> 完整诊断
          </div>
          <div class="output-section-body">
            <div class="diagnosis-text">${refData.diagnosis}</div>
          </div>
        </div>
      `;
    }

    // 优化策略
    if (refData.optimization) {
      html += `
        <div class="output-section">
          <div class="output-section-header">
            <i class="fas fa-lightbulb"></i> 优化策略
          </div>
          <div class="output-section-body">
            <div class="optimization-text">${refData.optimization}</div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * 渲染要素识别（可视化格式）
   * 数据格式: { "维度": [{ "维度名称": "xxx", "空间要素": [...] }] }
   */
  renderElementRecognition(elementData) {
    if (!elementData) {
      return `
        <div class="output-section">
          <div class="output-section-header">
            <i class="fas fa-eye"></i> 要素识别
          </div>
          <div class="output-section-body">
            <p class="no-data">暂无要素识别数据</p>
          </div>
        </div>
      `;
    }

    let html = `
      <div class="output-section">
        <div class="output-section-header">
          <i class="fas fa-eye"></i> 要素识别
        </div>
        <div class="output-section-body">
    `;

    // 处理 "维度" 数组
    if (elementData.维度 && Array.isArray(elementData.维度)) {
      elementData.维度.forEach((dimItem) => {
        const dimName = dimItem.维度名称 || dimItem.dimension_name || '未知维度';
        html += `
          <div class="element-dimension-header">
            <i class="fas fa-layer-group"></i>
            <span>${dimName}</span>
          </div>
        `;

        // 渲染空间要素表格
        if (dimItem.空间要素 && Array.isArray(dimItem.空间要素)) {
          html += '<div class="element-table-container">';
          html += '<table class="element-table">';
          // 添加colgroup明确指定列宽
          html += '<colgroup><col style="width:25%"><col style="width:15%"><col style="width:60%"></colgroup>';
          html += '<thead><tr><th class="col-name">要素名称</th><th class="col-position">位置</th><th class="col-desc">描述</th></tr></thead>';
          html += '<tbody>';

          dimItem.空间要素.forEach((element, idx) => {
            const name = element.名称 || element.name || '';
            const position = element.位置 || element.position || '无';
            const desc = element.描述 || element.description || '';

            html += `
              <tr class="element-row" data-index="${idx}">
                <td class="element-name-cell">
                  <span class="element-number">${idx + 1}</span>
                  <span class="element-name-text">${name}</span>
                </td>
                <td class="element-position-cell">${position}</td>
                <td class="element-desc-cell">${desc}</td>
              </tr>
            `;
          });

          html += '</tbody></table></div>';
        }
      });
    } else {
      html += '<p class="no-data">数据格式不匹配</p>';
    }

    html += '</div></div>';
    return html;
  },

  /**
   * 渲染要素分类
   */
  renderElementCategory(categoryName, items) {
    if (!items || (Array.isArray(items) && items.length === 0)) {
      return '';
    }

    // 跳过维度名称
    if (categoryName === '维度名称' || categoryName === 'dimension_name') {
      return '';
    }

    let html = `
      <div class="element-category-section">
        <div class="element-category-header-bar">
          <i class="fas fa-folder-open"></i>
          <span>${categoryName}</span>
        </div>
        <div class="element-category-content">
    `;

    if (Array.isArray(items)) {
      items.forEach((item, idx) => {
        if (typeof item === 'string') {
          html += `<div class="element-simple-tag">${item}</div>`;
        } else if (typeof item === 'object' && item !== null) {
          html += this.renderElementItemCard(item, idx);
        }
      });
    } else if (typeof items === 'string') {
      html += `<div class="element-text-content">${items}</div>`;
    }

    html += '</div></div>';
    return html;
  },

  /**
   * 渲染要素条目卡片（表格式）
   */
  renderElementItemCard(item, index) {
    // 尝试多种字段名获取属性（优先中文键名）
    const name = item.名称 || item.要素名称 || item.name || item.type || item.类型 || '';
    const position = item.位置 || item.position || item.location || item.地点 || '';
    const desc = item.描述 || item.description || item.特征 || item.value || item.备注 || '';
    const status = item.状态 || item.status || item.condition || item.条件 || '';

    if (name) {
      return `
        <div class="element-item-card">
          <div class="element-card-header">
            <span class="element-card-index">${index + 1}</span>
            <span class="element-card-name">${name}</span>
            ${status ? `<span class="element-card-status">${status}</span>` : ''}
          </div>
          <div class="element-card-body">
            ${position ? `
              <div class="element-card-row">
                <span class="element-card-label"><i class="fas fa-map-marker-alt"></i> 位置</span>
                <span class="element-card-value">${position}</span>
              </div>
            ` : ''}
            ${desc ? `
              <div class="element-card-row">
                <span class="element-card-label"><i class="fas fa-align-left"></i> 描述</span>
                <span class="element-card-value">${desc}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // 如果没有名称，显示所有字段
    const entries = Object.entries(item).filter(([k, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length > 0) {
      let html = '<div class="element-item-card element-card-auto">';
      html += '<div class="element-card-body">';
      entries.forEach(([key, value]) => {
        let displayValue = '';
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            displayValue = value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
          } else {
            displayValue = JSON.stringify(value);
          }
        } else {
          displayValue = String(value);
        }
        html += `
          <div class="element-card-row">
            <span class="element-card-label">${key}</span>
            <span class="element-card-value">${displayValue}</span>
          </div>
        `;
      });
      html += '</div></div>';
      return html;
    }

    return '';
  },

  /**
   * 打分模式：只显示要素识别结果
   */
  renderElementRecognitionOnly(refData, container) {
    let html = `
      <div class="model-output-header">
        <h3><i class="fas fa-eye"></i> 要素识别结果</h3>
      </div>
      <div class="model-output-content rate-mode">
    `;

    html += this.renderElementRecognition(refData.element_recognition);

    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * 开始评价（切换到评价模式）
   */
  startRating() {
    AppState.showWelcome = false;
    AppState.currentMode = 'rate';
    this.render();
  },

  /**
   * 渲染画册视图
   */
  renderGalleryView() {
    const container = document.getElementById('mainContent');
    if (!container) return;

    const progress = AppState.getProgress();
    // 确保进度值有效
    const rated = progress.rated || 0;
    const total = progress.total || 0;
    const percentage = progress.percentage || 0;
    console.log('画册视图进度:', progress, '图像数:', AppState.images.length, '当前层级:', AppState.currentLevel);

    container.innerHTML = `
      <div class="controls-bar">
        <div class="controls-left">
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill" style="width: ${percentage}%"></div>
            </div>
            <span class="progress-text" id="progressText">${rated}/${total} (${percentage}%)</span>
          </div>
        </div>
        <div class="controls-right">
          <div class="view-switcher">
            <button class="view-btn ${AppState.currentView === 'single' ? 'active' : ''}"
                    onclick="App.switchView('single')">
              <i class="fas fa-file-image"></i> 单页
            </button>
            <button class="view-btn ${AppState.currentView === 'gallery' ? 'active' : ''}"
                    onclick="App.switchView('gallery')">
              <i class="fas fa-th"></i> 画册
            </button>
          </div>
          <button class="btn btn-secondary" onclick="App.confirmReload()">
            <i class="fas fa-folder-open"></i> 返回
          </button>
          <button class="btn btn-secondary" onclick="App.uploadReferenceData()" title="上传参考数据（JSON格式）">
            <i class="fas fa-file-code"></i> 参考数据
          </button>
          <button class="btn btn-secondary" onclick="App.showExportOptions()">
            <i class="fas fa-download"></i> 导出
          </button>
          <button class="btn btn-secondary" onclick="App.showImportOptions()">
            <i class="fas fa-upload"></i> 导入
          </button>
          <button class="btn btn-danger" onclick="App.confirmResetRatings()" title="重置当前层级的所有评价">
            <i class="fas fa-trash-alt"></i> 重置评分
          </button>
        </div>
      </div>

      <div class="gallery-view" id="galleryContainer"></div>
    `;

    GalleryView.render();
  },

  /**
   * 渲染编辑模式
   */
  renderEditorMode() {
    const container = document.getElementById('mainContent');
    if (!container) return;

    container.innerHTML = `
      <div class="editor-view">
        <div id="editorContainer"></div>
      </div>
    `;

    QuestionnaireEditor.render();
  },

  /**
   * 加载图像到当前层级
   */
  async loadImages() {
    // 确保已选择层级
    if (!AppState.currentLevel) {
      alert('请先选择评价层级');
      return;
    }

    try {
      const result = await ImageLoader.selectFolder();
      if (result.images.length > 0) {
        const levelConfig = AppState.getCurrentLevelConfig();
        this.showToast(`已加载 ${result.images.length} 张图像到「${levelConfig?.name || AppState.currentLevel}」层级`, 'success');
        // 重新渲染欢迎页，显示模式选择区域
        this.render();
      }
    } catch (error) {
      console.error('加载图像失败:', error);
      alert('加载图像失败: ' + error.message);
    }
  },

  /**
   * 显示模式选择对话框（加载图像后）
   */
  showModeSelectionDialog() {
    // 移除已有对话框
    const existingModal = document.getElementById('modeSelectionModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'modeSelectionModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;';

    modal.innerHTML = `
      <div style="background:white;border-radius:16px;max-width:480px;width:90%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="background:linear-gradient(135deg, #6366f1, #8b5cf6);color:white;padding:24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">
            <i class="fas fa-clipboard-check"></i>
          </div>
          <h3 style="margin:0;font-size:20px;">选择评价模式</h3>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 20px;color:#64748b;text-align:center;line-height:1.6;">
            图像已加载成功，请选择您要进行的评价模式：
          </p>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <button id="blindRatingBtn" style="display:flex;align-items:center;gap:16px;padding:16px;border:2px solid #e2e8f0;border-radius:12px;background:white;cursor:pointer;transition:all 0.2s;text-align:left;">
              <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg, #10b981, #059669);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-eye-slash" style="color:white;font-size:20px;"></i>
              </div>
              <div>
                <div style="font-weight:600;color:#1e293b;font-size:15px;">盲评模式（推荐）</div>
                <div style="color:#64748b;font-size:13px;margin-top:4px;">直接进入打分，无法查看模型输出，避免评价偏差</div>
              </div>
            </button>
            <button id="browseModeBtn" style="display:flex;align-items:center;gap:16px;padding:16px;border:2px solid #e2e8f0;border-radius:12px;background:white;cursor:pointer;transition:all 0.2s;text-align:left;">
              <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg, #3b82f6, #1d4ed8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-eye" style="color:white;font-size:20px;"></i>
              </div>
              <div>
                <div style="font-weight:600;color:#1e293b;font-size:15px;">浏览模式</div>
                <div style="color:#64748b;font-size:13px;margin-top:4px;">先浏览图像和模型输出，再手动进入打分模式</div>
              </div>
            </button>
          </div>
        </div>
        <div style="padding:0 24px 24px;">
          <button id="cancelModeBtn" style="width:100%;padding:12px;border:none;background:#f1f5f9;color:#64748b;border-radius:8px;cursor:pointer;font-size:14px;">
            取消
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 绑定事件
    document.getElementById('blindRatingBtn').addEventListener('click', () => this.startBlindRating());
    document.getElementById('browseModeBtn').addEventListener('click', () => this.startBrowseMode());
    document.getElementById('cancelModeBtn').addEventListener('click', () => this.closeModeSelectionDialog());

    // 点击背景不关闭（强制选择）
  },

  /**
   * 关闭模式选择对话框
   */
  closeModeSelectionDialog() {
    const modal = document.getElementById('modeSelectionModal');
    if (modal) modal.remove();
    // 取消时返回欢迎页
    AppState.showWelcome = true;
    this.render();
  },

  /**
   * 开始盲评模式
   */
  startBlindRating() {
    this.closeModeSelectionDialog();
    AppState.showWelcome = false;
    AppState.blindRatingMode = true;
    AppState.currentMode = 'rate';
    AppState.currentView = 'single';
    this.render();
    this.showToast('已进入盲评模式，返回欢迎页后才能切换模式', 'success');
  },

  /**
   * 开始浏览模式
   */
  startBrowseMode() {
    this.closeModeSelectionDialog();
    AppState.showWelcome = false;
    AppState.blindRatingMode = false;
    AppState.currentMode = 'browse';
    AppState.currentView = 'single';
    this.render();
  },

  /**
   * 返回欢迎界面（不清空数据）
   */
  goBackToWelcome() {
    AppState.currentImageIndex = 0;
    AppState.galleryPage = 1;
    AppState.currentMode = 'browse';
    AppState.currentView = 'single';
    AppState.showWelcome = true;
    AppState.blindRatingMode = false; // 返回欢迎页时解除盲评模式

    // 重新渲染（返回欢迎页）
    this.render();
  },

  /**
   * 返回数据界面（从欢迎页返回）
   */
  goBackToData() {
    // 保持当前数据，直接渲染
    this.render();
  },

  /**
   * 进入浏览模式
   */
  goToBrowseMode() {
    AppState.showWelcome = false;
    AppState.currentMode = 'browse';
    AppState.currentView = 'single';
    AppState.currentImageIndex = 0;
    this.render();
  },

  /**
   * 进入打分模式
   */
  goToRateMode() {
    AppState.showWelcome = false;
    AppState.currentMode = 'rate';
    AppState.currentView = 'single';
    AppState.currentImageIndex = 0;
    this.render();
  },

  /**
   * 清空当前层级数据
   */
  clearCurrentLevelData() {
    const level = AppState.currentLevel;
    if (level) {
      AppState.levelImages[level] = [];
      AppState.levelReferenceData[level] = {};
    }
    AppState.currentImageIndex = 0;
    AppState.galleryPage = 1;
    this.render();
    this.showToast('已清空当前层级数据', 'success');
  },

  /**
   * 显示知识图谱
   */
  async showKnowledgeGraph() {
    // 检查是否为服务器模式
    if (!DataManager.useServer) {
      alert('查看知识图谱需要启动服务器模式。\n\n请通过"启动工具.bat"启动服务器。');
      return;
    }

    // 显示加载中
    this.showKnowledgeGraphModal('<div class="standards-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>');

    try {
      const result = await DataManager.getKnowledgeGraph();
      if (result.success && result.content) {
        const htmlContent = this.parseKnowledgeGraphMarkdown(result.content);
        this.showKnowledgeGraphModal(htmlContent);
      } else {
        this.showKnowledgeGraphModal('<div class="standards-error"><i class="fas fa-exclamation-circle"></i> 加载失败：' + (result.message || '未知错误') + '</div>');
      }
    } catch (error) {
      console.error('加载知识图谱失败:', error);
      this.showKnowledgeGraphModal('<div class="standards-error"><i class="fas fa-exclamation-circle"></i> 加载失败</div>');
    }
  },

  /**
   * 显示知识图谱模态框
   */
  showKnowledgeGraphModal(content) {
    // 移除已存在的模态框
    const existingModal = document.getElementById('knowledgeGraphModal');
    if (existingModal) {
      existingModal.remove();
    }

    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'knowledgeGraphModal';
    modal.className = 'knowledge-graph-modal';
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.hideKnowledgeGraph();
      }
    };
    modal.innerHTML = `
      <div class="knowledge-graph-container">
        <div class="knowledge-graph-header">
          <h3><i class="fas fa-project-diagram"></i> 可步行性评价知识图谱</h3>
          <button class="knowledge-graph-close-btn" onclick="App.hideKnowledgeGraph()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="knowledge-graph-content">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 动画显示
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
  },

  /**
   * 隐藏知识图谱模态框
   */
  hideKnowledgeGraph() {
    const modal = document.getElementById('knowledgeGraphModal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  },

  /**
   * 解析知识图谱 Markdown
   */
  parseKnowledgeGraphMarkdown(markdown) {
    if (!markdown) return '';

    // 转义 HTML 特殊字符
    let html = markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // === 第一步：按行分割，逐块处理表格 ===
    const lines = html.split('\n');
    let result = [];
    let tableLines = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检测表格行：以 | 开头和结尾
      if (line.startsWith('|') && line.endsWith('|')) {
        tableLines.push(lines[i]);
        inTable = true;
      } else {
        // 非表格行，如果之前在处理表格，则先输出表格
        if (inTable && tableLines.length >= 3) {
          // 至少需要：表头行 + 分隔行 + 数据行
          result.push(this.renderKnowledgeTable(tableLines));
          tableLines = [];
          inTable = false;
        }
        result.push(lines[i]);
      }
    }

    // 处理文件末尾的表格
    if (inTable && tableLines.length >= 3) {
      result.push(this.renderKnowledgeTable(tableLines));
    }

    html = result.join('\n');

    // === 第二步：处理分隔线 ===
    html = html.replace(/^(---|\*\*\*|___)$/gm, '<hr class="standards-divider">');

    // === 第三步：处理标题 ===
    // 一级标题 (# 街道可步行性评价知识图谱)
    html = html.replace(/^# (.+)$/gm, '<h1 class="kg-main-title">$1</h1>');

    // 层级标题 (## 一、通达性 等)
    html = html.replace(/^## (一|二|三|四|五)、(.+)$/gm, (match, num, title) => {
      const levelId = {
        '一': 'accessibility',
        '二': 'safety',
        '三': 'comfort',
        '四': 'pleasantness',
        '五': 'block'
      }[num];
      return `<div class="kg-level-header" data-level="${levelId || ''}"><i class="fas fa-layer-group"></i> ${num}、${title}</div>`;
    });

    // 维度标题 (### 自然监视不足 (SR1) 等)
    html = html.replace(/^### (.+)$/gm, '<div class="kg-dimension-header"><i class="fas fa-cube"></i> $1</div>');

    // 四级标题 (#### 空间要素)
    html = html.replace(/^#### (.+)$/gm, '<h4 class="kg-section-title"><i class="fas fa-list-ul"></i> $1</h4>');

    // === 第四步：处理层级定义和维度含义 ===
    html = html.replace(/^\*\*层级定义\*\*：/g, '<div class="kg-dimension-meaning"><strong>层级定义：</strong>');
    html = html.replace(/^\*\*维度含义\*\*：/g, '<div class="kg-dimension-meaning"><strong>维度含义：</strong>');

    // 闭合定义 div（匹配到下一个块级元素）
    html = html.replace(/(<div class="kg-dimension-meaning">.+?)(\n\n|\n(?:<hr|<h|<div class="kg|<table))/gs, '$1</div>\n$2');

    // === 第五步：处理行内格式 ===
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // === 第六步：清理 ===
    html = html.replace(/<p class="standards-paragraph">\s*<\/p>/g, '');

    return '<div class="standards-content">' + html + '</div>';
  },

  /**
   * 渲染知识图谱表格
   */
  renderKnowledgeTable(tableLines) {
    if (tableLines.length < 2) return tableLines.join('\n');

    // 解析表头（第一行）
    const headerLine = tableLines[0];
    const headers = headerLine.split('|').slice(1, -1).map(h => h.trim());

    // 跳过分隔行（第二行）

    // 解析数据行（第三行开始）
    const bodyLines = tableLines.slice(2);
    const rows = bodyLines.map(line => {
      return line.split('|').slice(1, -1).map(cell => cell.trim());
    }).filter(row => row.length > 0);

    // 构建 HTML 表格
    let tableHtml = '<table class="kg-elements-table">\n<thead>\n<tr>\n';
    headers.forEach(h => {
      tableHtml += `<th>${h}</th>\n`;
    });
    tableHtml += '</tr>\n</thead>\n<tbody>\n';

    rows.forEach(row => {
      tableHtml += '<tr>\n';
      row.forEach((cell, idx) => {
        // 为要素编号列添加特殊样式
        if (idx === 0 && /^[A-Z]+[0-9]+$/.test(cell)) {
          tableHtml += `<td><span class="kg-element-code">${cell}</span></td>\n`;
        } else {
          tableHtml += `<td>${cell}</td>\n`;
        }
      });
      tableHtml += '</tr>\n';
    });

    tableHtml += '</tbody>\n</table>\n';
    return tableHtml;
  },

  /**
   * 确认重新加载 - 保留旧名兼容
   */
  confirmReload() {
    this.goBackToWelcome();
  },

  /**
   * 上传参考数据到当前层级
   */
  async uploadReferenceData() {
    if (!AppState.currentLevel) {
      alert('请先选择评价层级');
      return;
    }

    try {
      const result = await ImageLoader.selectReferenceFiles(AppState.currentLevel);
      console.log(`已加载 ${result.loadedCount} 个参考数据文件`);

      // 获取当前图像的参考数据
      const currentImage = AppState.getCurrentImage();
      const levelRefData = AppState.levelReferenceData[AppState.currentLevel] || {};
      const refData = currentImage ? levelRefData[currentImage.name] : null;

      console.log('=== 调试信息 ===');
      console.log('当前图像:', currentImage?.name);
      console.log('当前层级:', AppState.currentLevel);
      console.log('查找的键:', currentImage?.name);
      console.log('存储的所有键:', Object.keys(levelRefData));
      console.log('参考数据:', refData ? '找到' : '未找到');
      console.log('当前层级参考数据总数:', Object.keys(levelRefData).length);

      this.showToast(`已加载 ${result.loadedCount} 个参考数据文件`, 'success');

      // 重新渲染当前视图
      if (AppState.currentMode === 'browse') {
        // 浏览模式：重新渲染模型输出面板
        this.renderModelOutput(refData, 'browse');
      } else if (AppState.currentMode === 'rate') {
        // 打分模式：重新渲染单页视图
        this.renderSingleView();
      }
    } catch (error) {
      console.error('上传参考数据失败:', error);
      alert('上传参考数据失败: ' + error.message);
    }
  },

  /**
   * 更新进度
   */
  updateProgress() {
    const progress = AppState.getProgress();
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');

    // 确保进度值有效
    const rated = progress.rated || 0;
    const total = progress.total || 0;
    const percentage = progress.percentage || 0;

    if (fill) {
      fill.style.width = `${percentage}%`;
    }
    if (text) {
      text.textContent = `${rated}/${total} (${percentage}%)`;
    }
  },

  /**
   * 显示导出选项
   */
  showExportOptions() {
    if (!AppState.currentLevel) {
      alert('请先选择评价层级');
      return;
    }

    // 创建导出对话框
    const modal = document.createElement('div');
    modal.className = 'export-modal-overlay';
    modal.innerHTML = `
      <div class="export-modal">
        <div class="export-modal-header">
          <h3><i class="fas fa-download"></i> 导出评价数据</h3>
          <button class="modal-close-btn" onclick="this.closest('.export-modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="export-modal-body">
          <div class="export-option-group">
            <label class="export-option-label">选择导出格式：</label>
            <div class="export-options">
              <label class="export-option">
                <input type="radio" name="exportFormat" value="excel" checked>
                <span class="export-option-content">
                  <i class="fas fa-file-excel"></i>
                  <span class="export-option-title">Excel 格式</span>
                  <span class="export-option-desc">.xlsx 文件，便于后续数据分析</span>
                </span>
              </label>
              <label class="export-option">
                <input type="radio" name="exportFormat" value="json">
                <span class="export-option-content">
                  <i class="fas fa-file-code"></i>
                  <span class="export-option-title">JSON 格式</span>
                  <span class="export-option-desc">.json 文件，保留完整数据结构</span>
                </span>
              </label>
            </div>
          </div>
        </div>
        <div class="export-modal-footer">
          <button class="btn btn-outline" onclick="this.closest('.export-modal-overlay').remove()">取消</button>
          <button class="btn btn-primary" onclick="App.executeExport()">
            <i class="fas fa-download"></i> 导出
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  /**
   * 执行导出
   */
  executeExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'excel';
    const modal = document.querySelector('.export-modal-overlay');
    if (modal) modal.remove();

    if (format === 'excel') {
      DataManager.exportToExcel(AppState.currentLevel);
    } else {
      DataManager.exportToJSON(AppState.currentLevel);
    }
  },

  /**
   * 显示导入选项
   */
  showImportOptions() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.xlsx,.xls';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          if (file.name.endsWith('.json')) {
            await DataManager.importFromJSON(file);
          } else {
            await DataManager.importFromExcel(file);
          }
          this.render();
          alert('导入成功');
        } catch (error) {
          alert('导入失败: ' + error.message);
        }
      }
    };
    input.click();
  },

  /**
   * 确认重置评分
   */
  confirmResetRatings() {
    if (!AppState.currentLevel) {
      alert('请先选择评价层级');
      return;
    }

    const levelConfig = AppState.getCurrentLevelConfig();
    const levelName = levelConfig?.name || AppState.currentLevel;

    // 统计当前层级的评价数量
    const ratings = AppState.ratings[AppState.currentLevel] || {};
    const ratedCount = Object.keys(ratings).length;

    if (ratedCount === 0) {
      alert(`当前层级「${levelName}」暂无评价数据`);
      return;
    }

    // 创建确认对话框
    const modal = document.createElement('div');
    modal.className = 'export-modal-overlay';
    modal.innerHTML = `
      <div class="export-modal" style="max-width: 380px;">
        <div class="export-modal-header" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
          <h3><i class="fas fa-exclamation-triangle"></i> 重置评分确认</h3>
          <button class="modal-close-btn" onclick="this.closest('.export-modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="export-modal-body" style="text-align: center; padding: 30px 24px;">
          <div style="font-size: 48px; color: #ef4444; margin-bottom: 16px;">
            <i class="fas fa-trash-alt"></i>
          </div>
          <p style="font-size: 16px; color: #374151; margin-bottom: 8px;">
            确定要重置「<strong>${levelName}</strong>」的所有评分吗？
          </p>
          <p style="font-size: 14px; color: #6b7280;">
            将删除 <strong>${ratedCount}</strong> 条评价记录
          </p>
          <p style="font-size: 13px; color: #ef4444; margin-top: 16px;">
            <i class="fas fa-exclamation-circle"></i> 此操作不可恢复！
          </p>
        </div>
        <div class="export-modal-footer">
          <button class="btn btn-outline" onclick="this.closest('.export-modal-overlay').remove()">取消</button>
          <button class="btn btn-danger" onclick="App.executeResetRatings()">
            <i class="fas fa-trash-alt"></i> 确认重置
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  /**
   * 执行重置评分
   */
  executeResetRatings() {
    const modal = document.querySelector('.export-modal-overlay');
    if (modal) modal.remove();

    DataManager.resetRatings(AppState.currentLevel);

    // 刷新界面
    RatingPanel.render();
    this.updateProgress();

    // 如果在画册视图，刷新画册
    if (AppState.currentView === 'gallery') {
      GalleryView.refresh();
    }

    // 显示成功提示
    const toast = document.createElement('div');
    toast.className = 'toast-success';
    toast.innerHTML = '<i class="fas fa-check-circle"></i> 评分已重置';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:12px 24px;border-radius:8px;font-size:14px;z-index:10002;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  },

  /**
   * 重置评价
   */
  resetRatings() {
    this.confirmResetRatings();
  },

  /**
   * 绑定全局事件
   */
  bindGlobalEvents() {
    // 键盘导航
    document.addEventListener('keydown', (e) => {
      if (AppState.currentMode === 'edit') return;

      // 浏览模式键盘导航
      if (AppState.currentMode === 'browse' && AppState.images.length > 0) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.browsePrev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.browseNext();
        }
        return;
      }

      // 评价模式键盘导航
      if (AppState.currentView === 'single') {
        ImageViewer.handleKeydown(e);
      }
    });

    // 拖放上传 - 支持文件夹和文件
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      document.body.classList.add('drag-active');

      // 高亮上传区域
      const uploadZone = document.querySelector('.upload-zone-v2');
      if (uploadZone) {
        uploadZone.classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;

      if (dragCounter === 0) {
        document.body.classList.remove('drag-active');

        const uploadZone = document.querySelector('.upload-zone-v2');
        if (uploadZone) {
          uploadZone.classList.remove('drag-over');
        }
      }
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      document.body.classList.remove('drag-active');

      const uploadZone = document.querySelector('.upload-zone-v2');
      if (uploadZone) {
        uploadZone.classList.remove('drag-over');
      }

      try {
        const items = Array.from(e.dataTransfer.items);
        const allFiles = [];
        let detectedLevel = null;
        let rootFolderName = null;

        // 处理拖放的项目（可能是文件或文件夹）
        for (const item of items) {
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;

            if (entry) {
              if (entry.isDirectory) {
                // 获取根文件夹名称
                rootFolderName = entry.name;

                // 检测层级
                detectedLevel = ImageLoader.detectLevelFromFolder(entry.name);
                console.log('拖放文件夹:', entry.name, '检测层级:', detectedLevel);

                // 只读取该文件夹内的图像（不递归子文件夹）
                const files = await this.readDirectoryFlat(entry);
                allFiles.push(...files);
              } else if (entry.isFile) {
                // 如果是文件
                const file = await this.readFileEntry(entry);
                if (file) allFiles.push(file);
              }
            } else {
              // 回退：直接获取文件
              const file = item.getAsFile();
              if (file) allFiles.push(file);
            }
          }
        }

        // 过滤：只保留图像文件
        const imageFiles = allFiles.filter(file =>
          /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
        );

        if (imageFiles.length > 0) {
          this.showToast(`正在加载 ${imageFiles.length} 张图像...`, 'info');

          // 设置检测到的层级
          if (detectedLevel) {
            AppState.currentLevel = detectedLevel;
          }

          await ImageLoader.processFiles(imageFiles);
          this.render();

          const levelName = AppState.getCurrentLevelConfig()?.name || AppState.currentLevel;
          this.showToast(`已加载 ${levelName} 层级的 ${AppState.images.length} 张图像`, 'success');
        } else {
          this.showToast('没有找到有效的图像文件', 'warning');
        }
      } catch (error) {
        console.error('拖放处理失败:', error);
        this.showToast('拖放处理失败: ' + error.message, 'error');
      }
    });
  },

  /**
   * 仅读取目录中的直接文件（不递归子目录）
   */
  readDirectoryFlat(directoryEntry) {
    return new Promise((resolve) => {
      const files = [];
      const directoryReader = directoryEntry.createReader();

      directoryReader.readEntries((entries) => {
        const filePromises = [];

        entries.forEach((entry) => {
          // 只处理文件，跳过子目录
          if (entry.isFile) {
            filePromises.push(
              this.readFileEntry(entry).then(file => {
                if (file) files.push(file);
                return file;
              })
            );
          }
        });

        Promise.all(filePromises).then(() => resolve(files));
      }, (error) => {
        console.error('读取目录失败:', error);
        resolve(files);
      });
    });
  },

  /**
   * 递归读取目录中的所有文件
   */
  readDirectory(directoryEntry) {
    return new Promise((resolve) => {
      const files = [];
      const directoryReader = directoryEntry.createReader();

      const readAllEntries = () => {
        directoryReader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(files);
            return;
          }

          for (const entry of entries) {
            if (entry.isDirectory) {
              // 递归处理子目录
              const subFiles = await this.readDirectory(entry);
              files.push(...subFiles);
            } else if (entry.isFile) {
              const file = await this.readFileEntry(entry);
              if (file) files.push(file);
            }
          }

          // 继续读取更多条目（某些浏览器每次最多返回100条）
          readAllEntries();
        }, (error) => {
          console.error('读取目录失败:', error);
          resolve(files);
        });
      };

      readAllEntries();
    });
  },

  /**
   * 读取文件条目
   */
  readFileEntry(fileEntry) {
    return new Promise((resolve) => {
      fileEntry.file((file) => {
        // 添加相对路径信息
        file.webkitRelativePath = fileEntry.fullPath.substring(1); // 移除开头的 /
        resolve(file);
      }, (error) => {
        console.error('读取文件失败:', error);
        resolve(null);
      });
    });
  }
};

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// 导出
window.App = App;
