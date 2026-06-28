const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const fields = ["gastos", "receita", "reembolso", "imposto", "pagamento", "recebedor", "saque", "trafego"];
const appShell = document.querySelector("#appShell");
const sidebarToggle = document.querySelector("#sidebarToggle");
const monthInput = document.querySelector("#monthInput");
const periodMode = document.querySelector("#periodMode");
const yearInput = document.querySelector("#yearInput");
const customRange = document.querySelector("#customRange");
const rangeStart = document.querySelector("#rangeStart");
const rangeEnd = document.querySelector("#rangeEnd");
const dailyRows = document.querySelector("#dailyRows");
const quickForm = document.querySelector("#quickForm");
const navLinks = document.querySelectorAll("[data-view]");
const themeToggle = document.querySelector("#themeToggle");
const dashboardView = document.querySelector("#dashboardView");
const detailView = document.querySelector("#detailView");
const historyView = document.querySelector("#historyView");
const chart = document.querySelector("#profitChart");
const ctx = chart.getContext("2d");

const today = new Date();
const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
let state = loadState(initialMonth);
let viewDays = state.days;
let viewGoal = state.profitGoal;
let viewDescription = "Veja resultado, caixa e metas do mês em uma única tela.";
let isEditableView = true;
let activeView = "dashboard";

function storageKey(month) {
  return `operacao-hub:${month}`;
}

function isDataKey(key) {
  return key.startsWith("operacao-hub:") && /^\d{4}-\d{2}$/.test(key.replace("operacao-hub:", ""));
}

