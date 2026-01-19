// IPSA Tracker - Main Application JavaScript

// Global state
let ipsaChart = null;
let currentPeriod = 7;
let currentSymbol = '^IPSA';
let historicalData = [];
let lastValue = null;
let usdRate = null;
let ufRate = null;

// Chilean stocks configuration
const STOCKS = {
    '^IPSA': { name: 'IPSA', description: 'Índice IPSA', type: 'index' },
    'SQM-B.SN': { name: 'SQM-B', description: 'SQM', type: 'stock' },
    'FALABELLA.SN': { name: 'FALABELLA', description: 'Falabella', type: 'stock' },
    'COPEC.SN': { name: 'COPEC', description: 'Empresas Copec', type: 'stock' },
    'BSANTANDER.SN': { name: 'BSANTANDER', description: 'Banco Santander Chile', type: 'stock' },
    'CENCOSUD.SN': { name: 'CENCOSUD', description: 'Cencosud', type: 'stock' },
    'CHILE.SN': { name: 'CHILE', description: 'Banco de Chile', type: 'stock' },
    'ENELCHILE.SN': { name: 'ENELCHILE', description: 'Enel Chile', type: 'stock' },
    'CCU.SN': { name: 'CCU', description: 'CCU', type: 'stock' },
    'CMPC.SN': { name: 'CMPC', description: 'CMPC', type: 'stock' },
    'LTM.SN': { name: 'LTM', description: 'LATAM Airlines', type: 'stock' }
};

// API endpoints
const CMF_API_KEY = '10affc3841d7013d0374f12e609a31dd7ffe4090';
const CMF_UF_API = `https://api.cmfchile.cl/api-sbifv3/recursos_api/uf?apikey=${CMF_API_KEY}&formato=json`;
const CMF_DOLAR_API = `https://api.cmfchile.cl/api-sbifv3/recursos_api/dolar?apikey=${CMF_API_KEY}&formato=json`;
const CORS_PROXY = 'https://corsproxy.io/?';

// DOM Elements
const elements = {
    stockSelector: document.getElementById('stockSelector'),
    stockName: document.getElementById('stockName'),
    stockDescription: document.getElementById('stockDescription'),
    mainValue: document.getElementById('mainValue'),
    valueChange: document.getElementById('valueChange'),
    clpValue: document.getElementById('clpValue'),
    usdValue: document.getElementById('usdValue'),
    usdRate: document.getElementById('usdRate'),
    ufValue: document.getElementById('ufValue'),
    ufRate: document.getElementById('ufRate'),
    lastUpdate: document.getElementById('lastUpdate'),
    refreshBtn: document.getElementById('refreshBtn'),
    chartTitle: document.getElementById('chartTitle')
};

// Format number with thousands separator
function formatNumber(num, decimals = 0) {
    return new Intl.NumberFormat('es-CL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

// Format currency
function formatCurrency(num, currency = 'CLP') {
    const options = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === 'CLP' ? 0 : 2,
        maximumFractionDigits: currency === 'CLP' ? 0 : 2
    };
    return new Intl.NumberFormat('es-CL', options).format(num);
}

// Show notification
function showNotification(message, type = 'success') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Fetch UF from CMF Chile
async function fetchUF() {
    try {
        const response = await fetch(CMF_UF_API);
        const data = await response.json();
        if (data.UFs && data.UFs.length > 0) {
            const valorStr = data.UFs[0].Valor.replace(/\./g, '').replace(',', '.');
            return parseFloat(valorStr);
        }
        throw new Error('No UF data');
    } catch (error) {
        console.error('Error fetching UF:', error);
        return 38000; // Fallback value
    }
}

// Fetch Dolar from CMF Chile
async function fetchDolar() {
    try {
        const response = await fetch(CMF_DOLAR_API);
        const data = await response.json();
        if (data.Dolares && data.Dolares.length > 0) {
            const valorStr = data.Dolares[0].Valor.replace(/\./g, '').replace(',', '.');
            return parseFloat(valorStr);
        }
        throw new Error('No Dolar data');
    } catch (error) {
        console.error('Error fetching Dolar:', error);
        return 900; // Fallback value
    }
}

// Fetch stock data from Yahoo Finance
async function fetchStockData(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const proxyUrl = CORS_PROXY + encodeURIComponent(url);

        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            return {
                current: meta.regularMarketPrice,
                previous: meta.previousClose || meta.chartPreviousClose || meta.regularMarketPrice
            };
        }
        throw new Error('No data from Yahoo');
    } catch (error) {
        console.error('Error fetching stock data:', error);
        throw error;
    }
}

