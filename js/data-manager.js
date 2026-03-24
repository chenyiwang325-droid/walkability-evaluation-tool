/**
 * 可步行性专家评价工具 - 数据管理模块
 */

const DataManager = {
  // 存储键名
  KEYS: {
    CONFIG: 'walkability_config',
    RATINGS: 'walkability_ratings',
    QUESTIONNAIRE: 'walkability_questionnaire'
  },

  // 服务器 API 地址
  API_BASE: 'http://localhost:3000/api',

  // 是否使用服务器模式
  useServer: false,

  // 内嵌默认配置（避免CORS问题）
  defaultConfig: {
    "levels": [
      {
        "id": "accessibility",
        "name": "通达性",
        "folder": "通达性",
        "icon": "route",
        "description": "通达性代表了街道物理环境支持步行通行顺畅、无阻碍的程度，关注街道空间对步行连续通行的支撑条件",
        "dimensions": [
          {
            "id": "AR1",
            "name": "街道连通性不足",
            "description": "关注街道是否可供步行，是否具备人行通过的条件。具体体现为两类情况：一是不存在可供行走的人行通道，人行路径被完全堵死、不可逾越（如施工完全阻挡人行道等，不包括等级较低的人车混行道路）；二是街道宽度过宽，且缺乏天桥、下穿道或二次过街路口等行人过街设施，导致行人过街困难"
          }
        ]
      },
      {
        "id": "safety",
        "name": "安全性",
        "folder": "安全性",
        "icon": "shield-alt",
        "description": "安全性代表了对于街道空间对人身体伤害、心理压力和其他潜在威胁的感知，该层级主要关注的是步行道本身或是其社会空间的安全性，不包括交通安全。",
        "dimensions": [
          {
            "id": "SR1",
            "name": "自然监视不足",
            "description": "自然监视不足主要关注街道环境中能够增强行人的安全感和抵御潜在威胁的设计和管理措施，具体体现为街道环境在 “安全关联的空间支撑” 层面存在不足 —— 既因空间设计（如高绿化遮挡、封闭界面、低底层透明度）或设施配置（如照明不足）的问题，导致步行区域的视觉通透度较差，周边人员难以有效观察步行空间、无法形成自然的安全监视；又因街道周边土地使用偏向低活动强度、低开放性类型（如无商铺、缺少公共开放空间），日常人员活动频次较低，既难以形成持续的环境活力，也无法为步行者提供足够的心理支撑与安全关联场景，这些状态共同削弱了步行者的安全感，降低了街道的安全防护水平。"
          },
          {
            "id": "SR2",
            "name": "环境失序",
            "description": "环境失序主要关注街道步行环境中物理环境的紊乱和不规范状态。具体表现为街道物理环境、人员活动秩序及安全防护措施存在负面状态 —— 如物理层面存在破败待修缮的建筑、增加杂乱度的街道要素、正常使用下的设施损坏等情况，人员活动相关层面存在废弃空间、较多垃圾、人为导致的设施损坏等问题，安全防护层面则有部分直接占用人行通道的施工行为缺乏完善防护设施。这些状态共同作用，既让步行者感知到空间环境的恶化与社会秩序的失序，加重对犯罪威胁的担忧，又无法充分保障行人通行的实际安全。"
          }
        ]
      },
      {
        "id": "comfort",
        "name": "舒适性",
        "folder": "舒适性",
        "icon": "couch",
        "description": "舒适性代表了一个人在街道中的安逸、便利和满足程度",
        "dimensions": [
          {
            "id": "CR1",
            "name": "机动交通隔离不足",
            "description": "主要关注能够使机动车减速或减少行人与机动车冲突，让人步行更安心的设计和措施。仅当道路较宽、交通性较强且存在必要的机动交通隔离需求时，才需判断是否存在机动交通隔离不足的问题。隔离设施包括明确隔离设施（护栏、隔离带、连续绿化带）和隐性隔离设施（行道树、路缘石）。交通稳静设施仅需在步行需求密集、步行与机动车交汇频繁的区域设置，对应的街边界面主要包括住宅出入口、学校 / 幼儿园周边、商业服务设施临街段、公园 / 广场等休闲场所与市政道路衔接处。"
          },
          {
            "id": "CR2",
            "name": "步行空间条件较差",
            "description": "主要关注人步行时的方便程度，是否有充足的空间、平整的地面进行步行活动。具体表现为：步行道狭窄、被非机动车/机动车/施工设施/商铺外摆占用，或因不合理高差、消极退界绿化挤占等情况；铺装质量欠佳、步行空间抬高导致使用受限等问题。"
          },
          {
            "id": "CR3",
            "name": "街道家具设施不足",
            "description": "街道家具设施主要指街道环境中能够减弱人步行疲劳度或抵御不良天气的，增强人步行舒适程度的设计。包括天气缓冲设施（行道树、雨篷、拱廊、骑楼等）和休憩服务设施（街边长椅、自行车停放架、信息设施等）。"
          }
        ]
      },
      {
        "id": "pleasantness",
        "name": "愉悦性",
        "folder": "愉悦性",
        "icon": "smile-beam",
        "description": "愉悦性关注街道空间的审美体验和活动活力，提升步行过程中的愉悦感受，包括建筑风貌、景观美学、多样性和活力等维度。",
        "dimensions": [
          {
            "id": "PR1",
            "name": "建筑一致性与尺度不适宜",
            "description": "建筑一致性与尺度主要关注街道空间尺度的适宜性与建筑风貌的协调性。具体体现为：沿街建筑风格缺乏共性、建筑高度与周边环境适配性差、街道高宽比失衡、行道树种植缺乏协同适配性、街道界面退线一致性不足等问题。"
          },
          {
            "id": "PR2",
            "name": "美学吸引力不足",
            "description": "美学吸引力主要关注街道环境的视觉美感，直接体现为街道界面的设计美感，以及街道整体环境的视觉整洁度与美观度。具体体现为：植被搭配单一、建筑立面缺乏吸引力、缺乏公共艺术装置、缺乏美学照明设计等。"
          },
          {
            "id": "PR3",
            "name": "多样性与复杂性不足",
            "description": "多样性与复杂性主要关注街道特色的丰富与独特程度，体现街道在构成要素上的多元性与差异化。具体体现为：历史建筑与传统风貌建筑缺乏、地方特色文化元素单一、建筑形态统一、景观样式单一、色彩搭配单调、沿街功能单一等问题。"
          },
          {
            "id": "PR4",
            "name": "活力与活动水平不足",
            "description": "活力与活动水平主要关注街道的活动水平与空间活力，主要体现为街道内行人的数量与活动状态。具体体现为：缺乏开放空间、建筑未形成连续沿街界面、首层可进入性业态不足、沿街业态门店密度低、人流活跃度偏低等问题。"
          }
        ]
      }
    ],
    "ratingScale": {
      "1": "很差",
      "2": "较差",
      "3": "一般",
      "4": "较好",
      "5": "很好"
    },
    "scaleDescriptions": {
      "1": "该维度存在严重问题，对可步行性产生重大负面影响",
      "2": "该维度存在明显问题，对可步行性产生较大负面影响",
      "3": "该维度表现一般，对可步行性影响中性",
      "4": "该维度表现较好，对可步行性有一定正面影响",
      "5": "该维度表现优秀，对可步行性产生显著正面影响"
    }
  },

  /**
   * 检测服务器是否可用
   */
  async checkServerAvailability() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.API_BASE}/config`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        this.useServer = true;
        console.log('✅ 服务器模式已启用，数据将保存到本地文件');
        return true;
      }
    } catch (error) {
      console.log('ℹ️ 服务器未运行，使用浏览器本地存储模式');
    }
    this.useServer = false;
    return false;
  },

  /**
   * 加载默认配置（使用内嵌配置）
   */
  async loadDefaultConfig() {
    // 检测服务器
    await this.checkServerAvailability();

    // 尝试从服务器或localStorage加载用户配置
    const userConfig = await this.loadUserConfig();
    if (userConfig) {
      AppState.config = userConfig;
      console.log('✅ 已加载用户配置');
    } else {
      // 使用内嵌配置
      AppState.config = JSON.parse(JSON.stringify(this.defaultConfig));
      console.log('✅ 已加载默认配置');
    }
    return AppState.config;
  },

  /**
   * 加载用户配置（从服务器或localStorage）
   */
  async loadUserConfig() {
    // 优先从服务器加载
    if (this.useServer) {
      try {
        const response = await fetch(`${this.API_BASE}/config`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            return result.data;
          }
        }
      } catch (error) {
        console.error('从服务器加载配置失败:', error);
      }
    }

    // 从 localStorage 加载
    try {
      const saved = localStorage.getItem(this.KEYS.CONFIG);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载用户配置失败:', error);
    }
    return null;
  },

  /**
   * 保存配置（到服务器文件或localStorage）
   */
  async saveConfig(config) {
    AppState.config = config;

    // 优先保存到服务器
    if (this.useServer) {
      try {
        const response = await fetch(`${this.API_BASE}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            console.log('✅ 配置已保存到本地文件');
            return true;
          }
        }
      } catch (error) {
        console.error('保存配置到服务器失败:', error);
      }
    }

    // 保存到 localStorage
    try {
      localStorage.setItem(this.KEYS.CONFIG, JSON.stringify(config));
      console.log('✅ 配置已保存到浏览器存储');
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      return false;
    }
  },

  /**
   * 加载评价数据
   */
  async loadRatings() {
    // 优先从服务器加载
    if (this.useServer) {
      try {
        const response = await fetch(`${this.API_BASE}/ratings`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            AppState.ratings = result.data;
            return AppState.ratings;
          }
        }
      } catch (error) {
        console.error('从服务器加载评价数据失败:', error);
      }
    }

    // 从 localStorage 加载
    try {
      const saved = localStorage.getItem(this.KEYS.RATINGS);
      if (saved) {
        AppState.ratings = JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载评价数据失败:', error);
      AppState.ratings = {};
    }
    return AppState.ratings;
  },

  /**
   * 保存单条评价数据
   */
  async saveRating(levelId, imageName, answers) {
    try {
      if (!AppState.ratings[levelId]) {
        AppState.ratings[levelId] = {};
      }
      AppState.ratings[levelId][imageName] = {
        answers,
        timestamp: new Date().toISOString()
      };

      // 保存到服务器或 localStorage
      if (this.useServer) {
        // 异步保存到服务器，不阻塞界面
        fetch(`${this.API_BASE}/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(AppState.ratings)
        }).catch(error => {
          console.error('保存评价数据到服务器失败:', error);
          // 回退到 localStorage
          localStorage.setItem(this.KEYS.RATINGS, JSON.stringify(AppState.ratings));
        });
      } else {
        localStorage.setItem(this.KEYS.RATINGS, JSON.stringify(AppState.ratings));
      }
      return true;
    } catch (error) {
      console.error('保存评价数据失败:', error);
      return false;
    }
  },

  /**
   * 获取指定层级的评价数据
   */
  getRatingsByLevel(levelId) {
    return AppState.ratings[levelId] || {};
  },

  /**
   * 导出评价数据为JSON
   */
  exportToJSON(levelId) {
    const levelConfig = AppState.config.levels.find(l => l.id === levelId);
    const ratings = this.getRatingsByLevel(levelId);
    const ratingList = Object.entries(ratings).map(([imageName, data]) => ({
      imageName,
      answers: data.answers,
      timestamp: data.timestamp
    }));

    const exportData = {
      exportTime: new Date().toISOString(),
      levelId,
      levelName: levelConfig?.name || levelId,
      totalImages: AppState.images.length,
      ratedImages: ratingList.length,
      ratings: ratingList
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `评价结果_${levelConfig?.name || levelId}_${this.formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 导出评价数据为Excel
   */
  exportToExcel(levelId) {
    const levelConfig = AppState.config.levels.find(l => l.id === levelId);
    const ratings = this.getRatingsByLevel(levelId);
    const ratingScale = AppState.config.ratingScale;

    // 构建维度ID到名称的映射
    const dimensionMap = {};
    levelConfig.dimensions.forEach(d => {
      dimensionMap[d.id] = d.name;
    });

    // 构建数据行
    const rows = [];
    const headers = ['图像名称', '层级评价', ...levelConfig.dimensions.map(d => d.name), '问题归因', '评价时间'];
    rows.push(headers);

    Object.entries(ratings).forEach(([imageName, data]) => {
      // 将数值评分转换为中文标签
      const levelRating = data.answers?.level_rating;
      const levelRatingLabel = levelRating ? ratingScale[levelRating] : '';

      // 将各维度评分转换为中文标签
      const dimensionRatings = levelConfig.dimensions.map(d => {
        const rating = data.answers?.[`dim_${d.id}`];
        return rating ? ratingScale[rating] : '';
      });

      // 将问题归因的ID转换为中文名称
      const issueIds = data.answers?.issue_selection || [];
      const issueNames = issueIds.map(id => {
        // 如果是 'no_issue'，返回特殊文本
        if (id === 'no_issue') {
          return '无明显问题';
        }
        // 否则从维度映射中获取名称
        return dimensionMap[id] || id;
      }).join('，');

      const row = [
        imageName,
        levelRatingLabel,
        ...dimensionRatings,
        issueNames,
        data.timestamp ? new Date(data.timestamp).toLocaleString('zh-CN') : ''
      ];
      rows.push(row);
    });

    // 使用SheetJS创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 设置列宽
    ws['!cols'] = [
      { wch: 20 }, // 图像名称
      { wch: 10 }, // 层级评价
      ...levelConfig.dimensions.map(() => ({ wch: 12 })),
      { wch: 30 }, // 问题归因
      { wch: 20 }  // 评价时间
    ];

    XLSX.utils.book_append_sheet(wb, ws, '评价结果');
    XLSX.writeFile(wb, `评价结果_${levelConfig?.name || levelId}_${this.formatDate(new Date())}.xlsx`);
  },

  /**
   * 从JSON导入评价数据
   */
  async importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.levelId || !data.ratings) {
            throw new Error('无效的评价数据格式');
          }

          // 合并评价数据
          if (!AppState.ratings[data.levelId]) {
            AppState.ratings[data.levelId] = {};
          }
          data.ratings.forEach(item => {
            AppState.ratings[data.levelId][item.imageName] = {
              answers: item.answers,
              timestamp: item.timestamp
            };
          });

          localStorage.setItem(this.KEYS.RATINGS, JSON.stringify(AppState.ratings));
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },

  /**
   * 从Excel导入评价数据
   */
  async importFromExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet);

          if (jsonData.length === 0) {
            throw new Error('Excel文件无数据');
          }

          // 解析Excel数据
          const levelId = AppState.currentLevel;
          if (!levelId) {
            throw new Error('请先选择评价层级');
          }

          const levelConfig = AppState.config.levels.find(l => l.id === levelId);

          if (!AppState.ratings[levelId]) {
            AppState.ratings[levelId] = {};
          }

          jsonData.forEach(row => {
            const imageName = row['图像名称'];
            if (!imageName) return;

            const answers = {
              level_rating: row['层级评价']
            };

            levelConfig.dimensions.forEach(d => {
              answers[`dim_${d.id}`] = row[d.name];
            });

            const issueStr = row['问题归因'] || '';
            answers.issue_selection = issueStr.split(',').map(s => s.trim()).filter(s => s);

            AppState.ratings[levelId][imageName] = {
              answers,
              timestamp: row['评价时间'] ? new Date(row['评价时间']).toISOString() : new Date().toISOString()
            };
          });

          localStorage.setItem(this.KEYS.RATINGS, JSON.stringify(AppState.ratings));
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * 重置评价数据
   */
  resetRatings(levelId) {
    if (levelId) {
      AppState.ratings[levelId] = {};
    } else {
      AppState.ratings = {};
    }
    localStorage.setItem(this.KEYS.RATINGS, JSON.stringify(AppState.ratings));
  },

  /**
   * 导出问卷配置
   */
  exportQuestionnaire(questionnaire) {
    const blob = new Blob([JSON.stringify(questionnaire, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `问卷配置_${this.formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 导入问卷配置
   */
  async importQuestionnaire(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          localStorage.setItem(this.KEYS.QUESTIONNAIRE, JSON.stringify(data));
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },

  /**
   * 格式化日期
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}`;
  },

  /**
   * 检查服务器上可用的图像
   */
  async checkAvailableImages() {
    if (!this.useServer) {
      return { hasImages: false, levels: {}, total: 0 };
    }

    try {
      const response = await fetch(`${this.API_BASE.replace('/api', '')}/api/available-images`);
      if (response.ok) {
        const result = await response.json();
        return result.data || { hasImages: false, levels: {}, total: 0 };
      }
    } catch (error) {
      console.error('检查可用图像失败:', error);
    }
    return { hasImages: false, levels: {}, total: 0 };
  },

  /**
   * 一键加载当前层级的图像
   */
  async loadLevelImages(levelId) {
    if (!this.useServer) {
      return { success: false, message: '需要服务器模式' };
    }

    try {
      // 通过服务器加载指定层级的图像
      const levelConfig = LEVELS[levelId] || { folder: levelId };
      const imagesPath = `images/${levelConfig.folder || levelId}`;

      const response = await fetch(`${this.API_BASE.replace('/api', '')}/${imagesPath}/`);
      if (response.ok) {
        return { success: true, path: imagesPath };
      }
    } catch (error) {
      console.error('加载层级图像失败:', error);
    }
    return { success: false, message: '加载失败' };
  },

  /**
   * 获取指定层级的评分标准
   */
  async getRatingStandards(levelId) {
    if (!this.useServer) {
      return { success: false, message: '需要启动服务器模式才能查看评分标准', content: null };
    }

    try {
      const response = await fetch(`${this.API_BASE}/rating-standards/${levelId}`);
      if (response.ok) {
        const result = await response.json();
        return result;
      }
    } catch (error) {
      console.error('获取评分标准失败:', error);
    }
    return { success: false, message: '获取评分标准失败', content: null };
  },

  /**
   * 获取完整的知识图谱
   */
  async getKnowledgeGraph() {
    if (!this.useServer) {
      return { success: false, message: '需要启动服务器模式才能查看知识图谱', content: null };
    }

    try {
      const response = await fetch(`${this.API_BASE}/knowledge-graph`);
      if (response.ok) {
        const result = await response.json();
        return result;
      }
    } catch (error) {
      console.error('获取知识图谱失败:', error);
    }
    return { success: false, message: '获取知识图谱失败', content: null };
  }
};

// 层级配置映射
const LEVELS = {
  'accessibility': { folder: '通达性', name: '通达性' },
  'safety': { folder: '安全性', name: '安全性' },
  'comfort': { folder: '舒适性', name: '舒适性' },
  'pleasantness': { folder: '愉悦性', name: '愉悦性' }
};

// 导出
window.DataManager = DataManager;
window.LEVELS = LEVELS;