function applyTheme(theme) {
  const selectedTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = selectedTheme;
  themeToggle?.setAttribute("aria-pressed", selectedTheme === "light" ? "true" : "false");
  localStorage.setItem("operacao-hub:theme", selectedTheme);
  drawChart();
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthString() {
  return localDateString().slice(0, 7);
}

function blankDay(date) {
  return {
    date,
    gastos: 0,
    receita: 0,
    reembolso: 0,
    imposto: 0,
    pagamento: 0,
    recebedor: 0,
    saque: 0,
    trafego: 0,
    notes: "",
  };
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function dateForDay(month, day) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function normalizeState(data, month) {
  const totalDays = daysInMonth(month);
  const existing = new Map((data.days || []).map((day) => [day.date, day]));
  const days = Array.from({ length: totalDays }, (_, index) => {
    const date = dateForDay(month, index + 1);
    return { ...blankDay(date), ...(existing.get(date) || {}) };
  });

  return {
    month,
    profitGoal: Number(data.profitGoal || 100000),
    distanceGoal: Number(data.distanceGoal || 100000),
    days,
  };
}

function loadState(month) {
  const raw = localStorage.getItem(storageKey(month));
  if (!raw) return normalizeState({}, month);

  try {
    return normalizeState(JSON.parse(raw), month);
  } catch {
    return normalizeState({}, month);
  }
}

function saveState() {
  localStorage.setItem(storageKey(state.month), JSON.stringify(state));
}

function saveMonthData(month, monthState) {
  localStorage.setItem(storageKey(month), JSON.stringify(monthState));
}

function monthFromDate(date) {
  return date.slice(0, 7);
}

function monthsInYear(year) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

function monthsBetween(startDate, endDate) {
  const months = [];
  const [startYear, startMonth] = monthFromDate(startDate).split("-").map(Number);
  const [endYear, endMonth] = monthFromDate(endDate).split("-").map(Number);
  const cursor = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth - 1, 1);

  while (cursor <= end) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function daysForMonths(months) {
  return months.flatMap((month) => loadState(month).days);
}

function daysInRange(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) return [];
  return monthsBetween(startDate, endDate)
    .flatMap((month) => loadState(month).days)
    .filter((day) => day.date >= startDate && day.date <= endDate);
}

function formatMonthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T00:00:00`));
}

function getViewGoal(mode) {
  if (mode === "month") return state.profitGoal;
  if (mode === "year") {
    return monthsInYear(Number(yearInput.value || today.getFullYear())).reduce((sum, month) => sum + loadState(month).profitGoal, 0);
  }
  const start = rangeStart.value;
  const end = rangeEnd.value;
  if (!start || !end || start > end) return 0;
  return monthsBetween(start, end).reduce((sum, month) => {
    const monthState = loadState(month);
    const monthDays = monthState.days.filter((day) => day.date >= start && day.date <= end).length;
    return sum + (monthState.profitGoal / monthState.days.length) * monthDays;
  }, 0);
}

function updateView() {
  const mode = periodMode.value;
  isEditableView = mode === "month";
  customRange.hidden = mode !== "custom";

  if (mode === "month") {
    viewDays = state.days;
    viewDescription = `Visualizando ${formatMonthLabel(state.month)}.`;
  } else if (mode === "year") {
    const year = Number(yearInput.value || today.getFullYear());
    viewDays = daysForMonths(monthsInYear(year));
    viewDescription = `Visualizando o ano inteiro de ${year}.`;
  } else {
    const start = rangeStart.value;
    const end = rangeEnd.value;
    viewDays = daysInRange(start, end);
    viewDescription = start && end && start <= end ? `Visualizando de ${formatDateLabel(start)} até ${formatDateLabel(end)}.` : "Escolha uma data inicial e final para ver o intervalo.";
  }

  viewGoal = getViewGoal(mode);
}

function toNumber(value) {
  return Number(value || 0);
}

function dayProfit(day) {
  return toNumber(day.receita) + toNumber(day.reembolso) - toNumber(day.gastos) - toNumber(day.imposto);
}

function dayRoi(day) {
  return toNumber(day.gastos) > 0 ? dayProfit(day) / toNumber(day.gastos) : 0;
}

function hasOperationMovement(day) {
  return ["gastos", "receita", "reembolso", "imposto"].some((field) => toNumber(day[field]) > 0);
}

function getTotals() {
  return calculateTotals(viewDays);
}

function calculateTotals(days) {
  return days.reduce(
    (total, day) => {
      fields.forEach((field) => {
        total[field] += toNumber(day[field]);
      });
      total.lucro += dayProfit(day);
      total.saleDays += toNumber(day.receita) > 0 ? 1 : 0;
      return total;
    },
    {
      gastos: 0,
      receita: 0,
      reembolso: 0,
      imposto: 0,
      pagamento: 0,
      recebedor: 0,
      saque: 0,
      trafego: 0,
      lucro: 0,
      saleDays: 0,
    }
  );
}

function renderTable() {
  dailyRows.innerHTML = viewDays
    .map((day, index) => {
      const profit = dayProfit(day);
      const roi = dayRoi(day);
      return `
        <tr data-row-index="${index}">
          <td><strong>${formatShortDate(day.date)}</strong></td>
          ${editableCell(index, "gastos")}
          ${editableCell(index, "receita")}
          ${editableCell(index, "reembolso")}
          ${editableCell(index, "imposto")}
          <td data-calculated="profit" class="${profit < 0 ? "negative" : "positive"}"><strong>${money.format(profit)}</strong></td>
          <td data-calculated="roi">${pct.format(roi)}</td>
          <td class="notes"><input data-index="${index}" data-field="notes" value="${escapeAttribute(day.notes)}" ${isEditableView ? "" : "readonly"} /></td>
        </tr>`;
    })
    .join("");

  document.querySelector("#tableCount").textContent = `${viewDays.length} dias`;
}

function editableCell(index, field) {
  const value = viewDays[index][field] || "";
  const readonly = isEditableView ? "" : "readonly";
  return `<td><input type="number" min="0" step="0.01" data-index="${index}" data-field="${field}" value="${value}" ${readonly} /></td>`;
}

function renderRowCalculations(index) {
  const row = dailyRows.querySelector(`[data-row-index="${index}"]`);
  const day = viewDays[index];
  if (!row || !day) return;

  const profit = dayProfit(day);
  const roi = dayRoi(day);
  const profitCell = row.querySelector('[data-calculated="profit"]');
  const roiCell = row.querySelector('[data-calculated="roi"]');
  if (!profitCell || !roiCell) return;

  profitCell.classList.toggle("negative", profit < 0);
  profitCell.classList.toggle("positive", profit >= 0);
  profitCell.querySelector("strong").textContent = money.format(profit);
  roiCell.textContent = pct.format(roi);
}

function escapeAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatShortDate(date) {
  const [year, month, day] = date.split("-");
  return isEditableView ? `${day}/${month}` : `${day}/${month}/${year.slice(2)}`;
}

function renderDailyInsights() {
  const todayKey = localDateString();
  const todayDay = viewDays.find((day) => day.date === todayKey);
  const todayProfitValue = todayDay ? dayProfit(todayDay) : 0;
  const todayRoiValue = todayDay ? dayRoi(todayDay) : 0;
  const hasTodayMovement = todayDay ? hasOperationMovement(todayDay) : false;
  const activeDays = viewDays.filter(hasOperationMovement);
  const expenseDays = activeDays.filter((day) => toNumber(day.gastos) > 0);

  setText("#todayDateLabel", todayDay ? formatDateLabel(todayDay.date) : "Hoje fora do período");
  setText("#todayStatus", hasTodayMovement ? "Com movimento" : "Sem movimento");
  setText("#todayProfit", money.format(todayProfitValue));
  setText("#todayRevenue", money.format(todayDay ? toNumber(todayDay.receita) : 0));
  setText("#todayExpense", money.format(todayDay ? toNumber(todayDay.gastos) : 0));
  setText("#todayRoi", pct.format(todayRoiValue));
  document.querySelector("#todayProfit").classList.toggle("negative", todayProfitValue < 0);
  document.querySelector("#todayProfit").classList.toggle("positive", todayProfitValue >= 0);

  const bestDay = activeDays.reduce((best, day) => (!best || dayProfit(day) > dayProfit(best) ? day : best), null);
  const worstDay = activeDays.reduce((worst, day) => (!worst || dayProfit(day) < dayProfit(worst) ? day : worst), null);
  const topExpenseDay = expenseDays.reduce((top, day) => (!top || toNumber(day.gastos) > toNumber(top.gastos) ? day : top), null);
  const bestRoiDay = expenseDays.reduce((best, day) => (!best || dayRoi(day) > dayRoi(best) ? day : best), null);

  setText("#bestDayValue", bestDay ? money.format(dayProfit(bestDay)) : money.format(0));
  setText("#bestDayLabel", bestDay ? formatShortDate(bestDay.date) : "--");
  setText("#worstDayValue", worstDay ? money.format(dayProfit(worstDay)) : money.format(0));
  setText("#worstDayLabel", worstDay ? formatShortDate(worstDay.date) : "--");
  setText("#topExpenseValue", topExpenseDay ? money.format(toNumber(topExpenseDay.gastos)) : money.format(0));
  setText("#topExpenseLabel", topExpenseDay ? formatShortDate(topExpenseDay.date) : "--");
  setText("#bestRoiValue", bestRoiDay ? pct.format(dayRoi(bestRoiDay)) : pct.format(0));
  setText("#bestRoiLabel", bestRoiDay ? formatShortDate(bestRoiDay.date) : "--");
}

function historyMonths() {
  return [...new Set([state.month, currentMonthString(), ...Object.keys(localStorage).filter(isDataKey).map((key) => key.replace("operacao-hub:", ""))])].sort().reverse();
}

function monthSummary(month) {
  const monthState = loadState(month);
  const totals = calculateTotals(monthState.days);
  const roi = totals.gastos > 0 ? totals.lucro / totals.gastos : 0;
  const goalRatio = monthState.profitGoal > 0 ? totals.lucro / monthState.profitGoal : 0;

  return {
    month,
    goal: monthState.profitGoal,
    goalRatio,
    roi,
    totals,
  };
}

function renderMonthlyHistory() {
  const summaries = historyMonths().map(monthSummary);
  const historyTotals = summaries.reduce(
    (total, item) => {
      total.receita += item.totals.receita;
      total.gastos += item.totals.gastos;
      total.lucro += item.totals.lucro;
      return total;
    },
    { receita: 0, gastos: 0, lucro: 0 }
  );
  const averageRoi = historyTotals.gastos > 0 ? historyTotals.lucro / historyTotals.gastos : 0;
  const bestMonth = summaries.reduce((best, item) => (!best || item.totals.lucro > best.totals.lucro ? item : best), null);

  setText("#historyRange", "Histórico");
  setText("#historyTotalProfit", money.format(historyTotals.lucro));
  setText("#historyMonthCount", "");
  setText("#historyTotalRevenue", money.format(historyTotals.receita));
  setText("#historyTotalExpense", `Gastos ${money.format(historyTotals.gastos)}`);
  setText("#historyBestMonthValue", bestMonth ? money.format(bestMonth.totals.lucro) : money.format(0));
  setText("#historyBestMonthLabel", bestMonth ? formatMonthLabel(bestMonth.month) : "--");
  setText("#historyAverageRoi", pct.format(averageRoi));

  document.querySelector("#historyRows").innerHTML = summaries
    .map((item) => {
      const progress = Math.max(0, Math.min(item.goalRatio * 100, 100));
      return `
        <tr>
          <td><strong>${formatMonthLabel(item.month)}</strong></td>
          <td>${money.format(item.totals.receita)}</td>
          <td>${money.format(item.totals.gastos)}</td>
          <td class="${item.totals.lucro < 0 ? "negative" : "positive"}"><strong>${money.format(item.totals.lucro)}</strong></td>
          <td>${pct.format(item.roi)}</td>
          <td>${money.format(item.goal)}</td>
          <td>
            <div class="history-progress">
              <span style="width: ${progress}%"></span>
            </div>
            <small>${pct.format(item.goalRatio)}</small>
          </td>
          <td><button class="month-open" type="button" data-month="${item.month}">Abrir</button></td>
        </tr>`;
    })
    .join("");
}

function renderTotals() {
  const totals = getTotals();
  const roi = totals.gastos > 0 ? totals.lucro / totals.gastos : 0;
  const goalRatio = viewGoal > 0 ? totals.lucro / viewGoal : 0;
  const cashLeft = totals.lucro + totals.recebedor - totals.pagamento - totals.saque - totals.trafego;

  setText("#revenueTotal", money.format(totals.receita));
  setText("#expenseTotal", money.format(totals.gastos));
  setText("#profitTotal", money.format(totals.lucro));
  setText("#roiTotal", pct.format(roi));
  setText("#revenueDays", `${totals.saleDays} dias`);
  setText("#profitGoalText", `${pct.format(goalRatio)} meta`);

  setText("#totalGastos", money.format(totals.gastos));
  setText("#totalReceita", money.format(totals.receita));
  setText("#totalReembolso", money.format(totals.reembolso));
  setText("#totalImposto", money.format(totals.imposto));
  setText("#totalLucro", money.format(totals.lucro));
  setText("#totalRoi", pct.format(roi));

  setText("#cashLeft", money.format(cashLeft));
  setText("#withdrawTotal", money.format(totals.saque));
  setText("#trafficTotal", money.format(totals.trafego));
  setText("#periodSubtitle", viewDescription);
  setText("#goalMiniLabel", "Meta");
  document.querySelector("#goalMiniInput").value = state.profitGoal || "";
  document.querySelector("#goalMiniInput").disabled = !isEditableView;
  setText("#heroGoalPercent", pct.format(goalRatio));
  document.querySelector("#heroGoalBar").style.width = `${Math.max(0, Math.min(goalRatio * 100, 100))}%`;
  setText("#cashMini", money.format(cashLeft));
  setText("#trafficMini", money.format(totals.trafego));
  setText("#goalPercent", pct.format(goalRatio));
  document.querySelector("#goalBar").style.width = `${Math.max(0, Math.min(goalRatio * 100, 100))}%`;

  document.querySelector("#profitGoal").value = state.profitGoal || "";
  document.querySelector("#profitGoal").disabled = !isEditableView;
  document.querySelector("#distanceGoal").value = state.distanceGoal || "";
  document.querySelector("#distanceGoal").disabled = !isEditableView;
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportDataBackup() {
  const data = {};
  Object.keys(localStorage)
    .filter(isDataKey)
    .sort()
    .forEach((key) => {
      data[key] = JSON.parse(localStorage.getItem(key));
    });

  const backup = {
    app: "operacao-hub",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };

  downloadFile(`backup-operacao-hub-${localDateString()}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
}