// Fetch historical data from Yahoo Finance
async function fetchHistoricalData(symbol, days = 30) {
    try {
        // Map days to Yahoo Finance range parameter
        let range = '1mo';
        if (days <= 7) range = '5d';
        else if (days <= 30) range = '1mo';
        else if (days <= 90) range = '3mo';
        else range = '6mo';

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
        const proxyUrl = CORS_PROXY + encodeURIComponent(url);

        console.log('Fetching historical data:', url);

        const response = await fetch(proxyUrl);
        const data = await response.json();

        console.log('Yahoo response:', data);

        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const timestamps = result.timestamp || [];
            const quotes = result.indicators.quote[0] || {};
            const closes = quotes.close || [];

            console.log('Timestamps:', timestamps.length, 'Closes:', closes.length);

            const history = [];
            for (let i = 0; i < timestamps.length; i++) {
                const closeValue = closes[i];
                if (closeValue !== null && closeValue !== undefined && !isNaN(closeValue)) {
                    history.push({
                        fecha: new Date(timestamps[i] * 1000).toISOString(),
                        valor: closeValue
                    });
                }
            }

            console.log('Parsed history:', history.length, 'points');

            // Limit to requested days
            if (history.length > days) {
                return history.slice(-days);
            }

            if (history.length > 0) {
                return history;
            }
        }

        console.warn('No valid historical data found');
        return null;
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return null;
    }
}

// Generate simulated historical data based on current value
function generateSimulatedHistory(currentValue, days) {
    const data = [];
    const now = new Date();

    // Generate data working backwards with realistic market movement
    let value = currentValue;
    const dailyVolatility = 0.015; // 1.5% daily volatility

    // First, generate values going backwards
    const tempData = [];
    for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;

        tempData.unshift({
            fecha: date.toISOString(),
            valor: value
        });

        // Random walk backwards
        const change = (Math.random() - 0.48) * dailyVolatility * value;
        value = value - change;
    }

    return tempData;
}

// Calculate change from previous value
function calculateChange(currentValue, previousValue) {
    if (!previousValue) return { value: 0, percent: 0 };
    const change = currentValue - previousValue;
    const percent = (change / previousValue) * 100;
    return { value: change, percent: percent };
}

// Update main display
function updateMainDisplay(value, previousValue) {
    const stock = STOCKS[currentSymbol];
    const isIndex = stock.type === 'index';

    // Update stock info
    if (elements.stockName) elements.stockName.textContent = stock.name;
    if (elements.stockDescription) elements.stockDescription.textContent = stock.description;

    // Update value - show as points for index, CLP for stocks
    if (isIndex) {
        elements.mainValue.textContent = formatNumber(value, 2);
    } else {
        elements.mainValue.textContent = formatCurrency(value, 'CLP');
    }

    const change = calculateChange(value, previousValue);
    const changeEl = elements.valueChange;

    if (change.value >= 0) {
        changeEl.className = 'card-change positive';
        changeEl.innerHTML = `
            <span class="change-value">▲ ${formatNumber(Math.abs(change.value), 2)}</span>
            <span class="change-percent">(+${change.percent.toFixed(2)}%)</span>
        `;
    } else {
        changeEl.className = 'card-change negative';
        changeEl.innerHTML = `
            <span class="change-value">▼ ${formatNumber(Math.abs(change.value), 2)}</span>
            <span class="change-percent">(${change.percent.toFixed(2)}%)</span>
        `;
    }
}

// Update conversions display
function updateConversions(value) {
    if (!usdRate || !ufRate) return;

    // CLP value
    elements.clpValue.textContent = formatCurrency(value, 'CLP');

    // USD conversion
    const usdValue = value / usdRate;
    elements.usdValue.textContent = formatCurrency(usdValue, 'USD');
    elements.usdRate.textContent = formatCurrency(usdRate, 'CLP');

    // UF conversion
    const ufValue = value / ufRate;
    elements.ufValue.textContent = ufValue.toFixed(6) + ' UF';
    elements.ufRate.textContent = formatCurrency(ufRate, 'CLP');
}

// Update last update time
function updateTimestamp() {
    const now = new Date();
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    elements.lastUpdate.textContent = `Última actualización: ${now.toLocaleDateString('es-CL', options)}`;
}

