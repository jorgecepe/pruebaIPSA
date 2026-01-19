// IPSA Tracker - Main Application JavaScript

// Global state
let ipsaChart = null;
let currentPeriod = 7;
let historicalData = [];
let lastIpsaValue = null;

// API endpoints
const CMF_API_KEY = '10affc3841d7013d0374f12e609a31dd7ffe4090';
const CMF_UF_API = `https://api.cmfchile.cl/api-sbifv3/recursos_api/uf?apikey=${CMF_API_KEY}&formato=json`;
const CMF_DOLAR_API = `https://api.cmfchile.cl/api-sbifv3/recursos_api/dolar?apikey=${CMF_API_KEY}&formato=json`;
const YAHOO_FINANCE_PROXY = 'https://corsproxy.io/?';
const IPSA_SYMBOL = '^IPSA';

// DOM Elements
const elements = {
    ipsaValue: document.getElementById('ipsaValue'),
    ipsaChange: document.getElementById('ipsaChange'),
    clpValue: document.getElementById('clpValue'),
    usdValue: document.getElementById('usdValue'),
    usdRate: document.getElementById('usdRate'),
    ufValue: document.getElementById('ufValue'),
    ufRate: document.getElementById('ufRate'),
    lastUpdate: document.getElementById('lastUpdate'),
    refreshBtn: document.getElementById('refreshBtn')
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
        // CMF returns {UFs: [{Valor: "38.000,00", Fecha: "2025-01-19"}]}
        if (data.UFs && data.UFs.length > 0) {
            const valorStr = data.UFs[0].Valor.replace('.', '').replace(',', '.');
            return parseFloat(valorStr);
        }
        throw new Error('No UF data');
    } catch (error) {
        console.error('Error fetching UF:', error);
        throw error;
    }
}

// Fetch Dolar from CMF Chile
async function fetchDolar() {
    try {
        const response = await fetch(CMF_DOLAR_API);
        const data = await response.json();
        // CMF returns {Dolares: [{Valor: "950,00", Fecha: "2025-01-19"}]}
        if (data.Dolares && data.Dolares.length > 0) {
            const valorStr = data.Dolares[0].Valor.replace('.', '').replace(',', '.');
            return parseFloat(valorStr);
        }
        throw new Error('No Dolar data');
    } catch (error) {
        console.error('Error fetching Dolar:', error);
        throw error;
    }
}

// Fetch IPSA from Yahoo Finance
async function fetchIPSA() {
    try {
        // Yahoo Finance API endpoint for quote
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${IPSA_SYMBOL}?interval=1d&range=1d`;
        const proxyUrl = YAHOO_FINANCE_PROXY + encodeURIComponent(url);

        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            return {
                current: meta.regularMarketPrice,
                previous: meta.previousClose || meta.chartPreviousClose
            };
        }
        throw new Error('No IPSA data from Yahoo');
    } catch (error) {
        console.error('Error fetching IPSA from Yahoo:', error);
        throw error;
    }
}

// Fetch IPSA historical data from Yahoo Finance
async function fetchIpsaHistory(days = 30) {
    try {
        const range = days <= 7 ? '7d' : days <= 30 ? '1mo' : '3mo';
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${IPSA_SYMBOL}?interval=1d&range=${range}`;
        const proxyUrl = YAHOO_FINANCE_PROXY + encodeURIComponent(url);

        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const timestamps = result.timestamp || [];
            const closes = result.indicators.quote[0].close || [];

            const history = [];
            for (let i = 0; i < timestamps.length && i < days; i++) {
                if (closes[i] !== null) {
                    history.push({
                        fecha: new Date(timestamps[i] * 1000).toISOString(),
                        valor: closes[i]
                    });
                }
            }

            if (history.length > 0) {
                return history;
            }
        }
        throw new Error('No historical data');
    } catch (error) {
        console.warn('Historical API failed, will use simulated data:', error.message);
        return null;
    }
}

// Generate simulated historical data based on current value
function generateSimulatedHistory(currentValue, days) {
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Add some realistic random variation (±3%)
        let value;
        if (i !== 0) {
            value = currentValue + (Math.random() - 0.5) * currentValue * 0.03;
        } else {
            value = currentValue;
        }

        data.push({
            fecha: date.toISOString(),
            valor: value
        });
    }

    return data;
}