function restoreDataBackup(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const backup = JSON.parse(reader.result);
      if (backup.app !== "operacao-hub" || !backup.data) throw new Error("backup inválido");

      Object.entries(backup.data).forEach(([key, value]) => {
        if (isDataKey(key)) localStorage.setItem(key, JSON.stringify(value));
      });

      state = loadState(state.month);
      setDefaultDates();
      render();
      alert("Backup restaurado com sucesso.");
    } catch {
      alert("Não consegui restaurar esse arquivo. Verifique se ele é um backup do Hub Operação.");
    }
  });
  reader.readAsText(file);
}

function renderCashList() {
  const items = viewDays
    .filter((day) => day.pagamento || day.recebedor || day.saque || day.trafego)
    .map(
      (day) => `
        <div class="compact-item">
          <strong>${formatShortDate(day.date)}</strong>
          <span>Pag.: ${money.format(day.pagamento || 0)}</span>
          <span>Recebido: ${money.format(day.recebedor || 0)}</span>
          <span>Saque: ${money.format(day.saque || 0)}</span>
          <span>Tráfego: ${money.format(day.trafego || 0)}</span>
        </div>`
    )
    .join("");

  document.querySelector("#cashList").innerHTML = items || `<p class="muted">Nenhum movimento de caixa lançado.</p>`;
}

