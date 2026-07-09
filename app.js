// Global application state
let rawData = [];
let chartInstance = null;
let currentView = 'regions';

// Localization mappings for chart labels and table labels
const labelsMapping = {
  "kosicky_kraj_byty": "Košický kraj, byty",
  "kosicky_kraj_domy": "Košický kraj, domy",
  "kosice_byty": "Košice, byty",
  "kosice_domy": "Košice, domy",
  "presovsky_kraj_byty": "Prešovský kraj, byty",
  "presovsky_kraj_domy": "Prešovský kraj, domy",
  "bratislava_byty": "Bratislava byty",
  "bratislava_domy": "Bratislava domy",
  "slovensko_byty": "Slovensko byty",
  "slovensko_domy": "Slovensko domy",
  "kosice_byty_under_215k": "menej ako medián",
  "kosice_byty_over_215k": "viac ako medián",
  "bratislava_byty_under_300k": "menej ako medián",
  "bratislava_byty_over_300k": "viac ako medián",
  "slovensko_byty_under_215k": "menej ako medián",
  "slovensko_byty_over_215k": "viac ako medián",
  "slovensko_domy_under_215k": "menej ako medián",
  "slovensko_domy_over_215k": "viac ako medián"
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  fetchData();
  setupEventListeners();
});

// Theme management (Light / Dark mode)
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);
}

function updateThemeIcons(theme) {
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');
  
  if (theme === 'dark') {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  } else {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcons(newTheme);
  
  // Re-render chart to update grid/text colors for new theme
  if (chartInstance) {
    updateChartThemeOptions();
    chartInstance.update();
  }
}

function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    text: isDark ? '#86868b' : '#6e6e73',
    grid: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    activeText: isDark ? '#f5f5f7' : '#1d1d1f'
  };
}

// Fetch raw data points
async function fetchData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    rawData = await response.json();
    
    // Sort chronological (ascending by date parsing)
    // Dates are formatted as DD.MM.YYYY
    rawData.sort((a, b) => {
      const partsA = a.date.split('.');
      const partsB = b.date.split('.');
      return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
    });
    
    renderDashboard();
  } catch (error) {
    console.error("Error loading dataset:", error);
    document.getElementById('metrics-summary-container').innerHTML = 
      `<div style="text-align: center; color: var(--danger-color); padding: 40px 0;">Chyba pri nahrávaní dát: ${error.message}</div>`;
  }
}

function setupEventListeners() {
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  
  // Tab controller clicks
  const tabs = document.querySelectorAll('.btn-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      currentView = tab.getAttribute('data-view');
      
      // Update chart title in UI
      const titles = {
        'regions': 'Vývoj trhu: Regióny',
        'kosice': 'Vývoj trhu: Košice byty a ceny',
        'bratislava': 'Vývoj trhu: Bratislava byty a ceny',
        'slovakia': 'Vývoj trhu: Slovensko (Celkovo)'
      };
      document.getElementById('chart-view-title').textContent = titles[currentView];
      
      renderChart();
    });
  });
}

function renderDashboard() {
  if (rawData.length === 0) return;
  
  renderSummaryCard();
  renderChart();
  renderHistoryTable();
}

// Summary card rendering with differences
function renderSummaryCard() {
  const latestEntry = rawData[rawData.length - 1];
  const prevEntry = rawData.length > 1 ? rawData[rawData.length - 2] : null;
  
  document.getElementById('latest-date-label').textContent = latestEntry.date;
  const container = document.getElementById('metrics-summary-container');
  container.innerHTML = '';
  
  // Main metrics to show in summary card
  const summaryKeys = [
    { key: 'kosice_byty', label: 'Košice, byty', sub: 'Mesto Košice' },
    { key: 'kosice_domy', label: 'Košice, domy', sub: 'Mesto Košice' },
    { key: 'bratislava_byty', label: 'Bratislava, byty', sub: 'Mesto Bratislava' },
    { key: 'bratislava_domy', label: 'Bratislava, domy', sub: 'Mesto Bratislava' },
    { key: 'slovensko_byty', label: 'Slovensko, byty', sub: 'Celá SR' },
    { key: 'slovensko_domy', label: 'Slovensko, domy', sub: 'Celá SR' }
  ];
  
  summaryKeys.forEach(item => {
    const val = latestEntry.metrics[item.key];
    const prevVal = prevEntry ? prevEntry.metrics[item.key] : null;
    
    let diffHtml = '';
    if (prevVal !== null && val !== null) {
      const diff = val - prevVal;
      const percent = ((diff / prevVal) * 100).toFixed(1);
      
      if (diff > 0) {
        // Red color for more properties listed for sale (growing inventory)
        diffHtml = `<span class="metric-badge up">+${diff} (+${percent}%)</span>`;
      } else if (diff < 0) {
        // Green color for decreasing supply
        diffHtml = `<span class="metric-badge down">${diff} (${percent}%)</span>`;
      } else {
        diffHtml = `<span class="metric-badge neutral">0 (0.0%)</span>`;
      }
    }
    
    const row = document.createElement('div');
    row.className = 'metric-row';
    row.innerHTML = `
      <div class="metric-label-group">
        <span class="metric-label">${item.label}</span>
        <span class="metric-sublabel">${item.sub}</span>
      </div>
      <div class="metric-value-group">
        <span class="metric-value">${val !== null ? val.toLocaleString() : 'N/A'}</span>
        ${diffHtml}
      </div>
    `;
    container.appendChild(row);
  });
}

