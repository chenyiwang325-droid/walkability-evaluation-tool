/**
 * 可步行性专家评价工具 - 画册视图模块
 */

const GalleryView = {
  // 当前模式：'browse' 或 'rate'
  currentMode: 'rate',

  /**
   * 渲染画册视图
   * @param {string} mode - 'browse' 浏览模式 | 'rate' 打分模式
   */
  render(mode = 'rate') {
    this.currentMode = mode;
    const container = document.getElementById('galleryContainer');
    if (!container) return;

    if (AppState.images.length === 0) {
      container.innerHTML = `
        <div class="gallery-empty">
          <i class="fas fa-images"></i>
          <p>暂无图像，请先加载图像文件夹</p>
        </div>
      `;
      return;
    }

    // 构建HTML
    let html = '';

    // 图像网格
    html += '<div class="gallery-grid">';
    const pageImages = AppState.getGalleryImages();
    pageImages.forEach((image, index) => {
      const globalIndex = (AppState.galleryPage - 1) * AppState.itemsPerPage + index;
      html += this.renderImageCard(image, globalIndex, mode);
    });
    html += '</div>';

    // 分页
    html += this.renderPagination();

    container.innerHTML = html;
  },

  /**
   * 渲染控制栏
   */
  renderControls() {
    return `
      <div class="gallery-controls">
        <div class="controls-left">
          <div class="select-wrapper">
            <select id="filterSelect" onchange="GalleryView.filterImages(this.value)">
              <option value="all">全部图像</option>
              <option value="rated">已评价</option>
              <option value="unrated">未评价</option>
            </select>
          </div>
        </div>
        <div class="controls-right">
          <div class="select-wrapper">
            <select id="itemsPerPageSelect" onchange="GalleryView.changeItemsPerPage(this.value)">
              <option value="24" ${AppState.itemsPerPage === 24 ? 'selected' : ''}>24 张/页</option>
              <option value="36" ${AppState.itemsPerPage === 36 ? 'selected' : ''}>36 张/页</option>
              <option value="48" ${AppState.itemsPerPage === 48 ? 'selected' : ''}>48 张/页</option>
              <option value="60" ${AppState.itemsPerPage === 60 ? 'selected' : ''}>60 张/页</option>
            </select>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 渲染图像卡片
   * @param {Object} image - 图像对象
   * @param {number} index - 图像索引
   * @param {string} mode - 'browse' 或 'rate'
   */
  renderImageCard(image, index, mode = 'rate') {
    const isRated = AppState.isImageRated(image.name);
    const rating = AppState.ratings[AppState.currentLevel]?.[image.name];
    const ratingScale = AppState.config?.ratingScale || {};
    const levelRating = rating?.answers?.level_rating;
    const ratingLabel = levelRating ? ratingScale[levelRating] : null;

    // 获取参考数据
    const levelRefData = AppState.levelReferenceData[AppState.currentLevel] || {};
    const refData = levelRefData[image.name];

    // 根据模式显示不同的底部信息
    let cardInfo = '';
    if (mode === 'browse') {
      // 浏览模式：显示参考数据摘要
      if (refData) {
        let summary = '';
        // 提取要素名称列表
        if (refData.维度 && Array.isArray(refData.维度)) {
          const elements = [];
          refData.维度.forEach(dim => {
            if (dim.空间要素 && Array.isArray(dim.空间要素)) {
              dim.空间要素.forEach(elem => {
                if (elem.名称) elements.push(elem.名称);
              });
            }
          });
          if (elements.length > 0) {
            const displayElements = elements.slice(0, 3);
            summary = displayElements.join(', ') + (elements.length > 3 ? ` 等${elements.length}项` : '');
          }
        }
        cardInfo = summary ? `<span class="card-ref-summary" title="${summary}">${summary}</span>` : '<span class="card-ref-badge">有参考数据</span>';
      } else {
        cardInfo = '<span class="card-no-ref">无参考数据</span>';
      }
    } else {
      // 打分模式：显示评价状态和结果
      cardInfo = `
        <span class="image-card-status ${isRated ? 'rated' : 'unrated'}">
          ${isRated ? '<i class="fas fa-check"></i> 已评价' : '<i class="fas fa-circle"></i> 未评价'}
        </span>
        ${ratingLabel ? `<span class="image-card-rating">${ratingLabel}</span>` : ''}
      `;
    }

    const imageNumber = index + 1;
    return `
      <div class="image-card ${isRated ? 'rated' : ''}"
           onclick="GalleryView.selectImage(${index})">
        <img src="${image.url}" alt="${image.name}" loading="lazy">
        <div class="image-card-overlay">
          ${cardInfo}
        </div>
        <div class="image-card-name" title="${image.name}">
          <span class="image-number">#${imageNumber}</span>
          ${image.name}
        </div>
      </div>
    `;
  },

  /**
   * 渲染分页
   */
  renderPagination() {
    const totalPages = AppState.getTotalPages();
    const currentPage = AppState.galleryPage;

    return `
      <div class="pagination">
        <button class="pagination-btn" onclick="GalleryView.prevPage()" ${currentPage <= 1 ? 'disabled' : ''}>
          <i class="fas fa-chevron-left"></i> 上一页
        </button>
        <span class="pagination-info">
          第 ${currentPage} / ${totalPages} 页
        </span>
        <button class="pagination-btn" onclick="GalleryView.nextPage()" ${currentPage >= totalPages ? 'disabled' : ''}>
          下一页 <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    `;
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
   * 选择图像
   */
  selectImage(index) {
    AppState.currentImageIndex = index;
    AppState.currentView = 'single';
    if (typeof App !== 'undefined') {
      // 根据当前模式渲染不同的视图
      if (AppState.currentMode === 'browse') {
        App.renderBrowseView();
      } else {
        App.render();
      }
    }
  },

  /**
   * 上一页
   */
  prevPage() {
    if (AppState.galleryPage > 1) {
      AppState.galleryPage--;
      this.render(this.currentMode === 'browse' ? 'browse' : 'rate');
    }
  },

  /**
   * 下一页
   */
  nextPage() {
    const totalPages = AppState.getTotalPages();
    if (AppState.galleryPage < totalPages) {
      AppState.galleryPage++;
      this.render(this.currentMode === 'browse' ? 'browse' : 'rate');
    }
  },

  /**
   * 更改每页显示数量
   */
  changeItemsPerPage(value) {
    AppState.itemsPerPage = parseInt(value);
    AppState.galleryPage = 1;
    this.render(this.currentMode === 'browse' ? 'browse' : 'rate');
  },

  /**
   * 筛选图像
   */
  filterImages(filter) {
    // 简单实现：只更新显示，实际筛选逻辑可扩展
    console.log('Filter:', filter);
    this.render(this.currentMode === 'browse' ? 'browse' : 'rate');
  },

  /**
   * 刷新
   */
  refresh() {
    this.render(this.currentMode === 'browse' ? 'browse' : 'rate');
  }
};

// 导出
window.GalleryView = GalleryView;