function drawChart() {
  const width = chart.width;
  const height = chart.height;
  const padding = 34;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const expenses = viewDays.map((day) => toNumber(day.gastos));
  const profits = viewDays.map(dayProfit);
  const maxValue = Math.max(100, ...profits.map(Math.abs), ...expenses);
  const isLightTheme = document.body.dataset.theme === "light";
  const labelColor = isLightTheme ? "#64748b" : "#8ea0b8";
  const gridColor = isLightTheme ? "rgba(74, 94, 121, 0.14)" : "rgba(142, 160, 184, 0.16)";
  const zeroLineColor = isLightTheme ? "rgba(74, 94, 121, 0.24)" : "rgba(142, 160, 184, 0.28)";

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (plotHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  const zeroY = padding + plotHeight / 2;
  ctx.strokeStyle = zeroLineColor;
  ctx.beginPath();
  ctx.moveTo(padding, zeroY);
  ctx.lineTo(width - padding, zeroY);
  ctx.stroke();

  const step = plotWidth / Math.max(viewDays.length - 1, 1);
  const yFor = (value) => zeroY - (value / maxValue) * (plotHeight / 2 - 10);

  drawBars(expenses, step, yFor, zeroY, "#ff6b5e");
  drawArea(profits, step, yFor, zeroY, "rgba(37, 209, 125, 0.16)");
  drawLine(profits, step, yFor, "#25d17d");

  ctx.fillStyle = labelColor;
  ctx.font = "700 12px Poppins, system-ui, sans-serif";
  ctx.fillText("Lucro", padding, 20);
  ctx.fillStyle = "#25d17d";
  ctx.fillRect(padding + 42, 12, 16, 8);
  ctx.fillStyle = labelColor;
  ctx.fillText("Gastos", padding + 72, 20);
  ctx.fillStyle = "#ff6b5e";
  ctx.fillRect(padding + 120, 12, 16, 8);
}

function drawBars(values, step, yFor, zeroY, color) {
  ctx.fillStyle = color;
  values.forEach((value, index) => {
    const x = 34 + step * index;
    const barWidth = Math.max(5, Math.min(14, step * 0.42));
    const y = yFor(value);
    ctx.globalAlpha = value > 0 ? 0.22 : 0;
    ctx.fillRect(x - barWidth / 2, Math.min(y, zeroY), barWidth, Math.abs(zeroY - y));
  });
  ctx.globalAlpha = 1;
}

function drawArea(values, step, yFor, zeroY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = 34 + step * index;
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, zeroY);
    ctx.lineTo(x, y);
  });
  ctx.lineTo(34 + step * (values.length - 1), zeroY);
  ctx.closePath();
  ctx.fill();
}

