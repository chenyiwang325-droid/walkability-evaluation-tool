/**
 * 街道安全性专家评价 · /eval/ 主逻辑
 * 单链接、ID 驱动。编号决定评价页面与分配图像(对评价者不暴露分组标签)。
 * 纯前端,localStorage 存储,SheetJS 导出。复用原工具样式结构。
 */
(function () {
  "use strict";

  // ===== 配置(安全性定义 + 维度,仅内部模式显示维度) =====
  const SAFETY_DEF = "安全性代表街道空间对人身体伤害、心理压力和其他潜在威胁的感知,主要关注步行道本身及其社会空间的安全性,不包括交通安全。";
  const DIMS = [
    { id: "SR1", name: "自然监视不足", desc: "街道环境在“安全关联的空间支撑”层面存在不足:因空间设计(高绿化遮挡、封闭界面、低底层透明度)或设施配置(照明不足)导致视觉通透度差,周边人员难以形成自然监视;且周边土地使用偏向低活动强度、低开放性类型(无商铺、缺少公共开放空间),日常人员活动频次低,削弱步行者安全感。" },
    { id: "SR2", name: "环境失序", desc: "街道步行环境中物理环境的紊乱和不规范状态:破败待修缮建筑、增加杂乱度的街道要素、设施损坏;废弃空间、较多垃圾、人为损坏;占用人行通道的施工缺乏完善防护等。让步行者感知空间恶化与社会秩序失序,加重对犯罪威胁的担忧。" },
  ];
  const SCALE = { 1: "很差", 2: "较差", 3: "一般", 4: "较好", 5: "很好" };
  const KNOWLEDGE = `<p><strong>层级定义:</strong>${SAFETY_DEF}</p>
<p><strong>SR1 自然监视不足:</strong>${DIMS[0].desc}</p>
<p><strong>SR2 环境失序:</strong>${DIMS[1].desc}</p>
<p><strong>评级量表:</strong>1 很差(严重问题,重大负面影响)/ 2 较差(明显问题,较大负面影响)/ 3 一般(中性)/ 4 较好(一定正面影响)/ 5 很好(显著正面影响)。</p>`;
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
  function renderEval() {
    const cur = S.images[S.currentIndex];
    const done = S.images.filter(im => S.ratings[im.name] && S.ratings[im.name].level_rating).length;
    const pct = Math.round(done / S.images.length * 100);
    const idStr = String(S.evaluatorId).padStart(2, "0");
    app.innerHTML = `
      <div class="app-container">
        <header class="eval-header">
          <div class="eval-header-inner">
            <div class="eval-header-title"><i class="fas fa-shield-alt"></i><h1>街道安全性评价</h1></div>
            <span class="eval-id-chip">评价者 ${idStr}</span>
            <div class="eval-spacer"></div>
            <div class="eval-progress">
              <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
              <span class="txt">${done}/${S.images.length}</span>
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
  }

  // ===== 评分面板 =====
  function renderPanel(img) {
    const r = S.ratings[img.name] || {};
    // 公共:安全性定义 + 总体评级
    let html = `
      <div class="rating-panel">
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

    if (S.mode === "external") {
      // 多填归因(无提示)
      const attrs = r.attributions || (r.attributions = []);
      if (!attrs.length) attrs.push({ name: "", analysis: "" });
      html += `
        <div class="rating-section">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-tag"></i> 问题归因</div></div>
          <div class="section-hint">若存在明确问题,请逐个填写问题名称及分析理由(可填多个,每个问题都需写出对应分析);若仅有轻微问题或无明显问题,请在下方选择。</div>
          <div id="attrList">${attrs.map((a, i) => attrEntry(i, a)).join("")}</div>
          <button class="add-attr-btn" id="addAttrBtn"><i class="fas fa-plus"></i> 添加一个问题</button>
          <div class="noissue-row">
            <div class="noissue-opt ${r.no_issue === "minor" ? "on" : ""}" data-ni="minor"><i class="fas fa-exclamation-circle"></i> 存在轻微问题</div>
            <div class="noissue-opt ${r.no_issue === "none" ? "on" : ""}" data-ni="none"><i class="fas fa-check-circle"></i> 无明显问题</div>
          </div>
        </div>`;
    } else {
      // 内部:要素识别 + 知识库 + 分维度评级 + 归因复选
      const ref = S.referenceData[img.name] || {};
      html += refSection(ref);
      html += `
        <div class="rating-section">
          <div class="collapsible expanded">
            <div class="collapsible-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="collapsible-title"><i class="fas fa-book"></i><span>知识库 · 安全性评价标准</span></div>
              <i class="fas fa-chevron-down collapsible-arrow"></i>
            </div>
            <div class="collapsible-content"><div class="collapsible-inner" style="line-height:1.7">${KNOWLEDGE}</div></div>
          </div>
        </div>
        <div class="rating-section">
          <div class="rating-section-header"><div class="rating-section-title"><i class="fas fa-th-list"></i> 分维度评价</div></div>
          ${DIMS.map(d => `
            <div class="rating-card ${r["sr" + d.id.replace("SR", "") + "_rating"] ? "completed" : ""}">
              <div class="collapsible">
                <div class="collapsible-header" onclick="this.parentElement.classList.toggle('expanded')">
                  <div class="collapsible-title"><i class="fas fa-info-circle"></i><span>${d.name}说明</span></div>
                  <i class="fas fa-chevron-down collapsible-arrow"></i>
                </div>
                <div class="collapsible-content"><div class="collapsible-inner">${d.desc}</div></div>
              </div>
              <div class="rating-question">${d.name}的评价应为？</div>
              <div class="scale-buttons">${scaleBtns(r["sr" + d.id.replace("SR", "") + "_rating"], "sr" + d.id.replace("SR", ""))}</div>
            </div>`).join("")}
        </div>
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

  function attrEntry(i, a) {
    return `<div class="attr-entry" data-i="${i}">
      <div class="attr-entry-head"><span class="lbl">问题 ${i + 1}</span><button class="attr-del" data-del="${i}" title="删除"><i class="fas fa-times"></i></button></div>
      <input class="text-input attr-name" data-i="${i}" maxlength="10" placeholder="问题名称(≤10字)" value="${esc(a.name || "")}" />
      <div class="attr-meta"><span>请用你自己的话概括问题</span><span class="attr-cnt">${(a.name || "").length}/10</span></div>
      <textarea class="text-area attr-analysis" data-i="${i}" placeholder="分析理由(说明判断依据)">${esc(a.analysis || "")}</textarea>
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

  // ===== 绑定交互 =====
  function bindPanel(img) {
    const rec = () => S.ratings[img.name] || (S.ratings[img.name] = { evaluator_id: S.evaluatorId, image_name: img.name, pid: pidOf(img.name) });

    // 评级按钮
    app.querySelectorAll(".scale-btn").forEach(b => {
      b.addEventListener("click", () => {
        const f = b.dataset.field, v = b.dataset.value;
        rec()[f === "level" ? "level_rating" : f + "_rating"] = v;
        rec().timestamp = new Date().toISOString();
        saveStore(); renderEval();
      });
    });

    if (S.mode === "external") {
      const r = rec();
      r.attributions = r.attributions || [{ name: "", analysis: "" }];
      if (!r.attributions.length) r.attributions.push({ name: "", analysis: "" });

      const addBtn = document.getElementById("addAttrBtn");
      if (addBtn) addBtn.addEventListener("click", () => {
        if (r.no_issue) { r.no_issue = ""; }  // 添加问题则清除无问题选项
        r.attributions.push({ name: "", analysis: "" });
        saveStore(); renderEval();
      });

      // 名称/分析输入(失焦保存,输入实时更新计数)
      app.querySelectorAll(".attr-name").forEach(inp => {
        inp.addEventListener("input", () => {
          const i = +inp.dataset.i;
          r.attributions[i].name = inp.value;
          const cnt = inp.parentElement.querySelector(".attr-cnt");
          if (cnt) { cnt.textContent = inp.value.length + "/10"; cnt.style.color = inp.value.length >= 10 ? "var(--warning)" : ""; }
          if (inp.value.trim()) r.no_issue = "";  // 填了问题则清除无问题
          saveStore();
        });
      });
      app.querySelectorAll(".attr-analysis").forEach(ta => {
        ta.addEventListener("input", () => { r.attributions[+ta.dataset.i].analysis = ta.value; r.timestamp = new Date().toISOString(); saveStore(); });
      });
      app.querySelectorAll(".attr-del").forEach(b => {
        b.addEventListener("click", () => {
          const i = +b.dataset.del;
          if (r.attributions.length <= 1) { r.attributions[0] = { name: "", analysis: "" }; }
          else r.attributions.splice(i, 1);
          saveStore(); renderEval();
        });
      });
      // 轻微/无明显(互斥:选则清空归因)
      app.querySelectorAll(".noissue-opt").forEach(o => {
        o.addEventListener("click", () => {
          const cur = r.no_issue;
          r.no_issue = (cur === o.dataset.ni) ? "" : o.dataset.ni;
          if (r.no_issue) r.attributions = [{ name: "", analysis: "" }];
          r.timestamp = new Date().toISOString();
          saveStore(); renderEval();
        });
      });
    } else {
      // 内部归因复选
      app.querySelectorAll(".checkbox-tag").forEach(t => {
        t.addEventListener("click", () => {
          const r = rec(), id = t.dataset.id;
          r.issue_selection = r.issue_selection || [];
          if (id === "no_issue") {
            // 选无问题则清其他
            if (r.issue_selection.includes("no_issue")) r.issue_selection = r.issue_selection.filter(x => x !== "no_issue");
            else r.issue_selection = ["no_issue"];
          } else {
            r.issue_selection = r.issue_selection.filter(x => x !== "no_issue");
            if (r.issue_selection.includes(id)) r.issue_selection = r.issue_selection.filter(x => x !== id);
            else r.issue_selection.push(id);
          }
          r.timestamp = new Date().toISOString();
          saveStore(); renderEval();
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
    const done = S.images.filter(im => S.ratings[im.name] && S.ratings[im.name].level_rating).length;
    const ov = document.createElement("div");
    ov.className = "export-modal-overlay";
    ov.innerHTML = `<div class="export-modal">
      <h3>导出评价结果</h3>
      <div class="sub">评价者 ${String(S.evaluatorId).padStart(2, "0")} · 已评 ${done}/${S.images.length} 张</div>
      <div class="export-opt" data-f="excel"><i class="fas fa-file-excel"></i> Excel(.xlsx)</div>
      <div class="export-opt" data-f="json"><i class="fas fa-file-code"></i> JSON</div>
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
        base.no_issue = r.no_issue === "minor" ? "存在轻微问题" : r.no_issue === "none" ? "无明显问题" : "";
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