// Chart.js render logic
function renderChart() {
  const dates = rawData.map(d => d.date);
  const datasets = getDatasetsForView();
  const colors = getThemeColors();
  
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  const ctx = document.getElementById('trendsChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Outfit', size: 12 },
            color: colors.activeText
          }
        },
        tooltip: {
          titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
          bodyFont: { family: 'Inter', size: 13 },
          padding: 12,
          cornerRadius: 12,
          backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(30, 30, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: colors.activeText,
          bodyColor: colors.activeText,
          borderColor: 'rgba(0, 0, 0, 0.05)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: colors.grid },
          ticks: { font: { family: 'Inter', size: 11 }, color: colors.text }
        },
        y: {
          grid: { color: colors.grid },
          ticks: { font: { family: 'Inter', size: 11 }, color: colors.text }
        }
      }
    }
  });
}

function updateChartThemeOptions() {
  const colors = getThemeColors();
  chartInstance.options.scales.x.grid.color = colors.grid;
  chartInstance.options.scales.x.ticks.color = colors.text;
  chartInstance.options.scales.y.grid.color = colors.grid;
  chartInstance.options.scales.y.ticks.color = colors.text;
  chartInstance.options.plugins.legend.labels.color = colors.activeText;
  
  // Update tooltip colors
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  chartInstance.options.plugins.tooltip.backgroundColor = isDark ? 'rgba(30, 30, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  chartInstance.options.plugins.tooltip.titleColor = colors.activeText;
  chartInstance.options.plugins.tooltip.bodyColor = colors.activeText;
}

// Generate data series for the chart views
function getDatasetsForView() {
  const colorsList = {
    blue: { stroke: '#0071e3', fill: 'rgba(0, 113, 227, 0.05)' },
    teal: { stroke: '#30d158', fill: 'rgba(48, 209, 88, 0.05)' },
    orange: { stroke: '#ff9500', fill: 'rgba(255, 149, 0, 0.05)' },
    purple: { stroke: '#af52de', fill: 'rgba(175, 82, 222, 0.05)' },
    red: { stroke: '#ff3b30', fill: 'rgba(255, 59, 48, 0.05)' },
    pink: { stroke: '#ff2d55', fill: 'rgba(255, 45, 85, 0.05)' }
  };
  
  if (currentView === 'regions') {
    return [
      createDataset('Košický kraj - Byty', rawData.map(d => d.metrics.kosicky_kraj_byty), colorsList.blue),
      createDataset('Košický kraj - Domy', rawData.map(d => d.metrics.kosicky_kraj_domy), colorsList.teal),
      createDataset('Prešovský kraj - Byty', rawData.map(d => d.metrics.presovsky_kraj_byty), colorsList.orange),
      createDataset('Prešovský kraj - Domy', rawData.map(d => d.metrics.presovsky_kraj_domy), colorsList.purple),
      createDataset('Bratislava - Byty', rawData.map(d => d.metrics.bratislava_byty), colorsList.red),
      createDataset('Bratislava - Domy', rawData.map(d => d.metrics.bratislava_domy), colorsList.pink)
    ];
  } else if (currentView === 'kosice') {
    return [
      createDataset('Celkovo byty', rawData.map(d => d.metrics.kosice_byty), colorsList.blue),
      createDataset('Cena ≤ 215k €', rawData.map(d => d.metrics.kosice_byty_under_215k), colorsList.teal),
      createDataset('Cena > 215k €', rawData.map(d => d.metrics.kosice_byty_over_215k), colorsList.orange)
    ];
  } else if (currentView === 'bratislava') {
    return [
      createDataset('Celkovo byty', rawData.map(d => d.metrics.bratislava_byty), colorsList.blue),
      createDataset('Cena ≤ 300k €', rawData.map(d => d.metrics.bratislava_byty_under_300k), colorsList.teal),
      createDataset('Cena > 300k €', rawData.map(d => d.metrics.bratislava_byty_over_300k), colorsList.orange)
    ];
  } else if (currentView === 'slovakia') {
    // Sum combined Slovakia prices
    const slovakiaCombinedUnder = rawData.map(d => {
      const byty = d.metrics.slovensko_byty_under_215k || 0;
      const domy = d.metrics.slovensko_domy_under_215k || 0;
      return byty + domy;
    });
    const slovakiaCombinedOver = rawData.map(d => {
      const byty = d.metrics.slovensko_byty_over_215k || 0;
      const domy = d.metrics.slovensko_domy_over_215k || 0;
      return byty + domy;
    });
    
    return [
      createDataset('Byty celkovo', rawData.map(d => d.metrics.slovensko_byty), colorsList.blue),
      createDataset('Domy celkovo', rawData.map(d => d.metrics.slovensko_domy), colorsList.teal),
      createDataset('Byty + Domy ≤ 215k €', slovakiaCombinedUnder, colorsList.orange),
      createDataset('Byty + Domy > 215k €', slovakiaCombinedOver, colorsList.red)
    ];
  }
}