function drawLine(values, step, yFor, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = 34 + step * index;
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function render() {
  updateView();
  monthInput.value = state.month;
  yearInput.value = yearInput.value || state.month.slice(0, 4);
  renderTable();
  renderTotals();
  renderDailyInsights();
  renderMonthlyHistory();
  renderCashList();
  drawChart();
}

function setActiveView(view) {
  activeView = ["detail", "history"].includes(view) ? view : "dashboard";
  dashboardView.classList.toggle("active-view", activeView === "dashboard");
  detailView.classList.toggle("active-view", activeView === "detail");
  historyView.classList.toggle("active-view", activeView === "history");
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === activeView);
  });
  const hashByView = {
    dashboard: "#dashboard",
    detail: "#detalhamento",
    history: "#historico",
  };
  history.replaceState(null, "", hashByView[activeView]);
  if (activeView === "history") renderMonthlyHistory();
  if (activeView === "dashboard") drawChart();
}

function viewFromHash(hash) {
  if (hash === "#detalhamento") return "detail";
  if (hash === "#historico") return "history";
  return "dashboard";
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setActiveView(link.dataset.view);
  });
});

window.addEventListener("hashchange", () => {
  setActiveView(viewFromHash(location.hash));
});

document.querySelector("#historyRows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-month]");
  if (!button) return;

  state = loadState(button.dataset.month);
  periodMode.value = "month";
  monthInput.value = state.month;
  yearInput.value = state.month.slice(0, 4);
  setDefaultDates();
  render();
  setActiveView("detail");
});

