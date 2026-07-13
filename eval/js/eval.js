/**
 * 街道安全性专家评价 · /eval/ 主逻辑
 * 单链接、ID 驱动:编号 1-13 外部盲评(现有52),14-26 内部扩展(新52)。
 * 纯前端,localStorage 存储,SheetJS 导出。
 */
(function () {
  "use strict";

  // ===== 配置 =====
  const SAFETY_DEF = "安全性代表街道空间对人身体伤害、心理压力和其他潜在威胁的感知,主要关注步行道本身及其社会空间的安全性,不包括交通安全。";
  const DIMS = [
    { id: "SR1", name: "自然监视不足", desc: "街道环境在“安全关联的空间支撑”层面存在不足:因空间设计(高绿化遮挡、封闭界面、低底层透明度)或设施配置(照明不足)导致视觉通透度差,周边人员难以形成自然监视;且周边土地使用偏向低活动强度、低开放性类型(无商铺、缺少公共开放空间),日常人员活动频次低,削弱步行者安全感。" },
    { id: "SR2", name: "环境失序", desc: "街道步行环境中物理环境的紊乱和不规范状态:破败待修缮建筑、增加杂乱度的街道要素、设施损坏;废弃空间、较多垃圾、人为损坏;占用人行通道的施工缺乏完善防护等。让步行者感知空间恶化与社会秩序失序,加重对犯罪威胁的担忧。" },
  ];
  const SCALE = [
    { v: 1, label: "很差" },
    { v: 2, label: "较差" },
    { v: 3, label: "一般" },
    { v: 4, label: "较好" },
    { v: 5, label: "很好" },
  ];
  // 安全性知识库(内部模式显示)
  const KNOWLEDGE = `<p><strong>层级定义:</strong>${SAFETY_DEF}</p>
<p><strong>SR1 自然监视不足:</strong>${DIMS[0].desc}</p>
<p><strong>SR2 环境失序:</strong>${DIMS[1].desc}</p>
<p><strong>评级量表:</strong>1 很差(严重问题,重大负面影响) / 2 较差(明显问题,较大负面影响) / 3 一般(中性) / 4 较好(一定正面影响) / 5 很好(显著正面影响)。</p>`;

  const PER_STUDENT = 20;

  // ===== 状态 =====
  const S = {
    evaluatorId: null,
    mode: null,          // 'external' | 'internal'
    images: [],          // 分配的20张
    currentIndex: 0,
    ratings: {},         // imageName -> record
    referenceData: {},   // imageName -> ref(内部)
    manifest: null,
  };

  const app = document.getElementById("app");

  // ===== 工具 =====
  function lsKey(mode, id) { return `safety_eval_${mode}_${id}`; }
  function loadStore(mode, id) {
    try { return JSON.parse(localStorage.getItem(lsKey(mode, id)) || "null"); } catch (e) { return null; }
  }
  function saveStore() {
    localStorage.setItem(lsKey(S.mode, S.evaluatorId),
      JSON.stringify({ evaluatorId: S.evaluatorId, mode: S.mode, ratings: S.ratings }));
  }
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800);
  }
  function pidOf(name) { return (name || "").replace(/_front_view\.\w+$/, ""); }

  // ===== 落地页:编号输入 =====
  function renderLanding(err) {
    app.innerHTML = `
      <div class="landing">
        <div class="landing-card">
          <div class="landing-eyebrow">EXPERT SAFETY AUDIT</div>
          <h1 class="landing-title">街道安全性专家评价</h1>
          <p class="landing-sub">输入你的评价者编号进入测评。编号决定你看到的评价页面与分配的街景图像。</p>
          <div class="id-input-wrap">
            <i class="fas fa-hashtag id-input-icon"></i>
            <input id="idInput" class="id-input" inputmode="numeric" placeholder="如 03" autocomplete="off" />
          </div>
          <div class="id-hint ${err ? "id-error" : ""}">${err || "编号范围 1–26。1–13 为外部盲评,14–26 为内部扩展。"}</div>
          <button class="btn-primary" id="enterBtn">进入评价 <i class="fas fa-arrow-right" style="margin-left:.4rem"></i></button>
          <div class="mode-badges">
            <div class="mode-badge"><b>1 – 13</b>外部盲评</div>
            <div class="mode-badge"><b>14 – 26</b>内部扩展</div>
          </div>
        </div>
      </div>`;
    const inp = document.getElementById("idInput");
    inp.focus();
    const go = () => {
      const v = parseInt(inp.value.trim(), 10);
      if (!v || v < 1 || v > 26) { renderLanding("请输入 1–26 之间的编号。"); return; }
      enterEval(v);
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    document.getElementById("enterBtn").addEventListener("click", go);
  }

  // ===== 进入评价 =====
  async function enterEval(id) {
    S.evaluatorId = id;
    S.mode = id <= 13 ? "external" : "internal";
    const manifestFile = S.mode === "external" ? "images/manifest-existing.json" : "images/manifest-new.json";
    try {
      const resp = await fetch(manifestFile);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      S.manifest = await resp.json();
    } catch (e) {
      renderLanding("图像清单加载失败,请刷新重试。");
      return;
    }
    const allImgs = (S.manifest.safety && S.manifest.safety.images) || [];
    if (!allImgs.length) { renderLanding("未找到评价图像。"); return; }

    // 分配:外部用 id(1-13),内部用 id-13(1-13)
    const slot = S.mode === "external" ? id : id - 13;
    S.images = assignImages(allImgs, slot);

    // 内部:加载参考数据
    if (S.mode === "internal" && S.manifest.safety.hasReference) {
      try {
        const r = await fetch(S.manifest.safety.referenceUrl);
        const arr = await r.json();
        const list = Array.isArray(arr) ? arr : (arr.data || []);
        list.forEach(it => { if (it.image_name) S.referenceData[it.image_name] = it; });
      } catch (e) { console.warn("参考数据加载失败", e); }
    }

    // 恢复已存评分
    const store = loadStore(S.mode, S.evaluatorId);
    S.ratings = (store && store.ratings) || {};
    S.currentIndex = 0;
    renderEval();
  }

  // shift-20 循环分配:学生 k(1-based) 拿 [20*(k-1) mod 52, +19] 共20张
  function assignImages(all, slot) {
    const n = all.length;
    const start = (PER_STUDENT * (slot - 1)) % n;
    const out = [];
    for (let i = 0; i < PER_STUDENT; i++) out.push(all[(start + i) % n]);
    return out;
  }

  // ===== 评价页 =====
  function renderEval() {
    const cur = S.images[S.currentIndex];
    const done = S.images.filter(im => S.ratings[im.name] && S.ratings[im.name].level_rating).length;
    const tagName = S.mode === "external" ? "外部盲评" : "内部扩展";
    const tagCls = S.mode === "external" ? "tag-external" : "tag-internal";
    const idStr = String(S.evaluatorId).padStart(2, "0");

    app.innerHTML = `
      <div class="eval-shell">
        <div class="eval-topbar">
          <div class="topbar-title">街道安全性评价</div>
          <span class="eval-tag ${tagCls}"><i class="fas fa-${S.mode === 'external' ? 'eye-slash' : 'layer-group'}"></i>${tagName}</span>
          <span class="eval-id-stamp">评价者 ${idStr}</span>
          <div class="topbar-spacer"></div>
          <div class="progress-track">${progressSegs(done)}</div>
          <div class="progress-count">${done}/${S.images.length}</div>
          <button class="btn-ghost" id="exportBtn"><i class="fas fa-download"></i>导出</button>
          <button class="btn-ghost" id="exitBtn" title="退出"><i class="fas fa-sign-out-alt"></i></button>
        </div>
        <div class="eval-body">
          <div class="image-pane">
            <img id="evalImg" src="${cur.url}" alt="${cur.name}" />
            <div class="image-meta">pid ${pidOf(cur.name)} · ${S.currentIndex + 1}/${S.images.length}</div>
          </div>
          <div class="panel-pane" id="panelPane">${renderPanel(cur)}</div>
        </div>
        <div class="eval-footbar">
          <button class="btn-nav" id="prevBtn" ${S.currentIndex === 0 ? "disabled" : ""}><i class="fas fa-chevron-left"></i> 上一张</button>
          <span class="foot-count">${S.currentIndex + 1} / ${S.images.length}</span>
          <div class="foot-spacer"></div>
          <button class="btn-nav primary" id="nextBtn">${S.currentIndex === S.images.length - 1 ? "完成并导出" : "下一张"} <i class="fas fa-chevron-right"></i></button>
        </div>
      </div>`;

    bindPanel(cur);
    document.getElementById("exportBtn").addEventListener("click", () => openExport());
    document.getElementById("exitBtn").addEventListener("click", () => { if (confirm("退出将返回编号输入页(已评分已保存)。确定?")) { S.evaluatorId = null; S.mode = null; renderLanding(); } });
    document.getElementById("prevBtn").addEventListener("click", () => nav(-1));
    document.getElementById("nextBtn").addEventListener("click", () => {
      if (S.currentIndex === S.images.length - 1) openExport();
      else nav(1);
    });
    document.addEventListener("keydown", onKey);
  }

  function progressSegs(done) {
    return S.images.map((_, i) => {
      const rated = S.ratings[S.images[i].name] && S.ratings[S.images[i].name].level_rating;
      let cls = "";
      if (rated) cls = "done";
      else if (i === S.currentIndex) cls = "current";
      return `<div class="seg ${cls}"></div>`;
    }).join("");
  }

  // ===== 评分面板 =====
  function renderPanel(img) {
    const r = S.ratings[img.name] || {};
    const head = `
      <div class="panel-section">
        <div class="section-eyebrow">SAFETY · 安全性</div>
        <div class="definition-card"><span class="serif">安全性</span> ${SAFETY_DEF}</div>
      </div>`;
    let body = "";
    if (S.mode === "external") {
      body = `
        <div class="panel-section">
          <div class="section-title">总体评级</div>
          <div class="rating-row">${scaleBtns(r.level_rating)}</div>
        </div>
        <div class="panel-section">
          <div class="section-title">问题归因</div>
          <div style="font-size:.8rem;color:var(--muted);margin-bottom:.5rem">若存在明确问题,填写归因名称与分析理由;否则勾选下方选项。</div>
          <label style="font-size:.82rem;color:var(--ink);display:block;margin-bottom:.3rem">归因名称(≤10字)</label>
          <input id="attrName" class="text-input" maxlength="10" placeholder="如 自然监视不足" value="${esc(r.attribution_name || "")}" />
          <div class="input-meta"><span>简明命名问题</span><span id="attrCnt">${(r.attribution_name || "").length}/10</span></div>
          <label style="font-size:.82rem;color:var(--ink);display:block;margin:.7rem 0 .3rem">分析理由</label>
          <textarea id="attrReason" class="text-area" placeholder="说明判断依据..."></textarea>
          <div class="check-tags" style="margin-top:.7rem">
            <label class="check-tag ${r.no_issue ? "on" : ""}"><input type="checkbox" id="noIssue" ${r.no_issue ? "checked" : ""}/>存在轻微问题或无明显问题</label>
          </div>
        </div>`;
    } else {
      const ref = S.referenceData[img.name] || {};
      body = `
        ${refBlock(ref)}
        <div class="panel-section">
          <div class="ref-panel collapsed" id="kgPanel">
            <div class="ref-head" onclick="document.getElementById('kgPanel').classList.toggle('collapsed')">
              <span><i class="fas fa-book" style="color:var(--accent);margin-right:.4rem"></i>知识库 · 安全性评价标准</span><i class="fas fa-chevron-down"></i>
            </div>
            <div class="ref-body kg-body">${KNOWLEDGE}</div>
          </div>
        </div>
        <div class="panel-section">
          <div class="section-title">各维度评级</div>
          ${DIMS.map(d => `
            <div class="dim-card">
              <div class="dim-name">${d.id} · ${d.name}</div>
              <div class="dim-desc">${d.desc}</div>
              <div class="rating-row">${scaleBtns(r["sr" + d.id.replace("SR", "") + "_rating"], "dim" + d.id)}</div>
            </div>`).join("")}
        </div>
        <div class="panel-section">
          <div class="section-title">总体评级</div>
          <div class="rating-row">${scaleBtns(r.level_rating)}</div>
        </div>
        <div class="panel-section">
          <div class="section-title">问题归因(多选)</div>
          <div class="check-tags">
            ${DIMS.map(d => `<label class="check-tag ${r.issue_selection && r.issue_selection.includes(d.id) ? "on" : ""}"><input type="checkbox" class="issue-cb" data-id="${d.id}" ${r.issue_selection && r.issue_selection.includes(d.id) ? "checked" : ""}/>${d.id} ${d.name}</label>`).join("")}
            <label class="check-tag ${r.issue_selection && r.issue_selection.includes("no_issue") ? "on" : ""}"><input type="checkbox" class="issue-cb" data-id="no_issue" ${r.issue_selection && r.issue_selection.includes("no_issue") ? "checked" : ""}/>无明显问题或影响轻微</label>
          </div>
        </div>`;
    }
    return head + body;
  }

  function scaleBtns(sel, prefix) {
    sel = sel ? String(sel) : null;
    return SCALE.map(s => `<button class="rate-btn ${String(s.v) === sel ? "sel" : ""}" data-v="${s.v}" data-p="${prefix || "level"}"><span class="num">${s.v}</span>${s.label}</button>`).join("");
  }

  function refBlock(ref) {
    const er = ref.element_recognition || {};
    const dims = er["维度"] || [];
    if (!dims.length) return "";
    const inner = dims.map(d => {
      const els = d["空间要素"] || [];
      const rows = els.map(e => `<tr><td>${e["名称"] || ""}</td><td>${e["位置"] || "—"}</td><td>${(e["描述"] || "").startsWith("该要素在该街景中不存在") ? `<span class="ref-empty-cell">未识别到</span>` : esc(e["描述"] || "")}</td></tr>`).join("");
      return `<div class="ref-dim">${d["维度名称"]}</div><table class="ref-table"><thead><tr><th>要素</th><th>位置</th><th>描述</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join("");
    return `<div class="panel-section">
      <div class="ref-panel" id="refPanel">
        <div class="ref-head" onclick="document.getElementById('refPanel').classList.toggle('collapsed')">
          <span><i class="fas fa-vector-square" style="color:var(--accent);margin-right:.4rem"></i>要素识别结果(模型)</span><i class="fas fa-chevron-down"></i>
        </div>
        <div class="ref-body">${inner}</div>
      </div></div>`;
  }

  function esc(s) { return (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // ===== 绑定评分交互 =====
  function bindPanel(img) {
    const rec = () => S.ratings[img.name] || (S.ratings[img.name] = { evaluator_id: S.evaluatorId, mode: S.mode, image_name: img.name, pid: pidOf(img.name) });

    app.querySelectorAll(".rate-btn").forEach(b => {
      b.addEventListener("click", () => {
        const v = b.dataset.v, p = b.dataset.p;
        const r = rec();
        if (p === "level") r.level_rating = v;
        else r["sr" + p.replace("dimSR", "") + "_rating"] = v;
        r.timestamp = new Date().toISOString();
        saveStore();
        renderEval();
      });
    });

    if (S.mode === "external") {
      const nameInp = document.getElementById("attrName");
      const reasonInp = document.getElementById("attrReason");
      const noIssue = document.getElementById("noIssue");
      if (reasonInp) reasonInp.value = (S.ratings[img.name] || {}).attribution_reason || "";
      if (nameInp) nameInp.addEventListener("input", () => {
        rec().attribution_name = nameInp.value; rec().timestamp = new Date().toISOString();
        document.getElementById("attrCnt").textContent = nameInp.value.length + "/10";
        document.getElementById("attrCnt").className = nameInp.value.length >= 10 ? "char-warn" : "";
        saveStore();
      });
      if (reasonInp) reasonInp.addEventListener("input", () => {
        rec().attribution_reason = reasonInp.value; rec().timestamp = new Date().toISOString(); saveStore();
      });
      if (noIssue) noIssue.addEventListener("change", () => {
        rec().no_issue = noIssue.checked; rec().timestamp = new Date().toISOString();
        noIssue.closest(".check-tag").classList.toggle("on", noIssue.checked); saveStore();
      });
    } else {
      app.querySelectorAll(".issue-cb").forEach(cb => {
        cb.addEventListener("change", () => {
          const r = rec();
          r.issue_selection = r.issue_selection || [];
          if (cb.checked) { if (!r.issue_selection.includes(cb.dataset.id)) r.issue_selection.push(cb.dataset.id); }
          else r.issue_selection = r.issue_selection.filter(x => x !== cb.dataset.id);
          r.timestamp = new Date().toISOString();
          cb.closest(".check-tag").classList.toggle("on", cb.checked); saveStore();
        });
      });
    }
  }

  function nav(dir) {
    const ni = S.currentIndex + dir;
    if (ni < 0 || ni >= S.images.length) return;
    S.currentIndex = ni;
    renderEval();
  }

  function onKey(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft") nav(-1);
    if (e.key === "ArrowRight") nav(1);
  }

  // ===== 导出 =====
  function openExport() {
    const done = S.images.filter(im => S.ratings[im.name] && S.ratings[im.name].level_rating).length;
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = `<div class="modal">
      <h3>导出评价结果</h3>
      <div style="font-size:.85rem;color:var(--muted);margin-bottom:.9rem">评价者 ${String(S.evaluatorId).padStart(2,"0")} · ${S.mode === "external" ? "外部盲评" : "内部扩展"} · 已评 ${done}/${S.images.length} 张</div>
      <div class="export-opt" data-f="excel"><i class="fas fa-file-excel"></i>Excel(.xlsx)</div>
      <div class="export-opt" data-f="json"><i class="fas fa-file-code"></i>JSON</div>
      <button class="btn-ghost" style="width:100%;margin-top:.5rem;justify-content:center" data-f="cancel">取消</button>
    </div>`;
    app.appendChild(ov);
    ov.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => {
      const f = b.dataset.f;
      ov.remove();
      if (f === "excel") exportExcel();
      else if (f === "json") exportJSON();
    }));
  }

  function records() {
    return S.images.map(im => {
      const r = S.ratings[im.name] || {};
      const base = { evaluator_id: S.evaluatorId, mode: S.mode, image_name: im.name, pid: pidOf(im.name), level_rating: r.level_rating || "", timestamp: r.timestamp || "" };
      if (S.mode === "external") {
        base.attribution_name = r.attribution_name || "";
        base.attribution_reason = r.attribution_reason || "";
        base.no_issue = r.no_issue ? "是" : "";
      } else {
        base.sr1_rating = r.sr1_rating || "";
        base.sr2_rating = r.sr2_rating || "";
        base.issue_selection = (r.issue_selection || []).join("/");
      }
      return base;
    });
  }

  function exportExcel() {
    const rows = records();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "评价结果");
    XLSX.writeFile(wb, `安全性评价_评价者${String(S.evaluatorId).padStart(2,"0")}_${S.mode}.xlsx`);
    toast("Excel 已导出");
  }
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ evaluator_id: S.evaluatorId, mode: S.mode, ratings: records() }, null, 2)],
      { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `安全性评价_评价者${String(S.evaluatorId).padStart(2,"0")}_${S.mode}.json`;
    a.click();
    toast("JSON 已导出");
  }

  // ===== 启动 =====
  renderLanding();
})();