// Initialize or update chart
function updateChart(data, isSimulated = false) {
    const ctx = document.getElementById('ipsaChart').getContext('2d');
    const stock = STOCKS[currentSymbol];

    // Update chart title
    if (elements.chartTitle) {
        elements.chartTitle.textContent = `Evolución de ${stock.name}`;
    }

    const labels = data.map(item => {
        const date = new Date(item.fecha);
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
    });

    const values = data.map(item => item.valor);

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, isSimulated ? 'rgba(156, 39, 176, 0.3)' : 'rgba(26, 115, 232, 0.3)');
    gradient.addColorStop(1, 'rgba(26, 115, 232, 0.0)');

    const borderColor = isSimulated ? '#9c27b0' : '#1a73e8';

    const chartData = {
        labels: labels,
        datasets: [{
            label: `${stock.name} (CLP)`,
            data: values,
            borderColor: borderColor,
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: data.length > 30 ? 2 : 4,
            pointHoverRadius: 6,
            pointBackgroundColor: borderColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        const suffix = isSimulated ? ' (estimado)' : '';
                        return `${stock.name}: ${formatCurrency(context.parsed.y, 'CLP')}${suffix}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    maxTicksLimit: 10
                }
            },
            y: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    callback: function(value) {
                        return formatNumber(value, 0);
                    }
                }
            }
        }
    };

    if (ipsaChart) {
        ipsaChart.data = chartData;
        ipsaChart.options = chartOptions;
        ipsaChart.update('active');
    } else {
        ipsaChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: chartOptions
        });
    }
}

// Main data refresh function
async function refreshData() {
    const btn = elements.refreshBtn;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Cargando...';

    // Add updating animation to cards
    document.querySelectorAll('.card-value').forEach(el => el.classList.add('updating'));

    try {
        // Fetch exchange rates if not loaded
        if (!usdRate || !ufRate) {
            [usdRate, ufRate] = await Promise.all([fetchDolar(), fetchUF()]);
        }

        // Fetch stock data and history in parallel
        const [stockData, history] = await Promise.all([
            fetchStockData(currentSymbol),
            fetchHistoricalData(currentSymbol, currentPeriod)
        ]);

        const currentValue = stockData.current;
        const previousValue = stockData.previous;

        // Use real history or generate simulated
        let chartData = history;
        let isSimulated = false;

        if (!chartData || chartData.length < 2) {
            chartData = generateSimulatedHistory(currentValue, currentPeriod);
            isSimulated = true;
            console.log('Using simulated data with', chartData.length, 'points');
        }

        // Update displays
        updateMainDisplay(currentValue, previousValue);
        updateConversions(currentValue);
        updateTimestamp();

        // Update chart
        historicalData = chartData;
        updateChart(historicalData, isSimulated);

        // Store last value
        lastValue = currentValue;

        if (isSimulated) {
            showNotification('Datos actualizados (gráfico estimado)', 'success');
        } else {
            showNotification('Datos actualizados correctamente');
        }

    } catch (error) {
        console.error('Error refreshing data:', error);
        showNotification('Error al actualizar los datos. Intente nuevamente.', 'error');

        // Show error in values if no previous data
        if (!lastValue) {
            elements.mainValue.textContent = 'Error';
            elements.clpValue.textContent = 'Error';
            elements.usdValue.textContent = 'Error';
            elements.ufValue.textContent = 'Error';
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🔄 Actualizar';
        document.querySelectorAll('.card-value').forEach(el => el.classList.remove('updating'));
    }
}

// Initialize stock selector
function initStockSelector() {
    const selector = elements.stockSelector;
    if (!selector) return;

    // Populate selector
    selector.innerHTML = '';
    for (const [symbol, info] of Object.entries(STOCKS)) {
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = `${info.name} - ${info.description}`;
        selector.appendChild(option);
    }

    // Handle selection change
    selector.addEventListener('change', async function() {
        currentSymbol = this.value;
        await refreshData();
    });
}

// Period button handlers
function initPeriodButtons() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            // Update active button
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Update period and fetch new data
            currentPeriod = parseInt(this.dataset.period);

            try {
                let history = await fetchHistoricalData(currentSymbol, currentPeriod);
                let isSimulated = false;

                if (!history || history.length < 2) {
                    if (lastValue) {
                        history = generateSimulatedHistory(lastValue, currentPeriod);
                        isSimulated = true;
                    }
                }

                if (history) {
                    historicalData = history;
                    updateChart(historicalData, isSimulated);
                }
            } catch (error) {
                showNotification('Error al cargar datos del período', 'error');
            }
        });
    });
}

// Auto-refresh every 5 minutes
setInterval(refreshData, 5 * 60 * 1000);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initStockSelector();
    initPeriodButtons();
    refreshData();
});

// Expose refresh function globally
window.refreshData = refreshData;