dailyRows.addEventListener("input", (event) => {
  if (!isEditableView) return;
  const input = event.target;
  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (!Number.isInteger(index) || !field) return;

  state.days[index][field] = field === "notes" ? input.value : Number(input.value || 0);
  saveState();
  renderRowCalculations(index);
  renderTotals();
  renderDailyInsights();
  renderMonthlyHistory();
  renderCashList();
  drawChart();
});

quickForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const date = document.querySelector("#entryDate").value;
  const type = document.querySelector("#entryType").value;
  const amount = Number(document.querySelector("#entryAmount").value || 0);
  const note = document.querySelector("#entryNote").value.trim();
  const targetMonth = monthFromDate(date);
  const targetState = targetMonth === state.month ? state : loadState(targetMonth);
  const day = targetState.days.find((item) => item.date === date);

  if (!day) return;
  day[type] = toNumber(day[type]) + amount;
  if (note) day.notes = day.notes ? `${day.notes}; ${note}` : note;
  if (targetMonth === state.month) saveState();
  else saveMonthData(targetMonth, targetState);
  quickForm.reset();
  document.querySelector("#entryDate").value = date;
  render();
});

document.querySelector("#cashAddBtn").addEventListener("click", () => {
  const date = document.querySelector("#cashDate").value;
  const targetMonth = monthFromDate(date);
  const targetState = targetMonth === state.month ? state : loadState(targetMonth);
  const day = targetState.days.find((item) => item.date === date);
  if (!day) return;

  day.pagamento += Number(document.querySelector("#cashPayment").value || 0);
  day.recebedor += Number(document.querySelector("#cashReceiver").value || 0);
  document.querySelector("#cashPayment").value = "";
  document.querySelector("#cashReceiver").value = "";
  if (targetMonth === state.month) saveState();
  else saveMonthData(targetMonth, targetState);
  render();
});

