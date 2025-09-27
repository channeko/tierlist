// tierlist.js
// 外部ファイルとして保存し、index.html から読み込みます。
// S/A/B/C/D/E の列を作ってドラッグ＆ドロップでカード移動・追加・編集・削除できます。

(() => {
  const TIERS = ["S","A","B","C","D","E"];
  const container = document.getElementById("tiersContainer");
  const addBtn = document.getElementById("addBtn");
  const newItemInput = document.getElementById("newItemInput");

  // --- 初期データ（必要なければ空にする） ---
  const initial = [
    {name: "例：強キャラ", tier: "S"},
    {name: "例：使えるキャラ", tier: "A"},
    {name: "例：普通のキャラ", tier: "C"}
  ];

  // --- ユーティリティ ---
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") e.className = v;
      else if (k === "dataset") Object.assign(e.dataset, v);
      else if (k === "style") Object.assign(e.style, v);
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    children.flat().forEach(c => {
      if (c == null) return;
      e.append(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  // --- ドラッグ操作用 state ---
  let dragData = { card: null, originTier: null };

  // --- カード作成 ---
  function createCard(itemName) {
    const card = el("div", { class: "card", draggable: "true" },
      el("div", { class: "label", contenteditable: "true", onfocus: () => card.classList.add("editing"), onblur: onCardEdit }, itemName),
      el("div", { class: "actions" },
        el("button", { class: "icon-btn", title: "削除", onclick: (e) => { e.stopPropagation(); deleteCard(card); } }, "✕")
      )
    );

    // drag events
    card.addEventListener("dragstart", (ev) => {
      dragData.card = card;
      dragData.originTier = card.closest(".tier")?.dataset.tier;
      card.classList.add("dragging");
      // set drag image for nicer UX
      try { ev.dataTransfer.setData("text/plain", "drag"); } catch(e){}
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      clearDragOver();
      dragData = { card: null, originTier: null };
    });

    // double-click to focus edit
    card.addEventListener("dblclick", () => {
      const label = card.querySelector(".label");
      label.focus();
      // put caret at end
      document.execCommand('selectAll', false, null);
      const sel = window.getSelection();
      sel.collapse(label.firstChild || label, label.textContent.length);
    });

    return card;
  }

  function onCardEdit(e) {
    const label = e.target;
    label.classList.remove("editing");
    // normalize whitespace
    label.textContent = label.textContent.trim();
    if (!label.textContent) {
      // empty -> remove
      const card = label.closest(".card");
      if (confirm("内容が空です。削除しますか？")) deleteCard(card);
      else label.textContent = "無名";
    }
  }

  function deleteCard(card) {
    card.remove();
  }

  // --- ティア列作成 ---
  function makeTierCol(tierName) {
    const body = el("div", { class: "tier-body" });
    const col = el("section", { class: "tier", role: "region", "aria-label": tierName, dataset: { tier: tierName } },
      el("div", { class: "tier-header" },
        el("div", { class: "tier-title" }, tierName),
        el("div", { style: { color: "var(--muted)", marginLeft: "8px", fontSize: "0.9rem" } }, `(${0})`)
      ),
      body
    );

    // dragover & drop
    col.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      col.classList.add("drag-over");
      ev.dataTransfer.dropEffect = "move";
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (ev) => {
      ev.preventDefault();
      col.classList.remove("drag-over");
      if (!dragData.card) return;
      // append to body (end)
      const targetBody = col.querySelector(".tier-body");
      targetBody.appendChild(dragData.card);
      updateCounts();
      // optional: update dataset or state if you maintain one
    });

    return col;
  }

  function clearDragOver() {
    container.querySelectorAll(".tier").forEach(t => t.classList.remove("drag-over"));
  }

  // --- UI 初期描画 ---
  function renderTiers() {
    container.innerHTML = "";
    TIERS.forEach(t => {
      container.appendChild(makeTierCol(t));
    });
    updateCounts();
  }

  // --- カウント更新 ---
  function updateCounts() {
    container.querySelectorAll(".tier").forEach(t => {
      const title = t.querySelector(".tier-header > div:nth-child(2)");
      const cnt = t.querySelectorAll(".card").length;
      title.textContent = `(${cnt})`;
    });
  }

  // --- アイテム追加（入力から） ---
  function addItem(name, tier = "C", focus = true) {
    if (!name || !name.trim()) return;
    const target = Array.from(container.querySelectorAll(".tier")).find(t => t.dataset.tier === tier) || container.querySelector(".tier");
    const body = target.querySelector(".tier-body");
    const card = createCard(name.trim());
    body.appendChild(card);
    updateCounts();
    if (focus) {
      const label = card.querySelector(".label");
      label.focus();
      // move caret to end
      const range = document.createRange();
      range.selectNodeContents(label);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // --- イベントバインド ---
  function bindControls() {
    addBtn.addEventListener("click", () => {
      addItem(newItemInput.value || "無名", "C");
      newItemInput.value = "";
      newItemInput.focus();
    });
    newItemInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        addBtn.click();
      }
    });

    // allow dropping between cards (to insert)
    container.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      // find card under pointer, and if exists, insert before it
      const y = ev.clientY;
      let inserted = false;
      const cards = Array.from(container.querySelectorAll(".card"));
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          const parentBody = c.closest(".tier").querySelector(".tier-body");
          if (dragData.card && parentBody && parentBody !== dragData.card.parentElement) {
            // if different column, insert; else still allow reordering
            parentBody.insertBefore(dragData.card, c);
            updateCounts();
            inserted = true;
            break;
          } else if (dragData.card && parentBody) {
            parentBody.insertBefore(dragData.card, c);
            updateCounts();
            inserted = true;
            break;
          }
        }
      }
      if (!inserted) clearDragOver();
    });

    // clicking outside should blur editors
    document.addEventListener("click", (e) => {
      const editing = document.querySelector(".label.editing");
      if (editing && !editing.contains(e.target)) editing.blur();
    });
  }

  // --- 初期アイテムの挿入 ---
  function seedInitial() {
    initial.forEach(it => addItem(it.name, it.tier, false));
    updateCounts();
  }

  // --- 初期化 ---
  function init() {
    renderTiers();
    bindControls();
    seedInitial();
  }

  // start
  init();

  // expose small API for console (optional)
  window.TierList = {
    add: addItem,
    getState: () => {
      // return simple state snapshot
      return Array.from(container.querySelectorAll(".tier")).map(t => ({
        tier: t.dataset.tier,
        items: Array.from(t.querySelectorAll(".card .label")).map(lbl => lbl.textContent.trim())
      }));
    }
  };
})();
