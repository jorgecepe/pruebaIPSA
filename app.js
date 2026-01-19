// IPSA Tracker - Main Application JavaScript

// Global state
let ipsaChart = null;
let currentPeriod = 7;
let historicalData = [];
let lastIpsaValue = null;

// API endpoints
const MINDICADOR_API = 'https://mindicador.cl/api';
const CORS_PROXY = 'https://corsproxy.io/?';

// Helper to fetch with CORS proxy fallback
async function fetchWithCors(url) {
    // Try CORS proxy first (more reliable for GitHub Pages)
    try {
        console.log('Fetching via CORS proxy:', url);
        const proxyResponse = await fetch(CORS_PROXY + encodeURIComponent(url));
        if (proxyResponse.ok) return proxyResponse;
    } catch (e) {
        console.log('CORS proxy failed, trying direct...');
    }

    // Fallback to direct fetch
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
}

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

// Fetch data from mindicador.cl API
async function fetchMindicadorData() {
    const response = await fetchWithCors(MINDICADOR_API);
    return await response.json();
}

// Fetch IPSA historical data from mindicador
async function fetchIpsaHistory(days = 30) {
    try {
        const response = await fetchWithCors(`${MINDICADOR_API}/ipsa`);
        const data = await response.json();
        if (data.serie && data.serie.length > 0) {
            return data.serie.slice(0, days).reverse();
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
    const volatility = 0.008; // 0.8% daily volatility

    let value = currentValue;

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Add some realistic random variation
        const change = (Math.random() - 0.5) * 2 * volatility * value;
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

    // Ensure last value is the current value
    data[data.length - 1].valor = currentValue;

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
        // Fetch main data first (this usually works)
        const mindicadorData = await fetchMindicadorData();

        // Extract rates
        const usdRate = mindicadorData.dolar.valor;
        const ufRate = mindicadorData.uf.valor;
        const ipsaData = mindicadorData.ipsa;
        const currentIpsa = ipsaData.valor;

        // Try to get historical data
        let ipsaHistory = await fetchIpsaHistory(currentPeriod);
        let isSimulated = false;

        // If historical API fails, generate simulated data
        if (!ipsaHistory) {
            ipsaHistory = generateSimulatedHistory(currentIpsa, currentPeriod);
            isSimulated = true;
        }

        // Get previous value for change calculation
        const previousIpsa = ipsaHistory.length > 1 ? ipsaHistory[ipsaHistory.length - 2].valor : lastIpsaValue;

        // Update displays
        updateIpsaDisplay(currentIpsa, previousIpsa);
        updateConversions(currentIpsa, usdRate, ufRate);
        updateTimestamp();

        // Update chart
        historicalData = ipsaHistory;
        updateChart(historicalData, isSimulated);

        // Store last value for next comparison
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