document.querySelector("#profitGoal").addEventListener("input", (event) => {
  state.profitGoal = Number(event.target.value || 0);
  saveState();
  renderTotals();
  renderMonthlyHistory();
});

document.querySelector("#goalMiniInput").addEventListener("input", (event) => {
  state.profitGoal = Number(event.target.value || 0);
  saveState();
  renderTotals();
  renderMonthlyHistory();
});

document.querySelector("#distanceGoal").addEventListener("input", (event) => {
  state.distanceGoal = Number(event.target.value || 0);
  saveState();
});

monthInput.addEventListener("change", () => {
  state = loadState(monthInput.value);
  yearInput.value = monthInput.value.slice(0, 4);
  setDefaultDates();
  render();
});

periodMode.addEventListener("change", render);
yearInput.addEventListener("input", render);
rangeStart.addEventListener("change", render);
rangeEnd.addEventListener("change", render);

themeToggle?.addEventListener("click", () => {
  applyTheme(document.body.dataset.theme === "light" ? "dark" : "light");
});

sidebarToggle.addEventListener("click", () => {
  const collapsed = appShell.classList.toggle("sidebar-collapsed");
  sidebarToggle.textContent = collapsed ? "Mostrar menu" : "Menu";
  sidebarToggle.setAttribute("aria-label", collapsed ? "Mostrar menu" : "Ocultar menu");
  localStorage.setItem("operacao-hub:sidebar-collapsed", collapsed ? "1" : "0");
});

document.querySelector("#resetBtn").addEventListener("click", () => {
  if (!confirm("Limpar todos os lançamentos deste mês?")) return;
  localStorage.removeItem(storageKey(state.month));
  state = loadState(state.month);
  setDefaultDates();
  render();
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  const header = ["Data", "Gastos", "Receita", "Reembolso", "Imposto", "Lucro", "ROI", "Pagamento", "Recebido", "Saque", "Invest. tráfego", "Observações"];
  const rows = viewDays.map((day) => [
    day.date,
    day.gastos,
    day.receita,
    day.reembolso,
    day.imposto,
    dayProfit(day).toFixed(2),
    dayRoi(day).toFixed(4),
    day.pagamento,
    day.recebedor,
    day.saque,
    day.trafego,
    `"${String(day.notes || "").replaceAll('"', '""')}"`,
  ]);
  const csv = [header, ...rows].map((row) => row.join(";")).join("\n");
  downloadFile(`operacao-${periodMode.value}-${state.month}.csv`, csv, "text/csv;charset=utf-8");
});

document.querySelector("#backupBtn").addEventListener("click", exportDataBackup);

document.querySelector("#restoreBtn").addEventListener("click", () => {
  document.querySelector("#restoreInput").click();
});

document.querySelector("#restoreInput").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) restoreDataBackup(file);
  event.target.value = "";
});

function setDefaultDates() {
  const currentDay = state.days.find((day) => day.date === localDateString()) || state.days[0];
  document.querySelector("#entryDate").value = currentDay.date;
  document.querySelector("#cashDate").value = currentDay.date;
}

function checkMonthRollover() {
  const currentMonth = currentMonthString();
  if (state.month === currentMonth) return;

  state = loadState(currentMonth);
  monthInput.value = currentMonth;
  periodMode.value = "month";
  yearInput.value = currentMonth.slice(0, 4);
  setDefaultDates();
  render();
}

yearInput.value = today.getFullYear();
rangeStart.value = `${today.getFullYear()}-01-01`;
rangeEnd.value = `${today.getFullYear()}-12-31`;
if (localStorage.getItem("operacao-hub:sidebar-collapsed") === "1") {
  appShell.classList.add("sidebar-collapsed");
  sidebarToggle.textContent = "Mostrar menu";
  sidebarToggle.setAttribute("aria-label", "Mostrar menu");
}

applyTheme(localStorage.getItem("operacao-hub:theme") || "dark");
state = loadState(initialMonth);
setDefaultDates();
render();
setActiveView(viewFromHash(location.hash));
setInterval(checkMonthRollover, 60000);
