(() => {
  const fmt = new Intl.NumberFormat("zh-CN");
  const n = v => fmt.format(v);
  const h = v => v.toFixed(2);
  const pct = (v, digits = 1) => v == null ? "—" : `${(100 * v).toFixed(digits)}%`;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const width = v => (100 * Math.max(0, Math.min(1, v ?? 0))).toFixed(4);
  const status = (d, key, grade) => d.stages[key][grade] ?? 0;
  const stageAvailable = (d, key) => status(d, key, "pass") + status(d, key, "fail");
  const linked = name => `#view=quality&ds=${encodeURIComponent(name)}`;
  const rename = { ego_10h_demo_20261030: "双目导出 10/30", vitra_ssv2: "VITRA-SSv2", Ditto_training: "Ditto", JD_10h: "JD 10h" };
  const fieldNames = { action: "动作", object: "物体", target: "目标", direction: "方向", order: "顺序", result: "结果" };
  const preferences = { query: "", sort: "name" };
  let dataRequest;
  let ticket = 0;

  function load() {
    if (!dataRequest) dataRequest = fetch("quality-10h.json").then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(data => {
      if (data.schema !== 1 || !Array.isArray(data.datasets)) throw new Error("数据格式不匹配");
      return data;
    }).catch(error => {
      dataRequest = undefined;
      throw error;
    });
    return dataRequest;
  }

  function stats(data) {
    const total = data.total;
    const cards = [
      ["数据集及版本", n(data.datasets.length)],
      ["评估片段", n(total.episodes)],
      ["采样时长", `${h(total.hours)} h`],
      ["原生保留时长", `${h(total.kept_hours)} h`],
    ];
    return `<div class="stats quality-summary">${cards.map(([label, value]) =>
      `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`).join("")}</div>`;
  }

  function chartName(d) {
    return `<a href="${linked(d.name)}" title="${esc(d.name)}">${esc(rename[d.name] || d.name)}</a>`;
  }

  function geometryChart(rows) {
    return `<section class="quality-panel"><h2>原生几何保留率</h2>
      <p class="muted quality-chart-note">主要批次，分母为适用原生几何的样本。</p>
      <div class="quality-legend"><span><i class="quality-episodes"></i>片段</span><span><i class="quality-hours"></i>时长</span></div>
      ${[...rows].sort((a,b) => b.hour_rate - a.hour_rate).map(d => `
        <div class="quality-chart-row">${chartName(d)}
          <div aria-hidden="true"><div class="quality-track"><i class="quality-episodes" style="width:${width(d.keep_rate)}%"></i></div>
          <div class="quality-track"><i class="quality-hours" style="width:${width(d.hour_rate)}%"></i></div></div>
          <output aria-label="片段和时长保留率">${pct(d.keep_rate)} / ${pct(d.hour_rate)}</output>
        </div>`).join("")}
    </section>`;
  }

  function semanticChart(rows) {
    return `<section class="quality-panel"><h2>X1 评级与覆盖</h2>
      <p class="muted quality-chart-note">各段按全部样本计算。右侧为有效票 / 样本。</p>
      <div class="quality-legend"><span><i class="quality-l1"></i>L1</span><span><i class="quality-l4"></i>L4</span><span><i class="quality-unknown"></i>缺项或跳过</span></div>
      ${rows.map(d => {
        const l1 = d.x1.l1 / d.episodes;
        const l4 = d.x1.l4 / d.episodes;
        return `<div class="quality-chart-row">${chartName(d)}
          <div class="quality-track stacked" role="img" aria-label="L1 ${pct(l1)}，L4 ${pct(l4)}，缺项或跳过 ${pct(1-l1-l4)}"
             title="L1 ${n(d.x1.l1)} · L4 ${n(d.x1.l4)} · 样本 ${n(d.episodes)}">
            <i class="quality-l1" style="width:${width(l1)}%"></i><i class="quality-l4" style="width:${width(l4)}%"></i>
            <i class="quality-unknown" style="width:${width(1-l1-l4)}%"></i></div>
          <output aria-label="X1 有效票与样本条数">${n(d.x1.rated)} / ${n(d.episodes)}</output></div>`;
      }).join("")}
    </section>`;
  }

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    hours: (a, b) => b.hours - a.hours,
    keep: (a, b) => (a.keep_rate ?? 2) - (b.keep_rate ?? 2),
    x1: (a, b) => (b.x1.rated ? b.x1.l4 / b.x1.rated : -1) - (a.x1.rated ? a.x1.l4 / a.x1.rated : -1),
    m3: (a, b) => (b.m3.fraction ?? -1) - (a.m3.fraction ?? -1),
  };

  function updateTable(root, rows, selected) {
    const query = preferences.query.trim().toLowerCase();
    const shown = rows.filter(d => [d.name, rename[d.name]].some(name => name?.toLowerCase().includes(query)))
      .sort(sorters[preferences.sort]);
    root.querySelector("#quality-table-count").textContent = `${shown.length} / ${rows.length} 套`;
    const tbody = root.querySelector("#quality-table-rows");
    tbody.innerHTML = shown.map(d => {
      const x3 = stageAvailable(d, "x3") ? n(status(d, "x3", "pass")) : "—";
      const x1 = d.x1.rated ? `${n(d.x1.l4)} / ${n(d.x1.rated)}` : "—";
      const keep = d.geometry_eligible ? `${n(d.kept)} / ${n(d.geometry_eligible)} · ${pct(d.keep_rate)}` : "—";
      return `<tr${selected.name === d.name ? ' class="selected"' : ""}>
        <th scope="row" class="rh"><a href="${linked(d.name)}"${selected.name === d.name ? ' aria-current="true"' : ""}>${esc(d.name)}</a></th>
        <td>${h(d.hours)} / ${n(d.episodes)}</td><td>${n(status(d, "s0", "pass"))} / ${x3}</td><td>${keep}</td>
        <td>${d.geometry_eligible ? h(d.kept_hours) : "—"}</td><td>${x1}</td><td>${pct(d.m3.fraction, 2)}</td></tr>`;
    }).join("") || '<tr><td colspan="7" class="muted">没有匹配的数据集</td></tr>';
  }

  function detail(data, d) {
    const allReasons = d.geometry_eligible ? d.reasons : [...d.s0_reasons, ...d.x3_reasons];
    const old = d.old;
    const m3 = d.m3;
    const historical = d.historical_overlap;
    const x3 = stageAvailable(d, "x3") ? `${n(status(d, "x3", "pass"))} / ${n(stageAvailable(d, "x3"))}` : "证据不足";
    const metrics = [
      ["S0 通过 / 样本", `${n(status(d,"s0","pass"))} / ${n(d.episodes)}`],
      ["X3 通过 / 有效", x3],
      ["原生保留 / 适用", d.geometry_eligible ? `${n(d.kept)} / ${n(d.geometry_eligible)}` : "证据不足"],
      ["保留时长 / 适用时长", d.geometry_eligible ? `${h(d.kept_hours)} / ${h(d.geometry_eligible_hours)} h` : "证据不足"],
      ["X1 L1 / L4", d.x1.rated ? `${n(d.x1.l1)} / ${n(d.x1.l4)}` : "证据不足"],
      ["X1 覆盖", `${n(d.x1.rated)} / ${n(d.episodes)}`],
      ["M1 连续复核 / 有效", d.m1.rated_episodes ? `${n(d.m1.review_episodes)} / ${n(d.m1.rated_episodes)}` : "证据不足"],
      ["M3 步异常率", pct(m3.fraction, 2)],
    ];
    const sensitivity = Object.entries(m3.sensitivity).sort(([a],[b]) => Number(a) - Number(b));
    const falseFields = Object.entries(d.x1.false_fields).sort((a,b) => b[1] - a[1]).slice(0,3);
    return `<aside class="quality-panel quality-detail" id="quality-detail" aria-labelledby="quality-detail-title" tabindex="-1">
      <h2 id="quality-detail-title">${esc(d.name)}</h2><p class="muted">${n(d.episodes)} 条 · ${h(d.hours)} h · C1 有效 ${n(d.c1)} 条</p>
      ${data.findings[d.name] ? `<p>${esc(data.findings[d.name])}</p>` : ""}
      <dl class="quality-metrics">${metrics.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>
      ${old.comparable ? `<p>同批 ${n(old.comparable)} 条可对照，原规则保留 ${n(old.kept)} 条，通过转淘汰 ${n(old.before_pass_after_fail)} 条，淘汰转通过 ${n(old.before_fail_after_pass)} 条。${old.before_pass_after_frozen_fail ? `固定原阈值时，S0/X3 拦下其中 ${n(old.before_pass_after_frozen_fail)} 条。` : ""}</p>` : ""}
      ${historical.matched ? `<p class="muted">与历史结果重合 ${n(historical.matched)} 条，历史保留 ${n(historical.old_kept)} 条，本次保留 ${n(historical.new_kept)} 条。</p>` : ""}
      ${allReasons.length ? `<h3>主要触发原因</h3><ul class="quality-reasons">${allReasons.slice(0,5).map(([label,count]) => `<li>${esc(label)} · ${n(count)} 条</li>`).join("")}</ul>` : ""}
      ${falseFields.length ? `<p class="muted">X1 最常触发字段 ${falseFields.map(([key,count]) => `${esc(fieldNames[key] ?? key)} ${n(count)}`).join("、")}。</p>` : ""}
      ${sensitivity.length ? `<details><summary>M3 阈值敏感性</summary><p>保留样本中 ${n(m3.kept_with_any_flag)} 条有 M3 标记。</p>
        <div class="matrix-wrap"><table class="matrix"><tbody>${sensitivity.map(([z,rate]) => `<tr><th scope="row">Z=${Number(z)}</th><td>${pct(rate,2)}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
      ${d.views.length ? `<details><summary>各视角或版本</summary><ul class="quality-reasons">${d.views.map(v => `<li>${esc(v.name)} · ${n(v.episodes)} 条 · ${h(v.hours)} h · X1 有效 ${n(v.x1.rated)} 条</li>`).join("")}</ul></details>` : ""}
      ${d.legacy ? `<p><a href="#view=dataset&amp;ds=${encodeURIComponent(d.name)}">打开同名数据集的历史视频样例</a></p>` : ""}
    </aside>`;
  }

  function overview(root, data, dataset) {
    const rows = data.datasets;
    const lookup = new Map(rows.map(row => [row.name, row]));
    const d = lookup.get(dataset) || lookup.get("EgoSuite") || rows[0];
    const geometry = data.chart_datasets.map(name => lookup.get(name)).filter(Boolean);
    const semantic = ["EgoSuite-MCAP", "Human-1M", "vitra_ssv2", "EgoSuite", "JD_10h", "EgoDex", "Ditto_training", "OpenHumanWAM"].map(name => lookup.get(name)).filter(Boolean);
    const total = data.total;
    root.innerHTML = `<h1>第一视角数据质量评估</h1>
      <p class="muted">每套目标 ${data.target_hours} 小时，媒体不足时使用全量。累计时长按评估样本计。</p>
      ${stats(data)}
      <p>同批 ${n(total.old.comparable)} 条样本，原规则保留 ${n(total.old.kept)} 条，合并版保留 ${n(total.kept)} 条。X1 有效 ${n(total.x1.rated)} 条，其中 L4 ${n(total.x1.l4)} 条。</p>
      <div class="quality-comparison">${geometryChart(geometry)}${semanticChart(semantic)}</div>
      <div class="quality-catalog"><section aria-labelledby="quality-table-title">
        <h2 id="quality-table-title">各数据集结果</h2>
        <div class="quality-controls" role="search">
          <input type="search" id="quality-filter" aria-label="搜索数据集" placeholder="搜索数据集" autocomplete="off" value="${esc(preferences.query)}">
          <select id="quality-sort" aria-label="排序方式"><option value="name">按名称</option><option value="hours">按样本时长</option><option value="keep">按保留率从低到高</option><option value="x1">按 X1 L4 占比</option><option value="m3">按 M3 异常率</option></select>
          <output id="quality-table-count" class="muted" aria-live="polite"></output>
        </div>
        <div class="matrix-wrap quality-table" tabindex="0" aria-label="数据集对比表"><table class="matrix"><thead><tr>
          <th scope="col" class="rh">数据集</th><th scope="col">小时 / 条</th><th scope="col">S0 / X3 通过</th><th scope="col">原生保留</th><th scope="col">保留 h</th><th scope="col">X1 L4 / 有效</th><th scope="col">M3 步异常率</th>
        </tr></thead><tbody id="quality-table-rows"></tbody></table></div>
      </section>${detail(data,d)}</div>
      <section class="quality-findings quality-panel"><h2>典型异常复核</h2>
        <ul>${Object.entries(data.findings).map(([name,note]) => `<li><a href="${linked(name)}">${esc(name)}</a>。${esc(note)}</li>`).join("")}</ul>
        <details><summary>OpenHumanWAM 的 6 条 X1 复核</summary><ol>${data.review.map(note => `<li>${esc(note)}</li>`).join("")}</ol></details>
      </section>
      <section class="quality-method quality-panel"><h2>判定口径</h2>
        <p class="muted">原生保留适用于有完整几何输入的样本。S0 检查全帧解码、帧数、FPS 和 PTS，X3 检查标签帧索引和时间戳。四张 A800 参与支持格式的解码。</p>
        <p class="muted">M1 连续越界复核 ${n(total.m1.review_episodes)} 条。M3 使用 Z=${data.m3_z} 和 ${data.m3_floor_m} m 下限，${pct(total.m3.fraction,2)} 的有效转移步触发标记，保留样本中 ${n(total.m3.kept_with_any_flag)} 条有标记。</p>
        <p class="muted">X1 使用 ${esc(data.model)}，最多 8 张均匀抽帧。L4 为待复核。${n(status(total,"x1","skipped"))} 条因时序准入跳过，${n(data.x1_unavailable.missing_task)} 条缺任务文本，${n(data.x1_unavailable.content_inspection)} 条触发接口内容审核。C1 有独立采集标签才评级。</p>
        <p class="muted">${data.missing_media.map(esc).join("、")}缺少本地媒体。Ditto、BitRobot 和纯视频批次按可用字段统计。</p>
      </section>`;
    const filter = root.querySelector("#quality-filter");
    const sort = root.querySelector("#quality-sort");
    sort.value = preferences.sort;
    filter.addEventListener("input", () => {
      preferences.query = filter.value;
      updateTable(root, rows, d);
    });
    sort.addEventListener("change", () => {
      preferences.sort = sort.value;
      updateTable(root, rows, d);
    });
    updateTable(root, rows, d);
    if (dataset && d.name === dataset) {
      const panel = root.querySelector("#quality-detail");
      panel.scrollIntoView({ block: "nearest" });
      panel.focus({ preventScroll: true });
    } else window.scrollTo(0, 0);
  }

  window.EgoSmithQuality = {
    async render(root, dataset, isActive) {
      const current = ++ticket;
      if (!root.querySelector(".quality-catalog")) root.innerHTML = '<p class="empty" role="status">正在加载 10 小时评估…</p>';
      try {
        const data = await load();
        if (current === ticket && isActive()) overview(root, data, dataset);
      } catch (error) {
        if (current === ticket && isActive()) root.innerHTML = `<p class="empty" role="alert">评估数据加载失败（${esc(error.message)}）</p>`;
      }
    },
  };
})();
