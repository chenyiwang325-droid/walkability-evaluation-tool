/**
 * 可步行性专家评价工具 - 图像加载模块
 */

const ImageLoader = {
  // 支持的图像格式
  SUPPORTED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],

  /**
   * 从服务器加载指定层级的图像
   */
  async loadFromServer(levelId) {
    try {
      // 获取图像列表
      const response = await fetch(`${DataManager.API_BASE}/level-images/${levelId}`);
      if (!response.ok) {
        throw new Error('获取图像列表失败');
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.message || '获取图像列表失败');
      }

      const data = result.data;

      if (!data.images || data.images.length === 0) {
        throw new Error('该层级没有图像');
      }

      // 创建图像数据
      const images = data.images.map(img => ({
        name: img.name,
        path: img.url,
        url: img.url, // 直接使用服务器URL
        size: 0,
        type: 'image/jpeg'
      }));

      // 按文件名排序
      images.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

      // 初始化当前层级的参考数据（清空）
      AppState.levelReferenceData[levelId] = {};

      // 加载参考数据到对应层级
      if (data.hasReference) {
        try {
          const refResponse = await fetch(`${DataManager.API_BASE}/reference-data/${levelId}`);
          if (refResponse.ok) {
            const refResult = await refResponse.json();
            if (refResult.success && refResult.data && refResult.data.data) {
              // 将参考数据按图像名称索引存储到对应层级
              if (!AppState.levelReferenceData[levelId]) {
                AppState.levelReferenceData[levelId] = {};
              }
              refResult.data.data.forEach(item => {
                if (item.image_name) {
                  AppState.levelReferenceData[levelId][item.image_name] = item;
                }
              });
              console.log(`加载${levelId}层级参考数据: ${Object.keys(AppState.levelReferenceData[levelId]).length} 条`);
            }
          }
        } catch (e) {
          console.warn('加载参考数据失败:', e);
        }
      }

      // 设置当前层级的图像数据
      AppState.levelImages[levelId] = images;
      AppState.currentImageIndex = 0;

      return {
        images,
        referenceCount: Object.keys(AppState.levelReferenceData[levelId] || {}).length,
        detectedLevel: levelId
      };
    } catch (error) {
      console.error('从服务器加载图像失败:', error);
      throw error;
    }
  },

  /**
   * 从静态 manifest 加载指定层级的图像（纯静态托管模式，无需 server.js）
   * manifest.json 由 scripts/generate_image_manifest.py 生成，记录各层级图片清单。
   * 参考数据直接读取各层级已有的 <层级>_参考数据.json 静态文件。
   */
  async loadFromStatic(levelId) {
    try {
      // 拉取并缓存 manifest（相对路径，适配 GitHub Pages 子路径）
      if (!this._manifest) {
        const resp = await fetch('images/manifest.json');
        if (!resp.ok) {
          throw new Error('无法加载 images/manifest.json（HTTP ' + resp.status + '）');
        }
        this._manifest = await resp.json();
      }

      const entry = this._manifest[levelId];
      if (!entry || !entry.images || entry.images.length === 0) {
        throw new Error('该层级没有图像（manifest 中为空）');
      }

      // 创建图像数据（url 为相对路径，直接可用）
      let images = entry.images.map(img => ({
        name: img.name,
        path: img.url,
        url: img.url,
        size: 0,
        type: 'image/jpeg'
      }));

      // 按文件名自然排序
      images.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

      // 初始化当前层级的参考数据（清空）
      AppState.levelReferenceData[levelId] = {};

      // 加载参考数据（静态 JSON）
      if (entry.hasReference && entry.referenceUrl) {
        try {
          const refResponse = await fetch(entry.referenceUrl);
          if (refResponse.ok) {
            const refJson = await refResponse.json();
            // 兼容 {data: [...]} 或直接数组
            const refArr = Array.isArray(refJson) ? refJson : (refJson.data || []);
            if (!AppState.levelReferenceData[levelId]) {
              AppState.levelReferenceData[levelId] = {};
            }
            refArr.forEach(item => {
              if (item.image_name) {
                AppState.levelReferenceData[levelId][item.image_name] = item;
              }
            });
            console.log(`(静态)加载${levelId}层级参考数据: ${Object.keys(AppState.levelReferenceData[levelId]).length} 条`);
          }
        } catch (e) {
          console.warn('(静态)加载参考数据失败:', e);
        }
      }

      // 设置当前层级的图像数据
      AppState.levelImages[levelId] = images;
      AppState.currentImageIndex = 0;

      return {
        images,
        referenceCount: Object.keys(AppState.levelReferenceData[levelId] || {}).length,
        detectedLevel: levelId
      };
    } catch (error) {
      console.error('从静态 manifest 加载图像失败:', error);
      throw error;
    }
  },

  /**
   * 选择文件夹并加载图像到当前层级
   */
  selectFolder() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.directory = true;
      input.multiple = true;

      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        const result = await this.processFiles(files);
        resolve(result);
      };

      input.onerror = () => reject(new Error('文件夹选择失败'));
      input.click();
    });
  },

  /**
   * 选择单个或多个图像文件
   */
  selectFiles() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;

      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        const result = await this.processFiles(files);
        resolve(result);
      };

      input.onerror = () => reject(new Error('文件选择失败'));
      input.click();
    });
  },

  /**
   * 选择参考数据文件（JSON）并加载到当前层级
   */
  selectReferenceFiles(levelId) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.multiple = true;

      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        const result = await this.processReferenceFiles(files, levelId);
        resolve(result);
      };

      input.onerror = () => reject(new Error('文件选择失败'));
      input.click();
    });
  },

  /**
   * 处理参考数据文件
   */
  async processReferenceFiles(files, levelId) {
    const level = levelId || AppState.currentLevel;
    if (!level) {
      throw new Error('请先选择评价层级');
    }

    let loadedCount = 0;
    if (!AppState.levelReferenceData[level]) {
      AppState.levelReferenceData[level] = {};
    }
    const refData = AppState.levelReferenceData[level];

    // 获取当前层级的图像列表，用于匹配
    const images = AppState.levelImages[level] || [];
    const imageNames = images.map(img => img.name);
    const imageBaseNames = images.map(img => this.getBaseName(img.name));

    console.log('=== 参考数据处理 ===');
    console.log('当前层级图像列表:', imageNames);

    for (const file of files) {
      if (this.isJSONFile(file)) {
        try {
          const data = await this.readJSONFile(file);
          const fileBaseName = this.getBaseName(file.name);
          console.log(`处理文件: ${file.name}, 基本名称: ${fileBaseName}`);

          // 检查数据结构：可能是数组或对象
          if (Array.isArray(data)) {
            // 如果是数组，遍历每个元素
            console.log(`  数据是数组, 包含 ${data.length} 个元素`);
            data.forEach((item, index) => {
              if (item.image_name) {
                refData[item.image_name] = item;
                console.log(`  存储数组项 ${index}: ${item.image_name}`);
              }
            });
          } else if (typeof data === 'object') {
            // 尝试多种匹配方式
            // 1. 直接使用文件基本名称
            refData[fileBaseName] = data;

            // 2. 如果数据中有 image_name 字段，使用它作为键
            if (data.image_name) {
              refData[data.image_name] = data;
              console.log(`  使用 image_name: ${data.image_name}`);
            }

            // 3. 尝试匹配当前层级图像的各种扩展名
            const possibleExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.JPG', '.JPEG', '.PNG'];
            for (const ext of possibleExtensions) {
              const possibleImageName = fileBaseName + ext;
              refData[possibleImageName] = data;
            }

            // 4. 如果JSON文件名与某个图像的基本名称匹配,建立关联
            const imageIndex = imageBaseNames.indexOf(fileBaseName);
            if (imageIndex !== -1) {
              const actualImageName = imageNames[imageIndex];
              refData[actualImageName] = data;
              console.log(`  关联参考数据: ${file.name} -> ${actualImageName}`);
            }
          }

          loadedCount++;
        } catch (e) {
          console.warn(`读取参考数据失败: ${file.name}`, e);
        }
      }
    }

    console.log(`加载${level}层级参考数据: ${loadedCount} 个文件, 共 ${Object.keys(refData).length} 条记录`);
    console.log('存储的键名列表:', Object.keys(refData));

    return {
      loadedCount,
      totalReferenceCount: Object.keys(refData).length
    };
  },

  /**
   * 处理文件列表 - 存储到当前层级
   */
  async processFiles(files) {
    const images = [];
    const referenceFiles = {};
    const level = AppState.currentLevel;

    if (!level) {
      throw new Error('请先选择评价层级');
    }

    for (const file of files) {
      if (this.isImageFile(file)) {
        const imageData = await this.createImageData(file);
        images.push(imageData);
      } else if (this.isJSONFile(file)) {
        referenceFiles[this.getBaseName(file.name)] = file;
      }
    }

    // 按文件名排序
    images.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

    // 初始化当前层级的参考数据（不清除已有数据，只添加新的）
    if (!AppState.levelReferenceData[level]) {
      AppState.levelReferenceData[level] = {};
    }

    // 关联参考数据到当前层级
    for (const image of images) {
      const baseName = this.getBaseName(image.name);
      if (referenceFiles[baseName]) {
        try {
          const data = await this.readJSONFile(referenceFiles[baseName]);
          AppState.levelReferenceData[level][image.name] = data;
        } catch (e) {
          console.warn(`读取参考数据失败: ${baseName}`, e);
        }
      }
    }

    // 存储图像到当前层级
    AppState.levelImages[level] = images;
    AppState.currentImageIndex = 0;

    const levelConfig = AppState.getLevelConfig(level);
    console.log(`已加载 ${images.length} 张图像到「${levelConfig?.name || level}」层级`);

    return {
      images,
      referenceCount: Object.keys(AppState.levelReferenceData[level]).length,
      level: level
    };
  },

  /**
   * 创建图像数据对象
   */
  async createImageData(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          name: file.name,
          path: file.webkitRelativePath || file.name,
          url: e.target.result,
          size: file.size,
          type: file.type
        });
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * 读取JSON文件
   */
  async readJSONFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('JSON文件读取失败'));
      reader.readAsText(file);
    });
  },

  /**
   * 检查是否为图像文件
   */
  isImageFile(file) {
    return this.SUPPORTED_FORMATS.includes(file.type) ||
           /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
  },

  /**
   * 检查是否为JSON文件
   */
  isJSONFile(file) {
    return file.type === 'application/json' || /\.json$/i.test(file.name);
  },

  /**
   * 获取文件基本名称（不含扩展名）
   */
  getBaseName(filename) {
    return filename.replace(/\.[^.]+$/, '');
  },

  /**
   * 根据文件夹名称检测层级
   */
  detectLevelFromFolder(folderName) {
    const levelMap = {
      '通达性': 'accessibility',
      '安全性': 'safety',
      '舒适性': 'comfort',
      '愉悦性': 'pleasantness',
      'accessibility': 'accessibility',
      'safety': 'safety',
      'comfort': 'comfort',
      'pleasantness': 'pleasantness'
    };

    // 检查完整匹配
    if (levelMap[folderName]) {
      return levelMap[folderName];
    }

    // 检查部分匹配
    const lowerName = folderName.toLowerCase();
    for (const [key, value] of Object.entries(levelMap)) {
      if (lowerName.includes(key.toLowerCase())) {
        return value;
      }
    }

    return null;
  },

  /**
   * 获取图像的参考数据
   */
  getReferenceData(imageName) {
    return AppState.referenceData[imageName] || null;
  }
};

// 导出
window.ImageLoader = ImageLoader;
