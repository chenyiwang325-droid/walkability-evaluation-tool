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
  // 内部知识库(定义+SR1/SR2维度含义+评级标准,单一来源,不在他处重复)
  const KNOWLEDGE = `<p><strong>层级定义：</strong>${SAFETY_DEF}</p>
<p><strong>SR1 自然监视不足：</strong>${DIMS[0].desc}</p>
<p><strong>SR2 环境失序：</strong>${DIMS[1].desc}</p>
<p><strong>评级判断标准：</strong></p><ul style="margin:6px 0 0;padding-left:18px">${RATING_CRITERIA.map(r => `<li><strong>${r.v} ${r.label}：</strong>${r.c}</li>`).join("")}</ul>`;
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
      if (r.no_issue) return true;
      return (r.attributions || []).some(a => (a.name || "").trim());
    }
    return !!(r.sr1_rating && r.sr2_rating && r.issue_selection && r.issue_selection.length);
  }

  // ===== 落地页:编号输入(不暴露分组) =====
  function renderLanding(err) {
    app.innerHTML = `
      <div class="landing-wrap">
        <div class="landing-card">
          <div class="landing-icon"><i class="fas fa-shield-alt"></i></div>
          <h1 class="landing-title">街道安全性评价</h1>
          <p class="landing-sub">请输入分配给你的评价者编号,进入评价。</p>
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
  }

  function assignImages(all, slot) {
    const n = all.length, start = (PER_STUDENT * (slot - 1)) % n, out = [];
    for (let i = 0; i < PER_STUDENT; i++) out.push(all[(start + i) % n]);
    return out;
  }

  // ===== 评价页 =====
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
        <div class="rating-section">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-shield-alt"></i> 安全性</div></div>
          <div class="collapsible">
            <div class="collapsible-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="collapsible-title"><i class="fas fa-info-circle"></i><span>查看安全性定义</span></div>
              <i class="fas fa-chevron-down collapsible-arrow"></i>
            </div>
            <div class="collapsible-content"><div class="collapsible-inner">${SAFETY_DEF}</div></div>
          </div>
          <div class="rating-question">该街道断面安全性的总体评价应为？</div>
          <div class="scale-buttons">${scaleBtns(r.level_rating, "level")}</div>
        </div>`;
      // 外部:问题归因多填(无提示)
      const attrs = r.attributions || (r.attributions = []);
      if (!attrs.length) attrs.push({ name: "", analysis: "" });
      const dis = r.no_issue ? "disabled" : "";
      const disCls = r.no_issue ? "disabled" : "";
      html += `
        <div class="rating-section">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-tag"></i> 问题归因</div></div>
          <div class="section-hint">若存在明确问题,请逐个填写问题名称及分析理由(可填多个,每个问题都需写出对应分析);若仅有轻微问题或无明显问题,请勾选下方选项(勾选后上方填写区将锁定不可填写,二者互斥)。</div>
          <div id="attrList" class="${disCls}">${attrs.map((a, i) => attrEntry(i, a, dis)).join("")}</div>
          <button class="add-attr-btn" id="addAttrBtn" ${dis}><i class="fas fa-plus"></i> 添加一个问题</button>
          <div class="noissue-row">
            <div class="noissue-opt ${r.no_issue ? "on" : ""}" data-ni="1"><i class="fas fa-check-circle"></i> 存在轻微问题或无明显问题</div>
          </div>
        </div>`;
    } else {
      // 内部:知识库(定义+SR1/SR2维度含义+评级标准,单一来源,不重复)
      html += `
        <div class="rating-section">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-book"></i> 知识库</div></div>
          <div class="collapsible">
            <div class="collapsible-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="collapsible-title"><i class="fas fa-info-circle"></i><span>安全性评价标准（定义·维度含义·评级）</span></div>
              <i class="fas fa-chevron-down collapsible-arrow"></i>
            </div>
            <div class="collapsible-content"><div class="collapsible-inner" style="line-height:1.7">${KNOWLEDGE}</div></div>
          </div>
        </div>`;
      // 内部:要素识别结果(模型)
      html += refSection(S.referenceData[img.name] || {});
      // 内部:分维度评价(SR1/SR2 仅评级,描述见知识库,不重复)
      html += `
        <div class="rating-section">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-th-list"></i> 分维度评价</div></div>
          ${DIMS.map(d => {
            const f = "sr" + d.id.replace("SR", "");
            return `<div class="rating-card ${r[f + "_rating"] ? "completed" : ""}">
              <div class="rating-question">${d.id} ${d.name} 的评价应为？</div>
              <div class="scale-buttons">${scaleBtns(r[f + "_rating"], f)}</div>
            </div>`;
          }).join("")}
        </div>`;
      // 内部:总体评级
      html += `
        <div class="rating-section">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-layer-group"></i> 总体评价</div></div>
          <div class="rating-question">该街道断面安全性的总体评价应为？</div>
          <div class="scale-buttons">${scaleBtns(r.level_rating, "level")}</div>
        </div>`;
      // 内部:问题归因复选
      html += `
        <div class="rating-section">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-tags"></i> 问题归因(可多选)</div></div>
          <div class="checkbox-tags">
            ${DIMS.map(d => `<label class="checkbox-tag ${r.issue_selection && r.issue_selection.includes(d.id) ? "checked" : ""}" data-id="${d.id}"><i class="fas fa-check"></i> ${d.id} ${d.name}</label>`).join("")}
            <label class="checkbox-tag ${r.issue_selection && r.issue_selection.includes("no_issue") ? "checked" : ""}" data-id="no_issue"><i class="fas fa-check"></i> 无明显问题或影响轻微</label>
          </div>
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
    return `<div class="attr-entry" data-i="${i}">
      <div class="attr-entry-head"><span class="lbl">问题 ${i + 1}</span><button class="attr-del" data-del="${i}" ${dis} title="删除"><i class="fas fa-times"></i></button></div>
      <input class="text-input attr-name" data-i="${i}" maxlength="10" placeholder="问题名称(≤10字)" value="${esc(a.name || "")}" ${dis} />
      <div class="attr-meta"><span>请用你自己的话概括问题</span><span class="attr-cnt">${(a.name || "").length}/10</span></div>
      <textarea class="text-area attr-analysis" data-i="${i}" placeholder="分析理由(说明判断依据)" ${dis}>${esc(a.analysis || "")}</textarea>
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
    return `<div class="rating-section">
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
      r.attributions = r.attributions || [{ name: "", analysis: "" }];
      if (!r.attributions.length) r.attributions.push({ name: "", analysis: "" });

      const bindAttrInputs = () => {
        app.querySelectorAll(".attr-name").forEach(inp => {
          inp.addEventListener("input", () => {
            const i = +inp.dataset.i;
            r.attributions[i].name = inp.value;
            const cnt = inp.parentElement.querySelector(".attr-cnt");
            if (cnt) { cnt.textContent = inp.value.length + "/10"; cnt.style.color = inp.value.length >= 10 ? "var(--warning)" : ""; }
            saveStore(); updateProgressUI();
          });
        });
        app.querySelectorAll(".attr-analysis").forEach(ta => {
          ta.addEventListener("input", () => { r.attributions[+ta.dataset.i].analysis = ta.value; r.timestamp = new Date().toISOString(); saveStore(); });
        });
        app.querySelectorAll(".attr-del").forEach(b => {
          b.addEventListener("click", () => {
            const i = +b.dataset.del;
            if (r.attributions.length <= 1) r.attributions[0] = { name: "", analysis: "" };
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
        r.attributions.push({ name: "", analysis: "" });
        saveStore(); renderAttrList(); updateProgressUI();
      });
      bindAttrInputs();

      // 轻微/无明显:就地切换+锁定归因(只重渲染归因列表,不动整体面板)
      app.querySelectorAll(".noissue-opt").forEach(o => {
        o.addEventListener("click", () => {
          r.no_issue = !r.no_issue;
          if (r.no_issue) r.attributions = [{ name: "", analysis: "" }];
          r.timestamp = new Date().toISOString();
          saveStore();
          o.classList.toggle("on", r.no_issue);
          renderAttrList();
          updateProgressUI();
        });
      });
    } else {
      // 内部归因复选:就地切换
      app.querySelectorAll(".checkbox-tag").forEach(t => {
        t.addEventListener("click", () => {
          const r = rec(), id = t.dataset.id;
          r.issue_selection = r.issue_selection || [];
          if (id === "no_issue") {
            if (r.issue_selection.includes("no_issue")) r.issue_selection = r.issue_selection.filter(x => x !== "no_issue");
            else r.issue_selection = ["no_issue"];
          } else {
            r.issue_selection = r.issue_selection.filter(x => x !== "no_issue");
            if (r.issue_selection.includes(id)) r.issue_selection = r.issue_selection.filter(x => x !== id);
            else r.issue_selection.push(id);
          }
          r.timestamp = new Date().toISOString();
          saveStore();
          app.querySelectorAll(".checkbox-tag").forEach(tag => tag.classList.toggle("checked", r.issue_selection.includes(tag.dataset.id)));
          updateProgressUI();
        });
      });
    }
  }

  function nav(dir) {
    const ni = S.currentIndex + dir;
    if (ni < 0 || ni >= S.images.length) return;
    S.currentIndex = ni; renderEval();
  }

  // ===== 导出 =====
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
      <div class="ex-hint">确认导出?文件将以你的编号命名(安全性评价_评价者${idStr}),包含本次全部 ${total} 张图像的评价结果。</div>
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

  function records() {
    return S.images.map(im => {
      const r = S.ratings[im.name] || {};
      const base = { evaluator_id: S.evaluatorId, image_name: im.name, pid: pidOf(im.name), level_rating: r.level_rating ? SCALE[r.level_rating] : "", timestamp: r.timestamp || "" };
      if (S.mode === "external") {
        const attrs = (r.attributions || []).filter(a => (a.name || "").trim());
        base.problem_attributions = attrs.map(a => `${a.name}｜${a.analysis}`).join(" ; ");
        base.no_issue = r.no_issue ? "存在轻微问题或无明显问题" : "";
      } else {
        base.sr1_rating = r.sr1_rating ? SCALE[r.sr1_rating] : "";
        base.sr2_rating = r.sr2_rating ? SCALE[r.sr2_rating] : "";
        base.issue_selection = (r.issue_selection || []).map(x => x === "no_issue" ? "无明显问题或影响轻微" : (DIMS.find(d => d.id === x) || {}).name).join(" / ");
      }
      return base;
    });
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(records());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "评价结果");
    XLSX.writeFile(wb, `安全性评价_评价者${String(S.evaluatorId).padStart(2, "0")}.xlsx`);
    toast("Excel 已导出");
  }
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ evaluator_id: S.evaluatorId, ratings: records() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `安全性评价_评价者${String(S.evaluatorId).padStart(2, "0")}.json`; a.click();
    toast("JSON 已导出");
  }

  renderLanding();
})();
