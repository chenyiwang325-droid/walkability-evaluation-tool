/**
 * 可步行性专家评价工具 - 问卷设计器模块
 */

const QuestionnaireEditor = {
  /**
   * 渲染编辑器
   */
  render() {
    const container = document.getElementById('editorContainer');
    if (!container) return;

    const levelConfig = AppState.getCurrentLevelConfig();
    if (!levelConfig) {
      container.innerHTML = '<div class="editor-empty">请先选择要编辑的层级</div>';
      return;
    }

    // 构建HTML
    let html = '';

    // 评分标准编辑
    html += this.renderScaleEditor();

    // 问题列表编辑
    html += this.renderQuestionEditor(levelConfig);

    // 操作按钮
    html += this.renderActions();

    container.innerHTML = html;

    // 绑定事件
    this.bindEvents();
  },

  /**
   * 渲染评分标准编辑器
   */
  renderScaleEditor() {
    const ratingScale = AppState.config.ratingScale;

    let inputsHtml = '';
    for (let i = 1; i <= 5; i++) {
      inputsHtml += `
        <div class="scale-editor-item">
          <label class="scale-editor-label">${i}分</label>
          <input type="text" class="scale-editor-input"
                 data-score="${i}"
                 value="${ratingScale[i]}"
                 onchange="QuestionnaireEditor.updateScale(${i}, this.value)">
        </div>
      `;
    }

    return `
      <div class="editor-section">
        <div class="editor-section-title">
          <i class="fas fa-sliders-h"></i>
          评分标准设置
        </div>
        <div class="scale-editor">
          ${inputsHtml}
        </div>
      </div>
    `;
  },

  /**
   * 渲染问题编辑器
   */
  renderQuestionEditor(levelConfig) {
    // 生成默认问题列表
    const questions = this.generateDefaultQuestions(levelConfig);

    let questionsHtml = '';
    questions.forEach((q, index) => {
      questionsHtml += this.renderQuestionItem(q, index, levelConfig);
    });

    return `
      <div class="editor-section">
        <div class="editor-section-title">
          <i class="fas fa-list-alt"></i>
          问题列表
          <button class="btn btn-secondary" onclick="QuestionnaireEditor.addQuestion()" style="margin-left: auto; padding: 6px 12px; font-size: 13px;">
            <i class="fas fa-plus"></i> 添加问题
          </button>
        </div>
        <div id="questionList">
          ${questionsHtml}
        </div>
      </div>
    `;
  },

  /**
   * 生成默认问题
   */
  generateDefaultQuestions(levelConfig) {
    const questions = [
      {
        id: 'level_rating',
        title: `该街道断面${levelConfig.name}的评价应为？`,
        description: levelConfig.description,
        type: 'scale',
        required: true
      }
    ];

    levelConfig.dimensions.forEach(dim => {
      questions.push({
        id: `dim_${dim.id}`,
        title: `${dim.name}的评价应为？`,
        description: dim.description,
        type: 'scale',
        required: true
      });
    });

    questions.push({
      id: 'issue_selection',
      title: `若该街道空间的${levelConfig.name}感知存在问题，其问题归因为？`,
      description: '选择导致问题的主要维度，可多选',
      type: 'multiple',
      options: [
        ...levelConfig.dimensions.map(d => d.name),
        '无明显问题或影响较为轻微'
      ],
      required: true
    });

    return questions;
  },

  /**
   * 渲染单个问题项
   */
  renderQuestionItem(question, index, levelConfig) {
    const typeLabels = {
      'scale': '量表评价',
      'single': '单选题',
      'multiple': '多选题',
      'text': '文本输入'
    };

    let optionsHtml = '';
    if (question.type === 'multiple' || question.type === 'single') {
      const options = question.options || levelConfig.dimensions.map(d => d.name);
      optionsHtml = `
        <div class="question-options-editor">
          <label>选项列表</label>
          <div class="options-list">
            ${options.map((opt, i) => `
              <div class="option-item">
                <input type="text" value="${opt}" data-option-index="${i}">
                <button class="remove-option-btn" onclick="QuestionnaireEditor.removeOption(${index}, ${i})">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-secondary add-option-btn" onclick="QuestionnaireEditor.addOption(${index})">
            <i class="fas fa-plus"></i> 添加选项
          </button>
        </div>
      `;
    }

    return `
      <div class="question-editor" data-question-index="${index}">
        <div class="question-editor-header">
          <div class="question-editor-title">
            <span class="question-editor-number">${index + 1}</span>
            <input type="text" class="question-editor-text"
                   value="${question.title}"
                   onchange="QuestionnaireEditor.updateQuestionTitle(${index}, this.value)">
          </div>
          <div class="question-editor-actions">
            <button class="question-editor-btn" onclick="QuestionnaireEditor.moveQuestion(${index}, -1)" title="上移">
              <i class="fas fa-chevron-up"></i>
            </button>
            <button class="question-editor-btn" onclick="QuestionnaireEditor.moveQuestion(${index}, 1)" title="下移">
              <i class="fas fa-chevron-down"></i>
            </button>
            <button class="question-editor-btn delete" onclick="QuestionnaireEditor.deleteQuestion(${index})" title="删除">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="question-editor-body">
          <div class="question-editor-row">
            <div style="flex: 1;">
              <label>问题说明</label>
              <textarea rows="2" onchange="QuestionnaireEditor.updateQuestionDescription(${index}, this.value)">${question.description || ''}</textarea>
            </div>
          </div>
          <div class="question-editor-row">
            <div style="flex: 1;">
              <label>问题类型</label>
              <div class="question-type-selector">
                ${['scale', 'single', 'multiple', 'text'].map(type => `
                  <button class="question-type-btn ${question.type === type ? 'active' : ''}"
                          onclick="QuestionnaireEditor.setQuestionType(${index}, '${type}')">
                    ${typeLabels[type]}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          ${optionsHtml}
        </div>
      </div>
    `;
  },

  /**
   * 渲染操作按钮
   */
  renderActions() {
    return `
      <div class="editor-footer">
        <button class="btn btn-secondary" onclick="QuestionnaireEditor.resetConfig()">
          <i class="fas fa-undo"></i> 重置为默认
        </button>
        <button class="btn btn-secondary" onclick="QuestionnaireEditor.importConfig()">
          <i class="fas fa-file-import"></i> 导入配置
        </button>
        <button class="btn btn-secondary" onclick="QuestionnaireEditor.exportConfig()">
          <i class="fas fa-file-export"></i> 导出配置
        </button>
        <button class="btn btn-primary" onclick="QuestionnaireEditor.saveConfig()">
          <i class="fas fa-save"></i> 保存配置
        </button>
      </div>
    `;
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    // 事件已通过内联onclick绑定
  },

  /**
   * 更新评分标准
   */
  updateScale(score, value) {
    AppState.config.ratingScale[score] = value;
  },

  /**
   * 更新问题标题
   */
  updateQuestionTitle(index, value) {
    // 更新问题配置（需要保存到状态中）
    console.log('Update question title:', index, value);
  },

  /**
   * 更新问题说明
   */
  updateQuestionDescription(index, value) {
    console.log('Update question description:', index, value);
  },

  /**
   * 设置问题类型
   */
  setQuestionType(index, type) {
    console.log('Set question type:', index, type);
    // 重新渲染问题编辑器
    this.render();
  },

  /**
   * 添加问题
   */
  addQuestion() {
    console.log('Add question');
    // 添加新问题并重新渲染
  },

  /**
   * 删除问题
   */
  deleteQuestion(index) {
    if (confirm('确定要删除这个问题吗？')) {
      console.log('Delete question:', index);
      // 删除并重新渲染
    }
  },

  /**
   * 移动问题
   */
  moveQuestion(index, direction) {
    console.log('Move question:', index, direction);
    // 移动并重新渲染
  },

  /**
   * 添加选项
   */
  addOption(questionIndex) {
    console.log('Add option to question:', questionIndex);
  },

  /**
   * 删除选项
   */
  removeOption(questionIndex, optionIndex) {
    console.log('Remove option:', questionIndex, optionIndex);
  },

  /**
   * 保存配置
   */
  async saveConfig() {
    const success = await DataManager.saveConfig(AppState.config);
    if (success) {
      // 显示保存成功提示
      const toast = document.createElement('div');
      toast.className = 'toast-success';
      toast.innerHTML = `<i class="fas fa-check-circle"></i> 配置已保存到本地文件`;
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 16px 24px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 10px 40px rgba(16, 185, 129, 0.3);
        animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 9999;
      `;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    } else {
      alert('配置保存失败');
    }
  },

  /**
   * 导出配置
   */
  exportConfig() {
    const config = {
      levelId: AppState.currentLevel,
      ratingScale: AppState.config.ratingScale,
      questions: [] // 从编辑器收集问题
    };
    DataManager.exportQuestionnaire(config);
  },

  /**
   * 导入配置
   */
  importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const config = await DataManager.importQuestionnaire(file);
          // 应用配置
          this.render();
          alert('配置导入成功');
        } catch (error) {
          alert('配置导入失败: ' + error.message);
        }
      }
    };
    input.click();
  },

  /**
   * 重置为默认配置
   */
  resetConfig() {
    if (confirm('确定要重置为默认配置吗？当前修改将丢失。')) {
      localStorage.removeItem(DataManager.KEYS.CONFIG);
      location.reload();
    }
  }
};

// 导出
window.QuestionnaireEditor = QuestionnaireEditor;
