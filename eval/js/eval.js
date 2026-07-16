/**
 * 街道安全性专家评价 · /eval/ 主逻辑
 * 单链接、ID 驱动。编号决定评价页面与分配图像(对评价者不暴露分组标签)。
 * 纯前端,localStorage 存储,SheetJS 导出。复用原工具样式结构。
 */
(function () {
  "use strict";

  // ===== 配置(内容来自 知识图谱表格-问题归因.xlsx 与 可步行性评价评分标准.md,勿改) =====
  const SAFETY_DEF = "安全性代表了对于街道空间对人身体伤害、心理压力和其他潜在威胁的感知，该层级主要关注的是步行道本身或是其社会空间的安全性，不包括交通安全。";
  const DIMS = [
    { id: "SR1", name: "自然监视不足", desc: "自然监视不足主要关注街道环境中能够增强行人的安全感和抵御潜在威胁的设计和管理措施。自然监视不足是影响街道安全性的原因之一，具体体现为街道环境在“安全关联的空间支撑”层面存在不足——既因空间设计（如高绿化遮挡、封闭界面、低底层透明度）或设施配置（如照明不足）的问题，导致步行区域的视觉通透度较差，周边人员难以有效观察步行空间、无法形成自然的安全监视；又因街道周边土地使用偏向低活动强度、低开放性类型（如无商铺、缺少公共开放空间），日常人员活动频次较低，既难以形成持续的环境活力，也无法为步行者提供足够的心理支撑与安全关联场景，这些状态共同削弱了步行者的安全感，降低了街道的安全防护水平。" },
    { id: "SR2", name: "环境失序", desc: "环境失序主要关注街道步行环境中物理环境的紊乱和不规范状态。环境失序是影响街道安全性的原因之一，具体表现为街道物理环境、人员活动秩序及安全防护措施存在负面状态——如物理层面存在破败待修缮的建筑、增加杂乱度的街道要素、正常使用下的设施损坏等情况，人员活动相关层面存在废弃空间、较多垃圾、人为导致的设施损坏等问题，安全防护层面则有部分直接占用人行通道的施工行为缺乏完善防护设施。这些状态共同作用，既让步行者感知到空间环境的恶化与社会秩序的失序，加重对犯罪威胁的担忧，又无法充分保障行人通行的实际安全（需注意：外观陈旧但质量较好的建筑、整齐的架空电线或常规电线杆不属于此类问题；施工已设置规范围挡或隔离措施的也不属此情况）。" },
  ];
  const SCALE = { 1: "很差", 2: "较差", 3: "一般", 4: "较好", 5: "很好" };
  // 安全性评级判断标准(来自评分标准,仅内部知识库显示,不对外部暴露)
  const RATING_CRITERIA = [
    { v: 1, label: "很差", c: "自然监视严重缺失（完全封闭、无照明、无活动），环境严重失序（破败、垃圾、危险施工）" },
    { v: 2, label: "较差", c: "自然监视明显不足（视线受阻、照明不足），环境存在明显失序（破损、杂乱）" },
    { v: 3, label: "一般", c: "自然监视存在一定不足（部分区域视线受阻），环境存在轻微失序（局部杂乱）" },
    { v: 4, label: "较好", c: "自然监视基本充足（视觉通透性良好），环境整体整洁（仅有轻微杂乱）" },
    { v: 5, label: "很好", c: "自然监视充分（高透明度、充足照明、商铺活动），环境完全整洁有序" },
  ];
  // ===== 推理链路:问题归因(SR) -> 优化策略(SI) -> 实施举措(SM) 映射(来自知识图谱与pro对策提示词) =====
  const STRATEGIES = [
    { id:"SI1", name:"增强街道可见性", parent:"SR1", desc:"强化街道的自然监视能力，提升步行空间视线通透性与照明覆盖，减少遮挡干扰，让步行环境处于有效可视范围，增强安全感知。" },
    { id:"SI2", name:"提升沿街功能支持", parent:"SR1", desc:"增强周围环境安全支持力度，丰富街道周边活性业态与开放空间，提升人员活动频次，为步行者提供心理与实际层面的安全保障。" },
    { id:"SI3", name:"改善物质环境印象", parent:"SR2", desc:"针对街道物理环境中存在的破败、杂乱等各类负面状态，从优化空间整体品质的方向入手，改善环境呈现的无序性，提升空间的秩序与整洁程度。" },
    { id:"SI4", name:"提升社会环境秩序", parent:"SR2", desc:"针对与人员活动直接相关的空间无序状态，从规范空间使用、强化秩序管控的方向推进，优化环境呈现，提升空间的实际使用活力。" },
    { id:"SI5", name:"完善人身安全保障", parent:"SR2", desc:"针对步行空间中存在的安全防护不足问题，从完善通行场景下安全配套支持的方向出发，提升步行相关场景的安全保障能力。" },
  ];
  const MEASURES = [
    { id:"SM1", name:"增加照明设施", parent:"SI1", desc:"针对街道确实缺少路灯等必要照明要素的情况，补充符合城市道路照明标准的路灯、庭院灯等设施，确保夜间平均照度均匀、无明显暗区，照明覆盖完整覆盖步行道及临街界面。〔注意〕一般城市道路均有照明设施，部分可能被树木遮挡而不可见，需再三确认确实缺失后再提出；忽略图像拍摄造成的明暗偏差。" },
    { id:"SM2", name:"管控界面通透性", parent:"SI1", desc:"针对连续零通透实墙界面（长度不宜超过50米）。〔区分〕①施工围挡造成的视线遮蔽—不需通透性调整；②两侧建筑功能为居住或历史建筑—无调整空间（历史建筑仅修缮）；③其他情况可对实墙局部镂空或通透性调整，无调整条件时可材质调整或垂直绿化缓解；沿街栅栏式围墙宜保持一定程度通透性。" },
    { id:"SM3", name:"优化绿化遮挡", parent:"SI1", desc:"针对人视线高度的高遮挡绿化进行修剪或改造（分段留空/镂空造型/分层配置/局部替换为低生长品种）。〔注意〕高大乔木一般不视为遮挡，仅当绿化在人视线高度遮挡视线或店招时才提出；行道树遮挡视线/店招时修剪。" },
    { id:"SM4", name:"植入功能或增设开放空间", parent:"SI2", desc:"仅在现状具备场地条件时提出：增加社区便民服务型微业态（小型便民超市、社区服务站等）或小型开放空间（窄幅步行休憩带、微型防护绿地、小型休憩空间），配套监控点位、应急照明、安全指引标识。若两侧为旧改或围挡背后空间可视为可改造；无可用场地时不强行推进。" },
    { id:"SM5", name:"修缮沿街破旧建筑", parent:"SI3", desc:"对沿街破旧建筑开展外立面翻新：修补剥落墙体、填补裂缝，统一更换老化破损门窗（材质色彩与周边协调），屋顶清理移除杂物废弃建材、修复防水层。〔注意〕外观陈旧但质量较好的建筑不属于此项；历史建筑仅按保护要求修缮，不改变原有风貌。" },
    { id:"SM6", name:"整治街道杂乱问题", parent:"SI3", desc:"规范沿街管线，对架空线采用入地铺设或整理成束、套管包裹方式处理，消除视觉杂乱（管线整理需符合电力、通信等行业规范）。〔注意〕整齐的架空电线或常规电线杆不属于杂乱问题。" },
    { id:"SM7", name:"修复损坏设施", parent:"SI3", desc:"对破损的步道砖、路缘石及时更换（材质与原有设施一致），对断裂的步行护栏、锈蚀的休憩座椅进行焊接修补或整体更换，确保设施功能完好、无安全隐患。" },
    { id:"SM8", name:"垃圾源头管控与宣传劝导", parent:"SI4", desc:"加强垃圾源头管控：在沿街商铺、居民小区门口张贴宣传海报、社区微信群推送科普、网格员上门劝导，宣传垃圾分类与规范投放；重点时段（早餐、夜间用餐）安排志愿者/城管巡逻劝导，对乱扔垃圾、乱倒污水及时制止。" },
    { id:"SM9", name:"激活废弃空间", parent:"SI4", desc:"仅针对独立出现的废弃空间（非街道整体空置）：将街道旁闲置空地、废弃商铺结合居民需求改造为口袋公园、便民服务点、社区共享菜园、临时停车场等实用场景，完善配套设施，安排专人管理维护。" },
    { id:"SM10", name:"推进旧改项目实施", parent:"SI4", desc:"针对街道整体空置或封闭（沿街界面整体为实体封闭，疑似已列为旧改项目，一般为里弄住宅）。提出积极推动旧改项目实施，加快拆迁、规划设计与重建进度，同步完善周边基础设施与公共服务设施。〔注意〕需确认确实为旧改项目，单纯老旧建筑封闭不属此情况。" },
    { id:"SM11", name:"增加施工安全防护", parent:"SI5", desc:"针对施工或其他行为直接外露在步行通行空间、且防护措施简陋的情况，按《建设工程文明施工管理规定》提出：围挡（硬质材料、基础牢固、高度≥2米）、密目式安全网/脚手架警示漆、外立面紧邻道路时搭建安全天棚及警示引导标志等。〔注意〕已有规范围挡/围墙有效隔离步行空间的施工不属于防护较差，不重复提出；能看到工程结构与施工立面属正常。" },
  ];
  // 内部知识库(定义+SR1/SR2维度含义+评级标准,单一来源,不在他处重复)
  const CHAIN_KB = DIMS.map(d => {
    const sis = STRATEGIES.filter(st => st.parent === d.id);
    return `<div class="kb-sr"><div class="kb-sr-h"><span class="kb-tag">${d.id}</span> ${d.name}</div><div class="kb-desc">${d.desc}</div><div class="kb-chain">` +
      sis.map(st => {
        const sms = MEASURES.filter(m => m.parent === st.id);
        return `<div class="kb-si"><div class="kb-si-h"><span class="kb-tag sub">${st.id}</span> ${st.name}</div><div class="kb-desc">${st.desc}</div>` +
          (sms.length ? `<div class="kb-sm-list">${sms.map(m => `<div class="kb-sm"><div class="kb-sm-h"><span class="kb-tag sm">${m.id}</span> <b>${m.name}</b></div><div class="kb-desc">${m.desc}</div></div>`).join("")}</div>` : "") +
          `</div>`;
      }).join("") + `</div></div>`;
  }).join("");
  const KB_RATING_REF = `<p><strong>层级定义：</strong>${SAFETY_DEF}</p>
<p><strong>评级判断标准：</strong></p><ul style="margin:6px 0 0;padding-left:18px">${RATING_CRITERIA.map(r => `<li><strong>${r.v} ${r.label}：</strong>${r.c}</li>`).join("")}</ul>`;
  const KB_FULL = KB_RATING_REF + `<div class="kb-title"><i class="fas fa-sitemap"></i> 问题归因 → 优化策略 → 实施举措（完整推理链路与内涵参考）</div>${CHAIN_KB}`;
  const PER_STUDENT = 20;

  // ===== 状态 =====
  const S = { evaluatorId: null, mode: null, images: [], currentIndex: 0, ratings: {}, referenceData: {}, manifest: null };
  const app = document.getElementById("app");

  // ===== 工具 =====
  const lsKey = () => `safety_eval_${S.mode}_${S.evaluatorId}`;
  function saveStore() { localStorage.setItem(lsKey(), JSON.stringify({ evaluatorId: S.evaluatorId, ratings: S.ratings })); }
  function loadStore() { try { return JSON.parse(localStorage.getItem(lsKey()) || "null"); } catch (e) { return null; } }
  function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800); }
  function pidOf(name) { return (name || "").replace(/_front_view\.\w+$/, ""); }
  function esc(s) { return (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // 完成判定:评级 + 问题原因(外部:无问题选项或填了归因;内部:总体+SR1+SR2+归因复选)
  function isComplete(r) {
    if (!r || !r.level_rating) return false;
    if (S.mode === "external") {
      // 对外:无明显问题即完成;否则每个问题须类型+说明齐全,且每个问题须有≥1个完整策略,每个策略须有≥1个完整举措(推理链路完整)
      if (r.no_issue) return true;
      const attrs = r.attributions || [];
      if (!attrs.length || !attrs.every(a => (a.type || "").trim() && (a.analysis || "").trim())) return false;
      return attrs.every(a => {
        const sts = (a.strategies || []).filter(st => (st.direction || "").trim() && (st.reason || "").trim());
        if (!sts.length) return false;
        return sts.every(st => (st.measures || []).some(m => (m.action || "").trim() && (m.detail || "").trim()));
      });
    }
    // 对内:评级+归因齐全;若选了问题归因(SR)则每个SR须有≥1对应优化策略(SI),每个SI须有≥1对应实施举措(SM);无明显问题则直接完成
    if (!(r.sr1_rating && r.sr2_rating && r.issue_selection && r.issue_selection.length)) return false;
    const iss = r.issue_selection || [];
    if (iss.includes("no_issue")) return true;
    const srs = iss.filter(x => x !== "no_issue");
    if (!srs.length) return false;
    const sels = r.strategy_selection || [], msels = r.measure_selection || [];
    for (const sr of srs) { if (!STRATEGIES.some(st => st.parent === sr && sels.includes(st.id))) return false; }
    for (const si of sels) { if (!MEASURES.some(m => m.parent === si && msels.includes(m.id))) return false; }
    return true;
  }

  // ===== 落地页:编号输入(不暴露分组) =====
  function renderLanding(err) {
    app.innerHTML = `
      <div class="landing-wrap">
        <div class="landing-card">
          <div class="landing-icon"><i class="fas fa-shield-alt"></i></div>
          <h1 class="landing-title">街道步行感知安全性评价</h1>
          <p class="landing-purpose">本评价旨在收集您对街道步行感知安全性的评价。您将查看若干街景图像,依据安全性定义对每张图像所反映的街道步行安全性进行评级,并指出影响安全性的问题。</p>
          <p class="landing-sub">请输入分配给您的评价者编号,进入评价。</p>
          <input id="idInput" class="id-input" inputmode="numeric" placeholder="评价者编号" autocomplete="off" />
          <div class="id-hint ${err ? "err" : ""}">${err || "请输入分配给你的编号后进入。"}</div>
          <button class="btn btn-primary" id="enterBtn" style="width:100%;margin-top:14px"><i class="fas fa-arrow-right"></i> 进入评价</button>
        </div>
      </div>`;
    const inp = document.getElementById("idInput");
    inp.focus();
    const go = () => {
      const v = parseInt(inp.value.trim(), 10);
      if (!v || v < 1 || v > 26) { renderLanding("编号不正确,请确认后重新输入。"); return; }
      enterEval(v);
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    document.getElementById("enterBtn").addEventListener("click", go);
  }

  // ===== 进入评价 =====
  async function enterEval(id) {
    S.evaluatorId = id;
    S.mode = id <= 13 ? "external" : "internal";
    const mf = S.mode === "external" ? "images/manifest-existing.json" : "images/manifest-new.json";
    try {
      const r = await fetch(mf);
      if (!r.ok) throw new Error("HTTP " + r.status);
      S.manifest = await r.json();
    } catch (e) { renderLanding("图像清单加载失败,请刷新重试。"); return; }
    const all = (S.manifest.safety && S.manifest.safety.images) || [];
    if (!all.length) { renderLanding("未找到评价图像。"); return; }
    const slot = S.mode === "external" ? id : id - 13;
    S.images = assignImages(all, slot);
    if (S.mode === "internal" && S.manifest.safety.hasReference) {
      try {
        const r = await fetch(S.manifest.safety.referenceUrl);
        const arr = await r.json();
        (Array.isArray(arr) ? arr : (arr.data || [])).forEach(it => { if (it.image_name) S.referenceData[it.image_name] = it; });
      } catch (e) { console.warn("参考数据加载失败", e); }
    }
    const store = loadStore();
    S.ratings = (store && store.ratings) || {};
    S.currentIndex = 0;
    renderEval();
    // 首次进入该模式自动弹出使用指引(之后可点顶部"指引"按钮再看)
    if (!localStorage.getItem("eval_guide_seen_" + S.mode)) {
      localStorage.setItem("eval_guide_seen_" + S.mode, "1");
      startTour();
    }
  }

  function assignImages(all, slot) {
    const n = all.length, start = (PER_STUDENT * (slot - 1)) % n, out = [];
    for (let i = 0; i < PER_STUDENT; i++) out.push(all[(start + i) % n]);
    return out;
  }

  // ===== 评价页 =====
  function setKbOpen(open) {
    const dr = document.getElementById("kbDrawer");
    if (dr) dr.classList.toggle("open", open);
    document.body.classList.toggle("kb-open", open);
  }
  function ensureKbDrawer() {
    const show = S.mode === "internal";
    let btn = document.getElementById("kbToggle"), dr = document.getElementById("kbDrawer");
    if (!show) { if (btn) btn.style.display = "none"; setKbOpen(false); return; }
    if (!btn) {
      btn = document.createElement("button"); btn.id = "kbToggle"; btn.className = "kb-toggle";
      btn.innerHTML = '<i class="fas fa-book-open"></i><span>知识库</span>';
      btn.onclick = () => setKbOpen(!document.getElementById("kbDrawer").classList.contains("open"));
      document.body.appendChild(btn);
    }
    btn.style.display = "";
    if (!dr) {
      dr = document.createElement("div"); dr.id = "kbDrawer"; dr.className = "kb-drawer";
      dr.innerHTML = '<div class="kb-drawer-h"><span class="kb-drawer-title"><i class="fas fa-book-open"></i> 知识库 · 完整参考</span><button type="button" class="kb-drawer-close"><i class="fas fa-times"></i> 收起</button></div><div class="kb-drawer-body"></div>';
      dr.querySelector(".kb-drawer-close").onclick = () => setKbOpen(false);
      document.body.appendChild(dr);
    }
    dr.querySelector(".kb-drawer-body").innerHTML = KB_FULL;
  }
  function renderEval(preserveScroll) {
    const _ps = preserveScroll ? ((document.getElementById("panelPane") || {}).scrollTop || 0) : 0;
    const cur = S.images[S.currentIndex];
    const done = S.images.filter(im => isComplete(S.ratings[im.name])).length;
    const pct = Math.round(done / S.images.length * 100);
    const allDone = done === S.images.length;
    const idStr = String(S.evaluatorId).padStart(2, "0");
    app.innerHTML = `
      <div class="app-container">
        <header class="eval-header">
          <div class="eval-header-inner">
            <div class="eval-header-title"><i class="fas fa-shield-alt"></i><h1>街道安全性评价</h1></div>
            <span class="eval-id-chip">评价者 ${idStr}</span>
            ${allDone ? '<span class="eval-done-chip"><i class="fas fa-check"></i> 已完成</span>' : ''}
            <div class="eval-spacer"></div>
            <div class="eval-progress">
              <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
              <span class="txt">${done}/${S.images.length}</span>
            </div>
            <div class="prog-dropdown">
              <button class="btn btn-secondary" id="progBtn" title="查看完成进度"><i class="fas fa-list-ul"></i> 进度详情</button>
              <div class="prog-panel" id="progPanel">
                <div class="prog-panel-head">完成进度 ${done}/${S.images.length} ${allDone ? '(全部完成)' : ''}</div>
                <div class="prog-list">
                  ${S.images.map((im, i) => {
                    const ok = isComplete(S.ratings[im.name]);
                    return `<div class="prog-item ${i === S.currentIndex ? "cur" : ""}" data-i="${i}">
                      <span class="prog-stat ${ok ? "done" : "todo"}"><i class="fas fa-${ok ? "check-circle" : "circle"}"></i></span>
                      <span class="prog-idx">第${i + 1}张</span>
                      <span class="prog-pid">${pidOf(im.name)}</span>
                      <span class="prog-state">${ok ? "已完成" : "未完成"}</span>
                    </div>`;
                  }).join("")}
                </div>
              </div>
            </div>
            <button class="btn btn-secondary" id="guideBtn" title="使用指引"><i class="fas fa-question-circle"></i> 指引</button>
            <button class="btn btn-secondary" id="exportBtn"><i class="fas fa-download"></i> 导出</button>
            <button class="btn btn-secondary" id="exitBtn" title="退出"><i class="fas fa-sign-out-alt"></i></button>
          </div>
        </header>
        <main class="main-content" style="padding:0">
          <div class="single-view rate-mode" style="height:calc(100vh - 60px);padding:16px">
            <div class="single-view-left">
              <div class="image-viewer">
                <div class="image-viewer-header">
                  <div class="image-viewer-title"><i class="fas fa-image"></i> 街景图像 · pid ${pidOf(cur.name)}</div>
                </div>
                <div class="image-container"><img src="${cur.url}" alt="${cur.name}" /></div>
                <div class="image-nav">
                  <div class="image-nav-info"><i class="fas fa-map-marker-alt"></i> ${S.currentIndex + 1} / ${S.images.length}</div>
                  <div class="image-nav-controls">
                    <button class="nav-btn" id="prevBtn" ${S.currentIndex === 0 ? "disabled" : ""}><i class="fas fa-chevron-left"></i></button>
                    <button class="nav-btn" id="nextBtn"><i class="fas fa-chevron-right"></i></button>
                  </div>
                </div>
              </div>
            </div>
            <div class="single-view-right" id="panelPane">${renderPanel(cur)}</div>
          </div>
        </main>
      </div>`;
    bindPanel(cur);
    ensureKbDrawer();
    document.getElementById("guideBtn").addEventListener("click", startTour);
    document.getElementById("exportBtn").addEventListener("click", openExport);
    document.getElementById("exitBtn").addEventListener("click", () => { if (confirm("退出将返回编号输入页(已评分已保存)。确定?")) { S.evaluatorId = null; S.mode = null; renderLanding(); } });
    document.getElementById("prevBtn").addEventListener("click", () => nav(-1));
    document.getElementById("nextBtn").addEventListener("click", () => { if (S.currentIndex === S.images.length - 1) openExport(); else nav(1); });

    // 进度下拉菜单
    const progBtn = document.getElementById("progBtn");
    const progPanel = document.getElementById("progPanel");
    if (progBtn && progPanel) {
      progBtn.addEventListener("click", e => { e.stopPropagation(); progPanel.style.display = progPanel.style.display === "block" ? "none" : "block"; });
      progPanel.addEventListener("click", e => e.stopPropagation());
      progPanel.querySelectorAll(".prog-item").forEach(it => {
        it.addEventListener("click", () => {
          S.currentIndex = +it.dataset.i;
          progPanel.style.display = "none";
          renderEval();
        });
      });
    }
    // 外部点击关闭下拉(只绑一次)
    if (!window._progOutsideBound) {
      document.addEventListener("click", () => { const p = document.getElementById("progPanel"); if (p) p.style.display = "none"; });
      window._progOutsideBound = true;
    }
    // 同图交互保持面板滚动位置(避免点选项跳顶)
    if (preserveScroll) { const p = document.getElementById("panelPane"); if (p) p.scrollTop = _ps; }
  }

  // ===== 评分面板(外部:定义+总体+归因;内部:知识库(单一来源)+要素识别+分维度仅评级+总体+归因) =====
  function renderPanel(img) {
    const r = S.ratings[img.name] || {};
    let html = `<div class="rating-panel">`;

    if (S.mode === "external") {
      // 外部:安全性定义 + 总体评级
      html += `
        <div class="rating-section" id="sec-def">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-shield-alt"></i> 安全性</div></div>
          <div class="collapsible">
            <div class="collapsible-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="collapsible-title"><i class="fas fa-info-circle"></i><span>查看安全性定义</span></div>
              <i class="fas fa-chevron-down collapsible-arrow"></i>
            </div>
            <div class="collapsible-content"><div class="collapsible-inner">${SAFETY_DEF}</div></div>
          </div>
          <div class="rating-question">依据上述安全性定义,对该街道的步行感知安全性作出评价:</div>
          <div class="scale-buttons">${scaleBtns(r.level_rating, "level")}</div>
        </div>`;
      // 外部:问题归因多填(无提示)
      const attrs = r.attributions || (r.attributions = []);
      if (!attrs.length) attrs.push({ type: "", analysis: "" });
      const dis = r.no_issue ? "disabled" : "";
      const disCls = r.no_issue ? "disabled" : "";
      html += `
        <div class="rating-section" id="sec-attr">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-tag"></i> 问题归因</div></div>
          <div class="rating-question">请列出对该街道步行感知安全性存在明确负面影响的问题。</div>
          <div class="section-hint">概括影响步行感知安全性的问题,并填写相关解释说明(结合街景图像中的空间要素展开)。若明确存在多个影响安全性的问题,可逐个添加。若认为街道安全性较好或问题影响不明显,请勾选下方“无明显问题”。</div>
          <div id="attrList" class="${disCls}">${attrs.map((a, i) => attrEntry(i, a, dis)).join("")}</div>
          <button class="add-attr-btn" id="addAttrBtn" ${dis}><i class="fas fa-plus"></i> 添加一个问题类型</button>
          <div class="noissue-row">
            <div class="noissue-opt ${r.no_issue ? "on" : ""}" data-ni="1"><i class="fas fa-check-circle"></i> 无明显问题</div>
          </div>
          <div id="noissueExplain" style="display:${r.no_issue ? "block" : "none"};margin-top:8px">
            <textarea id="noissueExplainInput" class="text-area" placeholder="可选:说明无明显问题的依据(结合街景图像中的空间要素)">${esc(r.no_issue_explain || "")}</textarea>
          </div>
        </div>`;
    } else {
      // 内部:要素识别结果(模型)
      html += refSection(S.referenceData[img.name] || {});
      // 内部:总体评价(在分维度之前)
      html += `
        <div class="rating-section" id="sec-overall">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-layer-group"></i> 总体评价</div></div>
          <div class="collapsible">
            <div class="collapsible-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="collapsible-title"><i class="fas fa-info-circle"></i><span>安全性定义与评级标准（点此展开参考）</span></div>
              <i class="fas fa-chevron-down collapsible-arrow"></i>
            </div>
            <div class="collapsible-content"><div class="collapsible-inner" style="line-height:1.7">${KB_RATING_REF}</div></div>
          </div>
          <div class="rating-question">依据上述安全性定义,对该街道的步行感知安全性作出评价:</div>
          <div class="scale-buttons">${scaleBtns(r.level_rating, "level")}</div>
        </div>`;
      // 内部:分维度评价(SR1/SR2 仅评级,描述见知识库,不重复)
      html += `
        <div class="rating-section" id="sec-dims">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-th-list"></i> 分维度评价</div></div>
          ${DIMS.map(d => {
            const f = "sr" + d.id.replace("SR", "");
            return `<div class="rating-card ${r[f + "_rating"] ? "completed" : ""}">
              <div class="rating-question">针对「${d.name}」维度(依据其含义),评价该维度的表现:</div>
              <div class="scale-buttons">${scaleBtns(r[f + "_rating"], f)}</div>
            </div>`;
          }).join("")}
        </div>`;
      // 内部:问题归因(SR1/SR2多选 + 无明显问题,互斥锁定)
      const iss = r.issue_selection || [];
      const noIssSel = iss.includes("no_issue");
      const anySRSel = iss.some(x => x !== "no_issue");
      html += `
        <div class="rating-section" id="sec-issues">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-tags"></i> 问题归因</div></div>
          <div class="rating-question">请勾选该街道中明确影响步行安全性的问题维度:</div>
          <div class="section-hint">可多选对应维度;若认为街道安全性较好或问题影响不明显,勾选“无明显问题”。</div>
          <div id="issueList" class="${noIssSel ? "disabled" : ""}">
            <div class="checkbox-tags sr-tags">
              ${DIMS.map(d => `<div class="chain-row"><label class="checkbox-tag ${iss.includes(d.id) ? "checked" : ""}" data-id="${d.id}"><i class="fas fa-check"></i> ${d.id} ${d.name}</label><span class="chain-info-btn" data-sr-info="${d.id}"><i class="fas fa-circle-info"></i> 内涵</span></div><div class="chain-info-box" id="sr-info-${d.id}" style="display:none">${d.desc}</div>`).join("")}
            </div>
          </div>
          <div class="noissue-row">
            <div class="noissue-opt ${noIssSel ? "on" : ""} ${anySRSel ? "is-disabled" : ""}" id="internalNoIssue"><i class="fas fa-check-circle"></i> 无明显问题</div>
          </div>
        </div>`;
      // 内部:优化策略与实施举措(按已选问题归因分组,层级展开,选父级才展开子级)
      html += `
        <div class="rating-section" id="sec-chain">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-sitemap"></i> 优化策略与实施举措</div></div>
          <div class="rating-question">按所选问题归因，依次选择对应的优化策略，再选择该策略对应的实施举措：</div>
          <div class="section-hint">每个问题归因下仅列出其对应的优化策略；每个优化策略下仅列出其对应的实施举措，确保“问题→策略→举措”一一对应。</div>
          <div id="chainTree"></div>
        </div>`;
    }
    html += `</div>`;
    return html;
  }

  function scaleBtns(sel, field) {
    sel = sel ? String(sel) : null;
    let h = "";
    for (let i = 1; i <= 5; i++) h += `<button class="scale-btn ${String(i) === sel ? "selected" : ""}" data-value="${i}" data-field="${field}">${SCALE[i]}</button>`;
    return h;
  }

  function attrEntry(i, a, dis) {
    if (!a.strategies) a.strategies = [];
    return `<div class="attr-entry" data-i="${i}">
      <div class="attr-entry-head"><span class="lbl">问题 ${i + 1}</span><button class="attr-del" data-del="${i}" ${dis} title="删除问题"><i class="fas fa-times"></i></button></div>
      <div class="attr-label"><span>问题类型</span><span class="attr-cnt">${(a.type || "").length}/10</span></div>
      <input class="text-input attr-type" data-i="${i}" maxlength="10" placeholder="归纳安全性的问题" value="${esc(a.type || "")}" ${dis} />
      <div class="attr-label">解释说明</div>
      <textarea class="text-area attr-analysis" data-i="${i}" placeholder="结合街道中的空间要素进行相应的陈述和说明" ${dis}>${esc(a.analysis || "")}</textarea>
      <div class="nest-block">
        <div class="nest-block-h"><i class="fas fa-compass"></i> 优化策略（针对该问题的优化方向，可填多个）</div>
        <div class="nest-hint">侧重概括「优化方向」（方向层面）。</div>
        <div class="strategy-list" data-ai="${i}">${a.strategies.map((st, si) => strategyEntry(i, si, st, dis)).join("")}</div>
        <button type="button" class="add-nest-btn add-strategy" data-ai="${i}" ${dis}><i class="fas fa-plus"></i> 添加优化策略</button>
      </div>
    </div>`;
  }
  function strategyEntry(ai, si, st, dis) {
    if (!st.measures) st.measures = [];
    return `<div class="strategy-entry" data-ai="${ai}" data-si="${si}">
      <div class="nest-entry-head"><span class="lbl">优化策略 ${si + 1}</span><button type="button" class="nest-del strategy-del" data-ai="${ai}" data-si="${si}" ${dis} title="删除策略"><i class="fas fa-times"></i></button></div>
      <div class="attr-label">优化方向（概括该策略的方向）</div>
      <input class="text-input strat-direction" data-ai="${ai}" data-si="${si}" placeholder="概括优化方向" value="${esc(st.direction || "")}" ${dis} />
      <div class="attr-label">说明理由（为何选择该优化方向）</div>
      <textarea class="text-area strat-reason" data-ai="${ai}" data-si="${si}" placeholder="说明选择该优化方向的依据" ${dis}>${esc(st.reason || "")}</textarea>
      <div class="nest-block nest-deeper">
        <div class="nest-block-h"><i class="fas fa-tasks"></i> 实施举措（该方向下的具体落地做法，可填多个）</div>
        <div class="nest-hint">侧重「具体怎么做、在哪做、针对什么」（落地层面）。</div>
        <div class="measure-list" data-ai="${ai}" data-si="${si}">${st.measures.map((m, mi) => measureEntry(ai, si, mi, m, dis)).join("")}</div>
        <button type="button" class="add-nest-btn add-measure" data-ai="${ai}" data-si="${si}" ${dis}><i class="fas fa-plus"></i> 添加实施举措</button>
      </div>
    </div>`;
  }
  function measureEntry(ai, si, mi, m, dis) {
    return `<div class="measure-entry" data-ai="${ai}" data-si="${si}" data-mi="${mi}">
      <div class="nest-entry-head"><span class="lbl">举措 ${mi + 1}</span><button type="button" class="nest-del measure-del" data-ai="${ai}" data-si="${si}" data-mi="${mi}" ${dis} title="删除举措"><i class="fas fa-times"></i></button></div>
      <div class="attr-label">实施举措（概括具体做法）</div>
      <input class="text-input meas-action" data-ai="${ai}" data-si="${si}" data-mi="${mi}" placeholder="概括具体实施做法" value="${esc(m.action || "")}" ${dis} />
      <div class="attr-label">说明（结合街景说明可行性、实施位置与针对的空间对象）</div>
      <textarea class="text-area meas-detail" data-ai="${ai}" data-si="${si}" data-mi="${mi}" placeholder="结合街景图像说明该实施举措的可行性、具体实施位置与针对的空间对象" ${dis}>${esc(m.detail || "")}</textarea>
    </div>`;
  }

  function refSection(ref) {
    const er = ref.element_recognition || {};
    const dims = er["维度"] || [];
    if (!dims.length) return "";
    const inner = dims.map(d => {
      const els = d["空间要素"] || [];
      const rows = els.map(e => `<tr><td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);font-weight:500;white-space:nowrap">${e["名称"] || ""}</td><td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);color:var(--gray-500)">${e["位置"] || "-"}</td><td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);color:var(--gray-600)">${(e["描述"] || "").startsWith("该要素在该街景中不存在") ? `<span style="color:var(--gray-400);font-style:italic">未识别到</span>` : esc(e["描述"] || "")}</td></tr>`).join("");
      return `<div style="font-size:13px;font-weight:600;color:var(--safety-dark);margin:10px 0 4px">${d["维度名称"]}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;background:var(--gray-50);border-radius:6px;overflow:hidden">
          <thead><tr><th style="padding:6px 8px;text-align:left;background:var(--gray-100);color:var(--gray-500);font-weight:500">要素</th><th style="padding:6px 8px;text-align:left;background:var(--gray-100);color:var(--gray-500);font-weight:500">位置</th><th style="padding:6px 8px;text-align:left;background:var(--gray-100);color:var(--gray-500);font-weight:500">描述</th></tr></thead>
          <tbody>${rows}</tbody></table>`;
    }).join("");
    return `<div class="rating-section" id="sec-ref">
      <div class="collapsible">
        <div class="collapsible-header" onclick="this.parentElement.classList.toggle('expanded')">
          <div class="collapsible-title"><i class="fas fa-vector-square"></i><span>要素识别结果(参考)</span></div>
          <i class="fas fa-chevron-down collapsible-arrow"></i>
        </div>
        <div class="collapsible-content"><div class="collapsible-inner">${inner}</div></div>
      </div>
    </div>`;
  }

  // 就地更新进度UI(不重渲染面板,保持滚动)
  function updateProgressUI() {
    const done = S.images.filter(im => isComplete(S.ratings[im.name])).length;
    const total = S.images.length, pct = Math.round(done / total * 100), allDone = done === total;
    const fill = app.querySelector(".eval-progress .fill"); if (fill) fill.style.width = pct + "%";
    const txt = app.querySelector(".eval-progress .txt"); if (txt) txt.textContent = done + "/" + total;
    let chip = app.querySelector(".eval-done-chip");
    if (allDone && !chip) { const id = app.querySelector(".eval-id-chip"); if (id) id.insertAdjacentHTML("afterend", '<span class="eval-done-chip"><i class="fas fa-check"></i> 已完成</span>'); }
    else if (!allDone && chip) chip.remove();
    app.querySelectorAll(".prog-item").forEach((it, i) => {
      const ok = isComplete(S.ratings[S.images[i].name]);
      const stat = it.querySelector(".prog-stat"); if (stat) { stat.className = "prog-stat " + (ok ? "done" : "todo"); stat.innerHTML = `<i class="fas fa-${ok ? "check-circle" : "circle"}"></i>`; }
      const st = it.querySelector(".prog-state"); if (st) st.textContent = ok ? "已完成" : "未完成";
    });
    const head = app.querySelector(".prog-panel-head"); if (head) head.textContent = `完成进度 ${done}/${total} ${allDone ? "(全部完成)" : ""}`;
  }

  // ===== 绑定交互(就地更新,避免重渲染导致跳顶) =====
  function bindPanel(img) {
    const rec = () => S.ratings[img.name] || (S.ratings[img.name] = { evaluator_id: S.evaluatorId, image_name: img.name, pid: pidOf(img.name) });

    // 评级按钮:就地更新选中态+进度,不重渲染(保持滚动)
    app.querySelectorAll(".scale-btn").forEach(b => {
      b.addEventListener("click", () => {
        const f = b.dataset.field, v = b.dataset.value;
        const r = rec();
        if (f === "level") r.level_rating = v; else r[f + "_rating"] = v;
        r.timestamp = new Date().toISOString();
        saveStore();
        document.querySelectorAll(`.scale-btn[data-field="${f}"]`).forEach(x => x.classList.toggle("selected", x.dataset.value === String(v)));
        if (f !== "level") { const card = b.closest(".rating-card"); if (card) card.classList.add("completed"); }
        updateProgressUI();
      });
    });

    if (S.mode === "external") {
      const r = rec();
      r.attributions = r.attributions || [{ type: "", analysis: "" }];
      if (!r.attributions.length) r.attributions.push({ type: "", analysis: "" });

      const bindAttrInputs = () => {
        app.querySelectorAll(".attr-type").forEach(inp => {
          inp.addEventListener("input", () => {
            const i = +inp.dataset.i;
            r.attributions[i].type = inp.value;
            const cnt = inp.parentElement.querySelector(".attr-cnt");
            if (cnt) { cnt.textContent = inp.value.length + "/10"; cnt.style.color = inp.value.length >= 10 ? "var(--warning)" : ""; }
            saveStore(); updateProgressUI();
          });
        });
        app.querySelectorAll(".attr-analysis").forEach(ta => {
          ta.addEventListener("input", () => { r.attributions[+ta.dataset.i].analysis = ta.value; r.timestamp = new Date().toISOString(); saveStore(); updateProgressUI(); });
        });
        app.querySelectorAll(".attr-del").forEach(b => {
          b.addEventListener("click", () => {
            const i = +b.dataset.del;
            if (r.attributions.length <= 1) r.attributions[0] = { type: "", analysis: "" };
            else r.attributions.splice(i, 1);
            saveStore(); renderAttrList(); updateProgressUI();
          });
        });
      };
      const renderAttrList = () => {
        const dis = r.no_issue ? "disabled" : "";
        const list = document.getElementById("attrList");
        if (list) { list.className = r.no_issue ? "disabled" : ""; list.innerHTML = r.attributions.map((a, i) => attrEntry(i, a, dis)).join(""); }
        const addBtn = document.getElementById("addAttrBtn");
        if (addBtn) addBtn.disabled = !!r.no_issue;
        bindAttrInputs();
      };

      const addBtn = document.getElementById("addAttrBtn");
      if (addBtn) addBtn.addEventListener("click", () => {
        if (r.no_issue) r.no_issue = "";
        r.attributions.push({ type: "", analysis: "", strategies: [] });
        saveStore(); renderAttrList(); updateProgressUI();
      });
      bindAttrInputs();
      // 嵌套:优化策略/实施举措 输入+增删(委托到attrList,无需重绑)
      const attrListEl = document.getElementById("attrList");
      if (attrListEl) {
        const renderStrategyList = (ai) => {
          const dis = r.no_issue ? "disabled" : "";
          const wrap = attrListEl.querySelector('.strategy-list[data-ai="' + ai + '"]');
          if (wrap) wrap.innerHTML = (r.attributions[ai].strategies || []).map((st, si) => strategyEntry(ai, si, st, dis)).join("");
        };
        const renderMeasureList = (ai, si) => {
          const dis = r.no_issue ? "disabled" : "";
          const wrap = attrListEl.querySelector('.measure-list[data-ai="' + ai + '"][data-si="' + si + '"]');
          if (wrap) wrap.innerHTML = ((r.attributions[ai].strategies[si].measures) || []).map((m, mi) => measureEntry(ai, si, mi, m, dis)).join("");
        };
        attrListEl.addEventListener("input", e => {
          const t = e.target; if (!t.classList) return;
          const ai = t.dataset.ai, si = t.dataset.si, mi = t.dataset.mi;
          if (ai == null) return;
          const A = r.attributions[+ai]; if (!A || !A.strategies || A.strategies[+si] == null) return;
          if (t.classList.contains("strat-direction")) A.strategies[+si].direction = t.value;
          else if (t.classList.contains("strat-reason")) A.strategies[+si].reason = t.value;
          else if (A.strategies[+si].measures && A.strategies[+si].measures[+mi] != null) {
            const M = A.strategies[+si].measures[+mi];
            if (t.classList.contains("meas-action")) M.action = t.value;
            else if (t.classList.contains("meas-detail")) M.detail = t.value;
            else return;
          } else return;
          r.timestamp = new Date().toISOString(); saveStore(); updateProgressUI();
        });
        attrListEl.addEventListener("click", e => {
          const b = e.target.closest(".add-strategy,.strategy-del,.add-measure,.measure-del");
          if (!b) return;
          const ai = +b.dataset.ai, si = b.dataset.si != null ? +b.dataset.si : null;
          const A = r.attributions[ai]; if (!A) return;
          if (b.classList.contains("add-strategy")) { A.strategies = A.strategies || []; A.strategies.push({ direction: "", reason: "", measures: [] }); renderStrategyList(ai); }
          else if (b.classList.contains("strategy-del")) { A.strategies.splice(si, 1); renderStrategyList(ai); }
          else if (b.classList.contains("add-measure")) { A.strategies[si].measures = A.strategies[si].measures || []; A.strategies[si].measures.push({ action: "", detail: "" }); renderMeasureList(ai, si); }
          else if (b.classList.contains("measure-del")) { A.strategies[si].measures.splice(+b.dataset.mi, 1); renderMeasureList(ai, si); }
          else return;
          saveStore(); updateProgressUI();
        });
      }

      // 轻微/无明显:就地切换+锁定归因(只重渲染归因列表,不动整体面板)
      app.querySelectorAll(".noissue-opt").forEach(o => {
        o.addEventListener("click", () => {
          r.no_issue = !r.no_issue;
          if (r.no_issue) r.attributions = [{ type: "", analysis: "" }];
          r.timestamp = new Date().toISOString();
          saveStore();
          o.classList.toggle("on", r.no_issue);
          renderAttrList();
          const ex = document.getElementById("noissueExplain");
          if (ex) ex.style.display = r.no_issue ? "block" : "none";
          updateProgressUI();
        });
      });
      const exInp = document.getElementById("noissueExplainInput");
      if (exInp) exInp.addEventListener("input", () => { r.no_issue_explain = exInp.value; r.timestamp = new Date().toISOString(); saveStore(); });
    } else {
      // 内部归因:SR1/SR2 多选 + 无明显问题(互斥锁定,就地更新)
      const r = rec();
      // 优化策略与实施举措:按已选问题归因分组、层级展开(选父级才展开子级,保证链条对应)
      const renderChain = () => {
        const iss = r.issue_selection || [];
        const noIss = iss.includes("no_issue");
        const srSel = iss.filter(x => x !== "no_issue");
        // 级联校验:SI必须属于已选SR,SM必须属于已选SI
        let si = (r.strategy_selection || []).filter(id => STRATEGIES.some(st => st.id === id && srSel.includes(st.parent)));
        if (si.length !== (r.strategy_selection || []).length) r.strategy_selection = si;
        let sm = (r.measure_selection || []).filter(id => MEASURES.some(m => m.id === id && si.includes(m.parent)));
        if (sm.length !== (r.measure_selection || []).length) r.measure_selection = sm;
        const infoOpen = r.chain_info_open || [];
        const wrap = document.getElementById("chainTree"); if (!wrap) return;
        if (noIss) { wrap.innerHTML = '<div class="section-hint">无明显问题，无需选择。</div>'; return; }
        if (!srSel.length) { wrap.innerHTML = '<div class="section-hint">请先在上方勾选问题归因，其对应的优化策略与实施举措将依次展开。</div>'; return; }
        let h = "";
        DIMS.forEach(d => {
          if (!iss.includes(d.id)) return;
          h += `<div class="chain-sr"><div class="chain-sr-h"><span class="chip-sr">${d.id} ${d.name}</span><span class="chain-arrow">对应优化策略</span></div><div class="chain-body">`;
          const sis = STRATEGIES.filter(s => s.parent === d.id);
          if (!sis.length) h += '<div class="section-hint">无</div>';
          sis.forEach(s => {
            const on = si.includes(s.id);
            const siInfo = infoOpen.includes("si-" + s.id);
            h += `<div class="chain-si ${on ? "open" : ""}"><div class="chain-row"><label class="checkbox-tag ${on ? "checked" : ""}" data-chain="si" data-id="${s.id}"><i class="fas fa-check"></i> ${s.id} ${s.name}</label><span class="chain-info-btn ${siInfo ? "on" : ""}" data-info="si-${s.id}"><i class="fas fa-circle-info"></i> 内涵</span></div>`;
            if (siInfo) h += `<div class="chain-info-box"><b>策略内涵：</b>${s.desc}</div>`;
            if (on) {
              const sms = MEASURES.filter(m => m.parent === s.id);
              if (sms.length) h += '<div class="chain-sm">' + sms.map(m => {
                const mInfo = infoOpen.includes("sm-" + m.id);
                return `<div class="chain-sm-item"><div class="chain-row"><label class="checkbox-tag ${sm.includes(m.id) ? "checked" : ""}" data-chain="sm" data-id="${m.id}"><i class="fas fa-check"></i> ${m.id} ${m.name}</label><span class="chain-info-btn ${mInfo ? "on" : ""}" data-info="sm-${m.id}"><i class="fas fa-circle-info"></i> 内涵</span></div>${mInfo ? `<div class="chain-info-box"><b>举措内涵：</b>${m.desc}</div>` : ""}</div>`;
              }).join("") + '</div>';
            }
            h += "</div>";
          });
          h += "</div></div>";
        });
        wrap.innerHTML = h;
      };
      const tree = document.getElementById("chainTree");
      if (tree) tree.addEventListener("click", e => {
        const iBtn = e.target.closest("[data-info]");
        if (iBtn) {
          const key = iBtn.dataset.info;
          r.chain_info_open = r.chain_info_open || [];
          if (r.chain_info_open.includes(key)) r.chain_info_open = r.chain_info_open.filter(x => x !== key);
          else r.chain_info_open.push(key);
          r.timestamp = new Date().toISOString(); saveStore(); renderChain();
          return;
        }
        const tag = e.target.closest("[data-chain]"); if (!tag) return;
        const field = tag.dataset.chain === "si" ? "strategy_selection" : "measure_selection";
        r[field] = r[field] || [];
        const id = tag.dataset.id;
        if (r[field].includes(id)) r[field] = r[field].filter(x => x !== id);
        else r[field].push(id);
        r.timestamp = new Date().toISOString(); saveStore(); updateProgressUI(); renderChain();
      });
      renderChain();
      const updateIssueUI = () => {
        const iss = r.issue_selection || [];
        const noIss = iss.includes("no_issue");
        const anySR = iss.some(x => x !== "no_issue");
        const list = document.getElementById("issueList");
        if (list) list.classList.toggle("disabled", noIss);
        app.querySelectorAll("#issueList .checkbox-tag").forEach(t => t.classList.toggle("checked", iss.includes(t.dataset.id)));
        const ni = document.getElementById("internalNoIssue");
        if (ni) { ni.classList.toggle("on", noIss); ni.classList.toggle("is-disabled", anySR); }
      };
      const issListEl = document.getElementById("issueList");
      if (issListEl) issListEl.addEventListener("click", e => {
        const ib = e.target.closest("[data-sr-info]"); if (!ib) return;
        const box = document.getElementById("sr-info-" + ib.dataset.srInfo);
        if (!box) return;
        const open = box.style.display !== "none";
        box.style.display = open ? "none" : "block";
        ib.classList.toggle("on", !open);
      });
      app.querySelectorAll("#issueList .checkbox-tag").forEach(t => {
        t.addEventListener("click", () => {
          r.issue_selection = (r.issue_selection || []).filter(x => x !== "no_issue");
          const id = t.dataset.id;
          if (r.issue_selection.includes(id)) r.issue_selection = r.issue_selection.filter(x => x !== id);
          else r.issue_selection.push(id);
          r.timestamp = new Date().toISOString();
          saveStore(); updateIssueUI(); updateProgressUI(); renderChain();
        });
      });
      const niBtn = document.getElementById("internalNoIssue");
      if (niBtn) niBtn.addEventListener("click", () => {
        const noIss = (r.issue_selection || []).includes("no_issue");
        r.issue_selection = noIss ? [] : ["no_issue"];
        r.timestamp = new Date().toISOString();
        saveStore(); updateIssueUI(); updateProgressUI(); renderChain();
      });
    }
  }

  function nav(dir) {
    const ni = S.currentIndex + dir;
    if (ni < 0 || ni >= S.images.length) return;
    S.currentIndex = ni; renderEval();
  }

  // ===== 导出 =====
  // 使用指引:交互式分步导览(高亮框出各功能 + 编号标注)
  let _tour = null;
  function startTour() {
    const steps = (S.mode === "external" ? [
      { sel: ".image-viewer", t: "街景图像", c: "左侧显示待评价的街景图像,请仔细观察街道的安全性。", p: "right" },
      { sel: "#sec-def", t: "安全性定义与总体评级", c: "展开“查看安全性定义”阅读定义;选择该街道安全性的总体评级(1 很差 ~ 5 很好)。", p: "left" },
      { sel: "#sec-attr", t: "问题归因与对策", c: "点“添加一个问题类型”填写影响安全性的问题类型(≤10字)与分析(结合街景空间要素)。在每个问题下,可进一步填写“优化策略”(概括优化方向+理由,可多个),并在每个策略下填写“实施举措”(具体做法+可行性+位置+针对的空间对象,可多个)。若安全性较好或问题不明显,勾选“无明显问题”。", p: "left" },
      { sel: ".eval-header-inner", t: "进度与导出", c: "顶部显示完成进度;“进度详情”查看/跳转;全部 20 张完成后点“导出”保存结果文件。", p: "bottom" },
      { sel: ".image-nav", t: "切换图像", c: "点“上一张/下一张”切换(或键盘 ←/->);完成全部后导出交回。", p: "top" },
    ] : [
      { sel: ".image-viewer", t: "街景图像", c: "左侧显示待评价的街景图像,请仔细观察街道的安全性。", p: "right" },
      { sel: "#sec-overall", t: "定义与评级参考", c: "总体评价区可展开「安全性定义与评级标准」;右下角「知识库」按钮可打开完整参考(问题→策略→举措全内涵),独立滚动浏览。", p: "left" },
      { sel: "#sec-ref", t: "要素识别结果", c: "展开可查看模型识别的空间要素(仅供参考),辅助你的判断。", p: "left" },
      { sel: "#sec-overall", t: "总体评价", c: "选择该街道安全性的总体评级(1 很差 ~ 5 很好)。", p: "left" },
      { sel: "#sec-dims", t: "分维度评价", c: "为 SR1 自然监视不足、SR2 环境失序 各选一个 1-5 评级。", p: "left" },
      { sel: "#sec-issues", t: "问题归因", c: "勾选存在的问题维度(可多选),或勾选“无明显问题”。每个维度旁可点“ⓘ 内涵”查看参考。", p: "left" },
      { sel: "#sec-chain", t: "优化策略与实施举措", c: "按已选问题归因,依次选择对应的优化策略(每个可点“ⓘ 内涵”查看参考);选择策略后,其下展开对应的实施举措供选择。保证问题→策略→举措一一对应。", p: "left" },
      { sel: ".eval-header-inner", t: "进度与导出", c: "顶部显示完成进度;“进度详情”查看/跳转;全部 20 张完成后点“导出”保存结果文件。", p: "bottom" },
      { sel: ".image-nav", t: "切换图像", c: "点“上一张/下一张”切换(或键盘 ←/->);完成全部后导出交回。", p: "top" },
    ]).filter(s => document.querySelector(s.sel));
    if (!steps.length) return;
    const intro = { sel: null, t: "评价概览", c: "本次评价共 20 张街景图像。每张需完成:① 依据安全性定义进行安全性评级;② 诊断影响步行安全性的问题(或勾选“无明显问题”);③ 针对问题提出/选择优化策略与实施举措。下面逐一介绍各功能区域。", p: "center" };
    _tour = { steps: [intro, ...steps], i: 0 };
    showTourStep();
    window.addEventListener("resize", reposTour);
    window.addEventListener("scroll", reposTour, true);
  }
  function showTourStep() {
    if (!_tour) return;
    const { steps, i } = _tour;
    if (i < 0 || i >= steps.length) { endTour(); return; }
    const step = steps[i];
    if (!step.sel) { renderTour(null, step, i, steps.length); return; }
    const target = document.querySelector(step.sel);
    if (!target) { _tour.i = i + 1; showTourStep(); return; }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => renderTour(target, step, i, steps.length), 220);
  }
  function renderTour(target, step, i, total) {
    const rect = target ? target.getBoundingClientRect() : null;
    let mask = document.getElementById("tourMask");
    if (!mask) { mask = document.createElement("div"); mask.id = "tourMask"; mask.className = "tour-mask"; document.body.appendChild(mask); }
    mask.style.background = target ? "transparent" : "rgba(17,24,39,.45)";
    let spot = document.getElementById("tourSpotlight");
    if (!spot) { spot = document.createElement("div"); spot.id = "tourSpotlight"; spot.className = "tour-spotlight"; document.body.appendChild(spot); }
    if (target) {
      spot.style.display = "";
      spot.style.left = (rect.left - 4) + "px"; spot.style.top = (rect.top - 4) + "px";
      spot.style.width = (rect.width + 8) + "px"; spot.style.height = (rect.height + 8) + "px";
    } else { spot.style.display = "none"; }
    let tip = document.getElementById("tourTooltip");
    if (!tip) { tip = document.createElement("div"); tip.id = "tourTooltip"; tip.className = "tour-tooltip"; document.body.appendChild(tip); }
    tip.innerHTML = `<div class="tour-tip-head"><span class="tour-badge">${i + 1}/${total}</span><span class="tour-title">${step.t}</span></div>
      <div class="tour-content">${step.c}</div>
      <div class="tour-btns"><button class="tour-skip" id="tourSkip">跳过引导</button><span style="flex:1"></span>
      <button class="btn btn-secondary tour-prev" id="tourPrev" ${i === 0 ? "disabled" : ""}>上一步</button>
      <button class="btn btn-primary tour-next" id="tourNext">${i === total - 1 ? "完成" : "下一步"}</button></div>`;
    positionTip(tip, rect, step.p);
    document.getElementById("tourSkip").onclick = endTour;
    document.getElementById("tourPrev").onclick = () => { _tour.i = i - 1; showTourStep(); };
    document.getElementById("tourNext").onclick = () => { if (i === total - 1) endTour(); else { _tour.i = i + 1; showTourStep(); } };
  }
  function reposTour() {
    if (!_tour) return;
    const step = _tour.steps[_tour.i];
    const tip0 = document.getElementById("tourTooltip");
    if (!step.sel) { if (tip0) positionTip(tip0, null, "center"); return; }
    const target = document.querySelector(step.sel);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const spot = document.getElementById("tourSpotlight");
    if (spot) { spot.style.left = (rect.left - 4) + "px"; spot.style.top = (rect.top - 4) + "px"; spot.style.width = (rect.width + 8) + "px"; spot.style.height = (rect.height + 8) + "px"; }
    const tip = document.getElementById("tourTooltip");
    if (tip) positionTip(tip, rect, step.p);
  }
  function positionTip(tip, rect, place) {
    const tw = 340, m = 16;
    let left, top;
    if (!rect || place === "center") { left = (window.innerWidth - tw) / 2; top = (window.innerHeight - (tip.offsetHeight || 220)) / 2; }
    else if (place === "left") { left = rect.left - tw - m; top = rect.top; }
    else if (place === "right") { left = rect.right + m; top = rect.top; }
    else if (place === "top") { left = rect.left + rect.width / 2 - tw / 2; top = rect.top - tip.offsetHeight - m; }
    else { left = rect.left + rect.width / 2 - tw / 2; top = rect.bottom + m; }
    left = Math.max(m, Math.min(left, window.innerWidth - tw - m));
    top = Math.max(m, Math.min(top, window.innerHeight - 150));
    tip.style.left = left + "px"; tip.style.top = top + "px"; tip.style.width = tw + "px";
  }
  function endTour() {
    ["tourMask", "tourSpotlight", "tourTooltip"].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
    window.removeEventListener("resize", reposTour);
    window.removeEventListener("scroll", reposTour, true);
    _tour = null;
  }

  function openExport() {
    const total = S.images.length;
    const incomplete = S.images.map((im, i) => ({ i, ok: isComplete(S.ratings[im.name]) })).filter(x => !x.ok);
    const done = total - incomplete.length;
    const allDone = incomplete.length === 0;
    const idStr = String(S.evaluatorId).padStart(2, "0");
    const statusHtml = allDone
      ? `<div class="ex-status done"><i class="fas fa-check-circle"></i> 全部 ${total} 张已完成评价,可以导出。</div>`
      : `<div class="ex-status warn"><i class="fas fa-exclamation-triangle"></i> 还有 ${incomplete.length} 张未完成(第 ${incomplete.map(x => x.i + 1).join("、")} 张),建议完成后再导出。未完成项的字段将为空。</div>`;
    const ov = document.createElement("div");
    ov.className = "export-modal-overlay";
    ov.innerHTML = `<div class="export-modal">
      <h3>导出评价结果</h3>
      <div class="sub">评价者 ${idStr} · 完成进度 ${done}/${total}</div>
      ${statusHtml}
      <div class="ex-hint">确认导出?文件以你的编号命名(安全性评价_评价者${idStr})。Excel 含两个工作表:① 评分总表(每图一行概览)② 问题明细(每条问题一行,便于后续提取)。不同图像的问题数量不同时,也会逐条单独成行,准确适配。</div>
      <div class="export-opt" data-f="excel"><i class="fas fa-file-excel"></i> 确认导出 Excel(.xlsx)</div>
      <div class="export-opt" data-f="json"><i class="fas fa-file-code"></i> 确认导出 JSON</div>
      <button class="btn btn-secondary" style="width:100%;justify-content:center;margin-top:6px" data-f="cancel">取消</button>
    </div>`;
    app.appendChild(ov);
    ov.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => {
      const f = b.dataset.f; ov.remove();
      if (f === "excel") exportExcel(); else if (f === "json") exportJSON();
    }));
  }

  // Sheet1:评分总表(每图一行,人类可读概览;不再把多条问题塞进一格)
  function summaryRecords() {
    return S.images.map((im, idx) => {
      const r = S.ratings[im.name] || {};
      const base = {
        "评价者编号": S.evaluatorId,
        "图像序号": idx + 1,
        "图像文件名": im.name,
        "街景点位pid": pidOf(im.name),
        "安全性评级": r.level_rating ? SCALE[r.level_rating] : "",
        "完成状态": isComplete(r) ? "已完成" : "未完成",
      };
      if (S.mode === "external") {
        const attrs = (r.attributions || []).filter(a => (a.type || "").trim());
        base["无明显问题"] = r.no_issue ? "是" : "";
        base["无明显问题说明"] = r.no_issue ? (r.no_issue_explain || "") : "";
        base["问题数量"] = r.no_issue ? 0 : attrs.length;
        base["问题类型概览"] = r.no_issue ? "" : attrs.map(a => a.type).join("、");
      } else {
        const iss = r.issue_selection || [];
        base["SR1评级"] = r.sr1_rating ? SCALE[r.sr1_rating] : "";
        base["SR2评级"] = r.sr2_rating ? SCALE[r.sr2_rating] : "";
        base["归因维度"] = iss.map(x => x === "no_issue" ? "无明显问题" : (DIMS.find(d => d.id === x) || {}).name).filter(Boolean).join("、");
        base["无明显问题"] = iss.includes("no_issue") ? "是" : "";
        base["优化策略"] = (r.strategy_selection || []).map(id => (STRATEGIES.find(st => st.id === id) || {}).name).filter(Boolean).join("、");
        base["实施举措"] = (r.measure_selection || []).map(id => (MEASURES.find(m => m.id === id) || {}).name).filter(Boolean).join("、");
      }
      base["提交时间"] = r.timestamp || "";
      return base;
    });
  }

  // Sheet2:问题明细(每条问题一行,tidy 长表,自动化提取友好;问题数量可变,逐条独立成行)
  function problemRecords() {
    const out = [];
    S.images.forEach((im, idx) => {
      const r = S.ratings[im.name] || {};
      const ctx = {
        "评价者编号": S.evaluatorId,
        "图像序号": idx + 1,
        "图像文件名": im.name,
        "街景点位pid": pidOf(im.name),
        "安全性评级": r.level_rating ? SCALE[r.level_rating] : "",
      };
      let seq = 0;
      if (S.mode === "external") {
        if (r.no_issue) return; // 无明显问题:不产生问题行(状态已在总表)
        (r.attributions || []).forEach(a => {
          if (!(a.type || "").trim()) return; // 跳过空条目,适配可变数量
          out.push({ ...ctx, "问题序号": ++seq, "问题类型": a.type, "解释说明": a.analysis || "" });
        });
      } else {
        (r.issue_selection || []).filter(x => x !== "no_issue").forEach(id => {
          out.push({ ...ctx, "问题序号": ++seq, "问题类型": (DIMS.find(d => d.id === id) || {}).name || id, "解释说明": "" });
        });
      }
    });
    return out;
  }

  function chainRecords() {
    const out = [];
    if (S.mode !== "external") return out;
    S.images.forEach((im, idx) => {
      const r = S.ratings[im.name] || {};
      if (r.no_issue) return;
      const ctx = { "评价者编号": S.evaluatorId, "图像序号": idx + 1, "图像文件名": im.name, "街景点位pid": pidOf(im.name), "安全性评级": r.level_rating ? SCALE[r.level_rating] : "" };
      let pseq = 0;
      (r.attributions || []).forEach(a => {
        if (!(a.type || "").trim()) return;
        pseq++;
        let sseq = 0;
        const sts = a.strategies || [];
        if (!sts.length) return;
        sts.forEach(st => {
          sseq++;
          const ms = st.measures || [];
          if (!ms.length) {
            out.push({ ...ctx, "问题序号": pseq, "问题类型": a.type, "策略序号": sseq, "优化方向": st.direction || "", "策略理由": st.reason || "", "举措序号": "", "实施举措": "", "实施可行性": "", "具体位置": "", "结合空间对象": "" });
          } else {
            let mseq = 0;
            ms.forEach(m => { mseq++; out.push({ ...ctx, "问题序号": pseq, "问题类型": a.type, "策略序号": sseq, "优化方向": st.direction || "", "策略理由": st.reason || "", "举措序号": mseq, "实施举措": m.action || "", "实施说明": m.detail || "" }); });
          }
        });
      });
    });
    return out;
  }
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryRecords());
    XLSX.utils.book_append_sheet(wb, ws1, "评分总表");
    const probs = problemRecords();
    const ws2 = probs.length
      ? XLSX.utils.json_to_sheet(probs)
      : XLSX.utils.aoa_to_sheet([["评价者编号", "图像序号", "图像文件名", "街景点位pid", "安全性评级", "问题序号", "问题类型", "解释说明"]]);
    XLSX.utils.book_append_sheet(wb, ws2, "问题明细");
    if (S.mode === "external") {
      const chain = chainRecords();
      const ws3 = chain.length
        ? XLSX.utils.json_to_sheet(chain)
        : XLSX.utils.aoa_to_sheet([["评价者编号","图像序号","图像文件名","街景点位pid","安全性评级","问题序号","问题类型","策略序号","优化方向","策略理由","举措序号","实施举措","实施说明"]]);
      XLSX.utils.book_append_sheet(wb, ws3, "策略举措明细");
    }
    XLSX.writeFile(wb, `安全性评价_评价者${String(S.evaluatorId).padStart(2, "0")}.xlsx`);
    toast("Excel 已导出(评分总表 + 问题明细)");
  }
  function exportJSON() {
    const data = {
      evaluator_id: S.evaluatorId,
      mode: S.mode,
      exported_at: new Date().toISOString(),
      images: S.images.map((im, idx) => {
        const r = S.ratings[im.name] || {};
        const img = {
          image_index: idx + 1,
          image_name: im.name,
          pid: pidOf(im.name),
          level_rating_value: r.level_rating ? Number(r.level_rating) : null,
          level_rating: r.level_rating ? SCALE[r.level_rating] : null,
          completed: isComplete(r),
        };
        if (S.mode === "external") {
          img.no_issue = !!r.no_issue;
          img.no_issue_explain = r.no_issue ? (r.no_issue_explain || "") : "";
          img.problems = r.no_issue ? [] : (r.attributions || [])
            .filter(a => (a.type || "").trim())
            .map((a, i) => ({ seq: i + 1, type: a.type, analysis: a.analysis || "" }));
        } else {
          img.sr1_rating_value = r.sr1_rating ? Number(r.sr1_rating) : null;
          img.sr1_rating = r.sr1_rating ? SCALE[r.sr1_rating] : null;
          img.sr2_rating_value = r.sr2_rating ? Number(r.sr2_rating) : null;
          img.sr2_rating = r.sr2_rating ? SCALE[r.sr2_rating] : null;
          img.issue_selection = (r.issue_selection || []).slice();
          img.issue_selection_names = (r.issue_selection || []).map(x => x === "no_issue" ? "无明显问题" : (DIMS.find(d => d.id === x) || {}).name);
        }
        img.timestamp = r.timestamp || "";
        return img;
      }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `安全性评价_评价者${String(S.evaluatorId).padStart(2, "0")}.json`; a.click();
    toast("JSON 已导出");
  }

  renderLanding();
})();