// Calculate change from previous value
function calculateChange(currentValue, previousValue) {
    if (!previousValue) return { value: 0, percent: 0 };
    const change = currentValue - previousValue;
    const percent = (change / previousValue) * 100;
    return { value: change, percent: percent };
}

// Update IPSA display
function updateIpsaDisplay(ipsaValue, previousValue) {
    elements.ipsaValue.textContent = formatNumber(ipsaValue, 2);

    const change = calculateChange(ipsaValue, previousValue);
    const changeEl = elements.ipsaChange;

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
function updateConversions(ipsaValue, usdRate, ufRate) {
    // CLP (1 punto IPSA = 1 CLP)
    const clpValue = ipsaValue;
    elements.clpValue.textContent = formatCurrency(clpValue, 'CLP');

    // USD conversion
    const usdValue = clpValue / usdRate;
    elements.usdValue.textContent = formatCurrency(usdValue, 'USD');
    elements.usdRate.textContent = formatCurrency(usdRate, 'CLP');

    // UF conversion
    const ufValue = clpValue / ufRate;
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

    const labels = data.map(item => {
        const date = new Date(item.fecha);
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
    });

    const values = data.map(item => item.valor);

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, isSimulated ? 'rgba(156, 39, 176, 0.3)' : 'rgba(26, 115, 232, 0.3)');
    gradient.addColorStop(1, 'rgba(26, 115, 232, 0.0)');

    const borderColor = isSimulated ? '#9c27b0' : '#1a73e8';

    if (ipsaChart) {
        ipsaChart.data.labels = labels;
        ipsaChart.data.datasets[0].data = values;
        ipsaChart.data.datasets[0].borderColor = borderColor;
        ipsaChart.data.datasets[0].pointBackgroundColor = borderColor;
        ipsaChart.data.datasets[0].backgroundColor = gradient;
        ipsaChart.update('active');
    } else {
        ipsaChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'IPSA (Puntos)',
                    data: values,
                    borderColor: borderColor,
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: borderColor,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
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
                                return `IPSA: ${formatNumber(context.parsed.y, 2)} puntos${suffix}`;
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
                            minRotation: 45
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
            }
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
        // Fetch all data in parallel
        const [ipsaData, usdRate, ufRate, ipsaHistory] = await Promise.all([
            fetchIPSA(),
            fetchDolar(),
            fetchUF(),
            fetchIpsaHistory(currentPeriod)
        ]);

        const currentIpsa = ipsaData.current;
        const previousIpsa = ipsaData.previous;

        // Use real history or generate simulated
        let chartData = ipsaHistory;
        let isSimulated = false;

        if (!chartData) {
            chartData = generateSimulatedHistory(currentIpsa, currentPeriod);
            isSimulated = true;
        }

        // Update displays
        updateIpsaDisplay(currentIpsa, previousIpsa);
        updateConversions(currentIpsa, usdRate, ufRate);
        updateTimestamp();

        // Update chart
        historicalData = chartData;
        updateChart(historicalData, isSimulated);

        // Store last value
        lastIpsaValue = currentIpsa;

        if (isSimulated) {
            showNotification('Datos actualizados (gráfico estimado)', 'success');
        } else {
            showNotification('Datos actualizados correctamente');
        }

    } catch (error) {
        console.error('Error refreshing data:', error);
        showNotification('Error al actualizar los datos. Intente nuevamente.', 'error');

        // Show error in values if no previous data
        if (!lastIpsaValue) {
            elements.ipsaValue.textContent = 'Error';
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

// Period button handlers
document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        // Update active button
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Update period and fetch new data
        currentPeriod = parseInt(this.dataset.period);

        try {
            let ipsaHistory = await fetchIpsaHistory(currentPeriod);
            let isSimulated = false;

            if (!ipsaHistory && lastIpsaValue) {
                ipsaHistory = generateSimulatedHistory(lastIpsaValue, currentPeriod);
                isSimulated = true;
            }

            if (ipsaHistory) {
                historicalData = ipsaHistory;
                updateChart(historicalData, isSimulated);
            }
        } catch (error) {
            showNotification('Error al cargar datos del período', 'error');
        }
    });
});

// Auto-refresh every 5 minutes
setInterval(refreshData, 5 * 60 * 1000);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    refreshData();
});