function createDataset(label, data, colors) {
  return {
    label: label,
    data: data,
    borderColor: colors.stroke,
    backgroundColor: colors.fill,
    borderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    tension: 0.25,
    fill: true,
    spanGaps: true // allows drawing the line even if some middle data points are null (e.g. Bratislava domy on 26.01.2026)
  };
}

// Render historical comparison table (matching layout of the spreadsheet template)
function renderHistoryTable() {
  const dates = rawData.map(d => d.date);
  
  // Update header row with dates
  const headerRow = document.getElementById('table-header-row');
  headerRow.innerHTML = '<th scope="col" id="col-category">Kategória / Dátum</th>';
  dates.forEach(date => {
    headerRow.innerHTML += `<th scope="col" class="number-cell">${date}</th>`;
  });
  
  const body = document.getElementById('table-body');
  body.innerHTML = '';
  
  // Structured rows representing the spreadsheet template
  const tableRowsDefinition = [
    { type: 'data', label: "Košický kraj, byty", key: 'kosicky_kraj_byty' },
    { type: 'data', label: "Košický kraj, domy", key: 'kosicky_kraj_domy' },
    { type: 'empty' },
    { type: 'data', label: "Košice, byty", key: 'kosice_byty' },
    { type: 'data', label: "Košice, domy", key: 'kosice_domy' },
    { type: 'empty' },
    { type: 'data', label: "Prešovský kraj, byty", key: 'presovsky_kraj_byty' },
    { type: 'data', label: "Prešovský kraj, domy", key: 'presovsky_kraj_domy' },
    { type: 'empty' },
    { type: 'data', label: "Bratislava byty", key: 'bratislava_byty' },
    { type: 'data', label: "Bratislava domy", key: 'bratislava_domy' },
    { type: 'empty' },
    { type: 'data', label: "Slovensko byty", key: 'slovensko_byty' },
    { type: 'data', label: "Slovensko domy", key: 'slovensko_domy' },
    { type: 'empty' },
    
    // Median-based segments
    { type: 'section-header', label: "Košice, byty, medián", val: "215 000" },
    { type: 'median-data', label: "  menej ako medián", parentKey: 'kosice', priceKey: 'under_215k' },
    { type: 'median-data', label: "  viac ako medián", parentKey: 'kosice', priceKey: 'over_215k' },
    { type: 'empty' },
    
    { type: 'section-header', label: "Bratislava, byty, medián", val: "300 000" },
    { type: 'median-data', label: "  menej ako medián", parentKey: 'bratislava', priceKey: 'under_300k' },
    { type: 'median-data', label: "  viac ako medián", parentKey: 'bratislava', priceKey: 'over_300k' },
    { type: 'empty' },
    
    { type: 'section-header', label: "Slovensko, byty a domy, medián", val: "215 000" },
    { type: 'sum-median-data', label: "  menej ako medián", priceKey: 'under_215k' },
    { type: 'sum-median-data', label: "  viac ako medián", priceKey: 'over_215k' }
  ];
  
  tableRowsDefinition.forEach(rowDef => {
    const tr = document.createElement('tr');
    
    if (rowDef.type === 'empty') {
      tr.className = 'empty-row';
      tr.innerHTML = `<td colspan="${dates.length + 1}"></td>`;
    } 
    else if (rowDef.type === 'section-header') {
      tr.className = 'section-header-row';
      tr.innerHTML = `<td>${rowDef.label}</td>`;
      tr.innerHTML += `<td class="median-val">${rowDef.val}</td>`;
      // Pad empty columns
      for (let i = 1; i < dates.length; i++) {
        tr.innerHTML += `<td></td>`;
      }
    } 
    else {
      tr.innerHTML = `<td>${rowDef.label}</td>`;
      
      rawData.forEach(entry => {
        let value = '-';
        
        if (rowDef.type === 'data') {
          const val = entry.metrics[rowDef.key];
          value = val !== null && val !== undefined ? val.toLocaleString() : '-';
        } 
        else if (rowDef.type === 'median-data') {
          const key = `${rowDef.parentKey}_byty_${rowDef.priceKey}`;
          const val = entry.metrics[key];
          value = val !== null && val !== undefined ? val.toLocaleString() : '-';
        } 
        else if (rowDef.type === 'sum-median-data') {
          // Sum apartments and houses under/over median for Slovakia
          const bytyKey = `slovensko_byty_${rowDef.priceKey}`;
          const domyKey = `slovensko_domy_${rowDef.priceKey}`;
          const bytyVal = entry.metrics[bytyKey] || 0;
          const domyVal = entry.metrics[domyKey] || 0;
          const totalVal = bytyVal + domyVal;
          value = totalVal > 0 ? totalVal.toLocaleString() : '-';
        }
        
        tr.innerHTML += `<td class="number-cell">${value}</td>`;
      });
    }
    
    body.appendChild(tr);
  });
}
