/**
 * 可步行性专家评价工具 - 全局状态管理
 */

const AppState = {
  // 当前层级
  currentLevel: null,

  // 当前模式: 'browse' | 'rate' | 'edit'
  currentMode: 'browse',

  // 当前视图: 'single' | 'gallery'
  currentView: 'single',

  // 配置数据
  config: null,

  // 按层级存储的图像列表 { levelId: [images] }
  levelImages: {},

  // 当前图像索引
  currentImageIndex: 0,

  // 评价数据 { levelId: { imageName: { answers: {}, timestamp: '' } } }
  ratings: {},

  // 按层级存储的参考数据 { levelId: { imageName: data } }
  levelReferenceData: {},

  // 画册分页
  galleryPage: 1,
  itemsPerPage: 24,

  // 图像缩放
  zoomLevel: 100,

  // 初始化状态
  initialized: false,

  /**
   * 获取当前层级的图像列表（兼容旧代码）
   */
  get images() {
    if (!this.currentLevel) return [];
    return this.levelImages[this.currentLevel] || [];
  },

  /**
   * 设置当前层级的图像列表（兼容旧代码）
   */
  set images(value) {
    if (this.currentLevel) {
      this.levelImages[this.currentLevel] = value;
    }
  },

  /**
   * 获取当前层级的参考数据（兼容旧代码）
   */
  get referenceData() {
    if (!this.currentLevel) return {};
    return this.levelReferenceData[this.currentLevel] || {};
  },

  /**
   * 设置当前层级的参考数据（兼容旧代码）
   */
  set referenceData(value) {
    if (this.currentLevel) {
      this.levelReferenceData[this.currentLevel] = value;
    }
  },

  /**
   * 重置状态
   */
  reset() {
    this.currentLevel = null;
    this.currentMode = 'browse';
    this.currentView = 'single';
    this.levelImages = {};
    this.currentImageIndex = 0;
    this.ratings = {};
    this.levelReferenceData = {};
    this.galleryPage = 1;
    this.zoomLevel = 100;
  },

  /**
   * 重置指定层级的数据
   */
  resetLevel(levelId) {
    if (!levelId) return;
    this.levelImages[levelId] = [];
    this.levelReferenceData[levelId] = {};
    this.ratings[levelId] = {};
  },

  /**
   * 检查指定层级是否有数据
   */
  hasLevelData(levelId) {
    const images = this.levelImages[levelId] || [];
    return images.length > 0;
  },

  /**
   * 获取当前层级配置
   */
  getCurrentLevelConfig() {
    if (!this.config || !this.currentLevel) return null;
    return this.config.levels.find(l => l.id === this.currentLevel);
  },

  /**
   * 获取当前图像
   */
  getCurrentImage() {
    return this.images[this.currentImageIndex] || null;
  },

  /**
   * 获取当前图像的评价数据
   */
  getCurrentRating() {
    const image = this.getCurrentImage();
    if (!image || !this.currentLevel) return null;
    return this.ratings[this.currentLevel]?.[image.name] || null;
  },

  /**
   * 获取评价进度
   */
  getProgress() {
    if (this.images.length === 0 || !this.currentLevel) {
      return { rated: 0, total: 0, percentage: 0 };
    }

    const levelRatings = this.ratings[this.currentLevel] || {};
    const rated = this.images.filter(img => {
      const rating = levelRatings[img.name];
      return rating && rating.answers && Object.keys(rating.answers).length > 0;
    }).length;

    return {
      rated,
      total: this.images.length,
      percentage: Math.round((rated / this.images.length) * 100)
    };
  },

  /**
   * 检查图像是否已评价
   */
  isImageRated(imageName) {
    if (!this.currentLevel) return false;
    const rating = this.ratings[this.currentLevel]?.[imageName];
    return rating && rating.answers && Object.keys(rating.answers).length > 0;
  },

  /**
   * 获取画册页面的图像
   */
  getGalleryImages() {
    const start = (this.galleryPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.images.slice(start, end);
  },

  /**
   * 获取总页数
   */
  getTotalPages() {
    return Math.ceil(this.images.length / this.itemsPerPage) || 1;
  },

  /**
   * 获取层级配置
   */
  getLevelConfig(levelId) {
    if (!this.config) return null;
    return this.config.levels.find(l => l.id === levelId);
  }
};

// 导出
window.AppState = AppState;
