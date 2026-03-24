/**
 * 可步行性专家评价工具 - 图像展示模块
 */

const ImageViewer = {
  /**
   * 渲染图像展示区
   */
  render() {
    const container = document.getElementById('imageViewer');
    if (!container) return;

    const currentImage = AppState.getCurrentImage();

    if (!currentImage) {
      container.innerHTML = `
        <div class="image-viewer-empty">
          <i class="fas fa-image"></i>
          <p>暂无图像</p>
        </div>
      `;
      return;
    }

    let html = '';

    // 头部
    const imageNumber = AppState.currentImageIndex + 1;
    html += `
      <div class="image-viewer-header">
        <div class="image-viewer-title">
          <i class="fas fa-image"></i>
          <span class="image-number">#${imageNumber}</span>
          <span id="currentImageName">${currentImage.name}</span>
        </div>
        <div class="image-viewer-zoom">
          <button class="zoom-btn" onclick="ImageViewer.zoomOut()" title="缩小">
            <i class="fas fa-minus"></i>
          </button>
          <span class="zoom-level" id="zoomLevel">${AppState.zoomLevel}%</span>
          <button class="zoom-btn" onclick="ImageViewer.zoomIn()" title="放大">
            <i class="fas fa-plus"></i>
          </button>
          <button class="zoom-btn" onclick="ImageViewer.resetZoom()" title="适应窗口">
            <i class="fas fa-expand"></i>
          </button>
        </div>
      </div>
    `;

    // 图像容器
    html += `
      <div class="image-container" id="imageContainer" onwheel="ImageViewer.handleWheel(event)">
        <img id="mainImage" src="${currentImage.url}" alt="${currentImage.name}"
             style="transform: scale(${AppState.zoomLevel / 100})">
      </div>
    `;

    // 导航栏
    html += `
      <div class="image-nav">
        <div class="image-nav-info">
          <i class="fas fa-info-circle"></i>
          <span class="image-number">#${imageNumber}</span>
          <span>${currentImage.name}</span>
        </div>
        <div class="image-nav-controls">
          <button class="nav-btn" id="prevImageBtn" onclick="ImageViewer.prevImage()"
                  ${AppState.currentImageIndex <= 0 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
          </button>
          <span class="image-counter">
            <span id="currentIndex">${AppState.currentImageIndex + 1}</span>
            <span id="totalImages">${AppState.images.length}</span>
          </span>
          <button class="nav-btn" id="nextImageBtn" onclick="ImageViewer.nextImage()"
                  ${AppState.currentImageIndex >= AppState.images.length - 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.renderReferencePanel();
  },

  /**
   * 渲染参考数据面板
   */
  renderReferencePanel() {
    const container = document.getElementById('referencePanel');
    if (!container) return;

    const currentImage = AppState.getCurrentImage();
    const refData = currentImage ? AppState.referenceData[currentImage.name] : null;
    const currentLevel = AppState.currentLevel || 'accessibility';

    let html = `
      <div class="reference-panel expanded" id="referencePanelInner" data-level="${currentLevel}">
        <div class="reference-header" onclick="ImageViewer.toggleReference()">
          <div class="reference-title">
            <i class="fas fa-eye"></i>
            <span>要素识别结果</span>
          </div>
          <i class="fas fa-chevron-up reference-toggle"></i>
        </div>
        <div class="reference-content">
          <div class="reference-inner">
    `;

    if (refData && refData.element_recognition) {
      html += this.renderElementRecognitionVisual(refData.element_recognition);
    } else if (refData) {
      html += '<div class="no-element-data"><i class="fas fa-info-circle"></i> 暂无要素识别数据</div>';
    } else {
      html += '<div class="no-element-data"><i class="fas fa-info-circle"></i> 暂无参考数据</div>';
    }

    html += `
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  /**
   * 可视化渲染要素识别结果
   * 数据格式: { "维度": [{ "维度名称": "xxx", "空间要素": [...] }] }
   */
  renderElementRecognitionVisual(data) {
    if (!data || typeof data !== 'object') {
      return '<div class="no-element-data"><i class="fas fa-info-circle"></i> 数据格式错误</div>';
    }

    let html = '<div class="element-recognition-visual">';

    // 处理 "维度" 数组
    if (data.维度 && Array.isArray(data.维度)) {
      data.维度.forEach((dimItem, dimIndex) => {
        // 渲染维度标题
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
                  <div class="inner">
                    <span class="element-number">${idx + 1}</span>
                    <span class="element-name-text">${name}</span>
                  </div>
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
      // 兼容其他格式
      html += '<div class="no-element-data"><i class="fas fa-info-circle"></i> 数据格式不匹配</div>';
    }

    html += '</div>';
    return html;
  },

  /**
   * 切换参考数据显示
   */
  toggleReference() {
    const panel = document.getElementById('referencePanelInner');
    if (panel) {
      panel.classList.toggle('expanded');
    }
  },

  /**
   * 上一张图像
   */
  prevImage() {
    if (AppState.currentImageIndex > 0) {
      AppState.currentImageIndex--;
      this.render();
      if (typeof RatingPanel !== 'undefined') {
        RatingPanel.render();
      }
      if (typeof App !== 'undefined') {
        App.updateProgress();
      }
    }
  },

  /**
   * 下一张图像
   */
  nextImage() {
    if (AppState.currentImageIndex < AppState.images.length - 1) {
      AppState.currentImageIndex++;
      this.render();
      if (typeof RatingPanel !== 'undefined') {
        RatingPanel.render();
      }
      if (typeof App !== 'undefined') {
        App.updateProgress();
      }
    }
  },

  /**
   * 跳转到指定图像
   */
  goToImage(index) {
    if (index >= 0 && index < AppState.images.length) {
      AppState.currentImageIndex = index;
      this.render();
      if (typeof RatingPanel !== 'undefined') {
        RatingPanel.render();
      }
      if (typeof App !== 'undefined') {
        App.updateProgress();
      }
    }
  },

  /**
   * 放大
   */
  zoomIn() {
    if (AppState.zoomLevel < 300) {
      AppState.zoomLevel += 25;
      this.updateZoom();
    }
  },

  /**
   * 缩小
   */
  zoomOut() {
    if (AppState.zoomLevel > 25) {
      AppState.zoomLevel -= 25;
      this.updateZoom();
    }
  },

  /**
   * 重置缩放
   */
  resetZoom() {
    AppState.zoomLevel = 100;
    this.updateZoom();
  },

  /**
   * 更新缩放显示
   */
  updateZoom() {
    const img = document.getElementById('mainImage');
    const level = document.getElementById('zoomLevel');

    if (img) {
      img.style.transform = `scale(${AppState.zoomLevel / 100})`;
    }
    if (level) {
      level.textContent = `${AppState.zoomLevel}%`;
    }
  },

  /**
   * 处理鼠标滚轮
   */
  handleWheel(event) {
    if (event.ctrlKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }
  },

  /**
   * 键盘导航
   */
  handleKeydown(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (event.key) {
      case 'ArrowLeft':
        this.prevImage();
        break;
      case 'ArrowRight':
        this.nextImage();
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
        const btn = document.querySelector(`.scale-btn[data-question="level_rating"][data-value="${event.key}"]`);
        if (btn) btn.click();
        break;
    }
  }
};

window.ImageViewer = ImageViewer;
