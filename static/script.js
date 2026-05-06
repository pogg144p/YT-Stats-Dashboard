document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('analyze-form');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const loader = submitBtn.querySelector('.loader');
    const errorMsg = document.getElementById('error-message');
    const resultsContainer = document.getElementById('results-container');
    const formulaModal = document.getElementById('formula-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const hoursModal = document.getElementById('hours-modal');
    const hoursModalClose = document.getElementById('hours-modal-close');

    // ── Modal Logic (Engagement Formula) ─────────────────────────
    function openModal() {
        formulaModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        formulaModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    modalCloseBtn.addEventListener('click', closeModal);
    formulaModal.addEventListener('click', (e) => {
        if (e.target === formulaModal) closeModal();
    });

    // ── Modal Logic (Upload Hours Chart) ─────────────────────────
    function openHoursModal(hoursData, bestHour) {
        const content = document.getElementById('hours-modal-content');
        content.innerHTML = buildFullHourChart(hoursData, bestHour);
        hoursModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Double rAF ensures the DOM is painted at height:0 before we animate
        requestAnimationFrame(() => requestAnimationFrame(() => {
            content.querySelectorAll('.fhb-bar:not(.fhb-bar--empty)').forEach(bar => {
                bar.style.height = bar.dataset.h + 'px';
            });
        }));

        // ── Bar click → detail panel ─────────────────────────────
        content.addEventListener('click', (e) => {
            const bar = e.target.closest('.fhb-bar');
            if (!bar) return;

            // Deselect all bars, select clicked one
            content.querySelectorAll('.fhb-bar').forEach(b => b.classList.remove('fhb-bar--selected'));
            bar.classList.add('fhb-bar--selected');

            const hour = parseInt(bar.dataset.hour, 10);
            const views = parseInt(bar.dataset.views, 10);
            const bestHourD = bar.dataset.bestHour !== '' ? parseInt(bar.dataset.bestHour, 10) : null;
            const bestViews = parseInt(bar.dataset.bestViews, 10);
            const maxViews = parseInt(bar.dataset.maxViews, 10);

            const panel = document.getElementById('fhb-detail-panel');
            panel.innerHTML = renderHourDetail(hour, views, bestHourD, bestViews, maxViews);
            panel.classList.add('fhb-detail-panel--visible');
        });
    }
    function closeHoursModal() {
        hoursModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    hoursModalClose.addEventListener('click', closeHoursModal);
    hoursModal.addEventListener('click', (e) => {
        if (e.target === hoursModal) closeHoursModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeModal(); closeHoursModal(); }
    });

    // ── Delegated click: info btn, refresh btn, upload hours card ─
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-info')) openModal();
        if (e.target.closest('.btn-refresh') && e.target.closest('#results-container')) performSearch();
        const uploadCard = e.target.closest('.card-upload-hours');
        if (uploadCard) {
            try {
                const hours = JSON.parse(uploadCard.dataset.hours || '{}');
                const rawBest = uploadCard.dataset.best;
                const best = (rawBest !== undefined && rawBest !== 'null' && rawBest !== '')
                    ? parseInt(rawBest, 10) : null;
                openHoursModal(hours, isNaN(best) ? null : best);
            } catch (err) { console.warn('Hours modal error:', err); }
        }
    });

    // ── Search / Fetch ────────────────────────────────────────────
    const performSearch = async () => {
        const ch1 = document.getElementById('channel1').value.trim();
        const ch2 = document.getElementById('channel2').value.trim();
        if (!ch1) return;

        errorMsg.classList.add('hidden');
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        submitBtn.disabled = true;

        const refreshBtn = document.querySelector('.btn-refresh');
        if (refreshBtn) refreshBtn.classList.add('loading');

        try {
            if (ch2) {
                const res = await fetch(`/compare?channel_id_1=${encodeURIComponent(ch1)}&channel_id_2=${encodeURIComponent(ch2)}`);
                if (!res.ok) throw new Error('Failed to fetch comparison data');
                const data = await res.json();
                renderComparison(data);
            } else {
                const res = await fetch(`/analyze?channel_id=${encodeURIComponent(ch1)}`);
                if (!res.ok) throw new Error('Channel not found or API error');
                const data = await res.json();
                renderSingleAnalysis(data);
            }
            resultsContainer.classList.remove('hidden');
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
        } finally {
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            submitBtn.disabled = false;
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        resultsContainer.innerHTML = '';
        await performSearch();
    });

    // ── Helpers ────────────────────────────────────────────────────
    function formatNumber(num) {
        if (!num) return 0;
        return new Intl.NumberFormat().format(num);
    }
    function formatCompact(num) {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
        return String(Math.round(num));
    }

    /**
     * Creates a standard insight card. If isEngagement=true, the label row
     * includes a small ℹ️ button that opens the formula modal.
     */
    function createInsightCard(label, val, isEngagement = false) {
        const labelHtml = isEngagement
            ? `<div class="label-row">
                   <span class="label">${label}</span>
                   <button class="btn-info" title="How is this calculated?" aria-label="Show engagement rate formula">ℹ</button>
               </div>`
            : `<div class="label">${label}</div>`;

        return `
            <div class="insight-card">
                ${labelHtml}
                <div class="val">${val !== null && val !== undefined ? val : 'N/A'}</div>
            </div>
        `;
    }

    /**
     * Builds a mini bar chart from upload_hours_history.
     * @param {Object} hoursHistory  - { "hour": avgViews, ... }
     * @param {number|null} bestHour - the hour with the highest avg views
     */
    function buildHourChart(hoursHistory, bestHour) {
        if (!hoursHistory || Object.keys(hoursHistory).length === 0) return '';

        const entries = Object.entries(hoursHistory)
            .map(([h, v]) => ({ hour: parseInt(h, 10), views: v }))
            .sort((a, b) => a.hour - b.hour);

        const maxViews = Math.max(...entries.map(e => e.views));

        const bars = entries.map(({ hour, views }) => {
            const isBest = hour === bestHour;
            const heightPct = maxViews > 0 ? Math.max(5, Math.round((views / maxViews) * 100)) : 5;
            const label = `${hour}:00`;
            const tooltip = `${label} UTC — avg ${formatNumber(views)} views`;
            return `
                <div class="hour-bar-col" title="${tooltip}">
                    <div class="hour-bar${isBest ? ' best' : ''}" style="height:${heightPct}%"></div>
                    <span class="hour-label${isBest ? ' best' : ''}">${hour}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="hour-chart-wrap">
                <div class="hour-chart-title">Upload Hour Activity (UTC) — hover for detail</div>
                <div class="hour-bars">${bars}</div>
            </div>
        `;
    }

    /**
     * Full-size animated 24-bar chart rendered inside the hours modal.
     * Bars are also click-interactive — clicking shows a detail panel.
     * @param {Object} hoursHistory  - { hour_int: avg_views, ... }
     * @param {number|null} bestHour
     */
    function buildFullHourChart(hoursHistory, bestHour) {
        if (!hoursHistory || Object.keys(hoursHistory).length === 0) {
            return '<p class="fhb-empty">No upload hour data available for this channel.</p>';
        }

        // Normalise string keys → integer keys
        const norm = {};
        Object.entries(hoursHistory).forEach(([h, v]) => { norm[parseInt(h, 10)] = v; });

        const maxViews = Math.max(...Object.values(norm), 1);
        const CHART_H = 150; // px

        const bars = Array.from({ length: 24 }, (_, hour) => {
            const views = norm[hour] ?? 0;
            const isBest = hour === bestHour;
            const hasData = views > 0;
            const hPx = hasData ? Math.max(4, Math.round((views / maxViews) * CHART_H)) : 0;
            const tip = hasData
                ? `${hour}:00 UTC — avg ${formatNumber(Math.round(views))} views`
                : `${hour}:00 UTC — no uploads recorded`;
            return `<div class="fhb-bar${isBest ? ' fhb-bar--best' : ''}${!hasData ? ' fhb-bar--empty' : ''}"
                         data-hour="${hour}"
                         data-views="${Math.round(views)}"
                         data-best-hour="${bestHour ?? ''}"
                         data-best-views="${bestHour != null ? Math.round(norm[bestHour] ?? 0) : 0}"
                         data-max-views="${Math.round(maxViews)}"
                         data-h="${hPx}" style="height:0px" title="${tip}"></div>`;
        }).join('');

        const labels = Array.from({ length: 24 }, (_, h) =>
            `<span class="${h === bestHour ? 'best' : ''}">${h}</span>`
        ).join('');

        const bestViews = bestHour != null ? (norm[bestHour] ?? 0) : 0;
        const recorded = Object.keys(norm).length;

        return `
            <p class="fhb-subtitle">Average views per video by hour of upload (UTC)
                &nbsp;·&nbsp; <span class="fhb-hint">👆 Click a bar for details</span>
            </p>
            ${bestHour != null ? `
                <div class="fhb-best-badge">
                    ⭐ Peak hour: <strong>${bestHour}:00 UTC</strong>
                    — avg <strong>${formatCompact(Math.round(bestViews))}</strong> views
                </div>` : ''}
            <div class="fhb-chart-scroll">
                <div class="fhb-bars">${bars}</div>
                <div class="fhb-labels">${labels}</div>
            </div>
            <p class="fhb-x-label">Hour of day (UTC, 0 – 23)</p>
            <p class="fhb-note">${recorded} upload hour(s) recorded · grey stubs = no uploads at that hour</p>
            <div class="fhb-detail-panel" id="fhb-detail-panel"></div>
        `;
    }

    /**
     * Renders the clicked-bar detail panel content.
     */
    function renderHourDetail(hour, views, bestHour, bestViews, maxViews) {
        const hasData = views > 0;
        const isBest = hour === bestHour && bestViews > 0;
        const pctOfBest = (bestViews > 0 && hasData) ? Math.round((views / bestViews) * 100) : 0;

        // Performance label
        let perfLabel, perfClass;
        if (!hasData) {
            perfLabel = 'No Data'; perfClass = 'neutral';
        } else if (isBest) {
            perfLabel = '🏆 Peak Hour'; perfClass = 'peak';
        } else if (pctOfBest >= 80) {
            perfLabel = '🔥 Excellent'; perfClass = 'excellent';
        } else if (pctOfBest >= 55) {
            perfLabel = '✅ Good'; perfClass = 'good';
        } else if (pctOfBest >= 30) {
            perfLabel = '⚠️ Below Avg'; perfClass = 'below';
        } else {
            perfLabel = '❌ Low'; perfClass = 'low';
        }

        // Recommendation tip
        let tip = '';
        if (!hasData) {
            tip = 'No videos were uploaded at this hour in the data sample.';
        } else if (isBest) {
            tip = `This is your peak upload hour! Posting at ${hour}:00 UTC maximises average views.`;
        } else if (bestHour != null && bestViews > 0) {
            const diff = bestHour > hour
                ? `${bestHour - hour}h later at ${bestHour}:00 UTC`
                : `${hour - bestHour}h earlier at ${bestHour}:00 UTC`;
            tip = `Posting ${diff} could yield ~${formatCompact(bestViews)} avg views instead of ${formatCompact(views)}.`;
        }

        const progressBar = `
            <div class="fhb-detail-bar-wrap">
                <div class="fhb-detail-bar-track">
                    <div class="fhb-detail-bar-fill fhb-detail-bar-fill--${perfClass}"
                         style="width:${pctOfBest}%"></div>
                </div>
                <span class="fhb-detail-bar-label">${pctOfBest}% of peak</span>
            </div>`;

        return `
            <div class="fhb-detail-inner">
                <div class="fhb-detail-hour">
                    <span class="fhb-detail-clock">🕐</span>
                    <div>
                        <div class="fhb-detail-time">${hour}:00 UTC</div>
                        <div class="fhb-detail-perf fhb-detail-perf--${perfClass}">${perfLabel}</div>
                    </div>
                </div>
                <div class="fhb-detail-stats">
                    <div class="fhb-detail-stat">
                        <div class="fhb-detail-stat-val">${hasData ? formatCompact(views) : '—'}</div>
                        <div class="fhb-detail-stat-lbl">Avg Views</div>
                    </div>
                    <div class="fhb-detail-stat">
                        <div class="fhb-detail-stat-val">${hasData ? pctOfBest + '%' : '—'}</div>
                        <div class="fhb-detail-stat-lbl">vs Peak Hour</div>
                    </div>
                    <div class="fhb-detail-stat">
                        <div class="fhb-detail-stat-val">${bestHour != null ? bestHour + ':00' : '—'}</div>
                        <div class="fhb-detail-stat-lbl">Best Hour</div>
                    </div>
                </div>
                ${hasData ? progressBar : ''}
                ${tip ? `<p class="fhb-detail-tip">${tip}</p>` : ''}
            </div>
        `;
    }

    // ── Single Analysis Renderer ───────────────────────────────────
    function renderSingleAnalysis(data) {
        const insights = data.insights;
        const hoursHistory = insights.upload_hours_history || {};
        const bestHour = insights.best_upload_hour_utc;

        const html = `
            <div class="channel-header">
                <h2>${insights.channel_title || 'Unknown Channel'}</h2>
            </div>
            ${insights.error ? `
            <div class="warning-notice">
                <span class="icon">⚠️</span>
                <span>${insights.error}</span>
            </div>
            ` : ''}
            <div class="results-grid">
                ${createInsightCard('Subscribers', formatNumber(insights.subscribers))}
                ${createInsightCard('Total Views', formatNumber(insights.total_views))}
                ${createInsightCard('Video Count', formatNumber(insights.video_count))}
                ${createInsightCard('Engagement Rate', insights.average_engagement_rate_percent ? insights.average_engagement_rate_percent + '%' : '0%', true)}
                <div class="insight-card card-upload-hours"
                     role="button" tabindex="0"
                     title="Click to view full upload hour chart"
                     data-hours='${JSON.stringify(hoursHistory)}'
                     data-best="${bestHour}">
                    <div class="label">Best Upload Hour (UTC)</div>
                    <div class="val">${bestHour !== null && bestHour !== undefined ? bestHour + ':00' : 'N/A'}</div>
                    ${buildHourChart(hoursHistory, bestHour)}
                    <div class="card-cta">📊 Expand Full Chart</div>
                </div>
                ${createInsightCard('Avg Upload Freq (Days)', insights.avg_days_between_uploads)}
            </div>
            <div class="refresh-container">
                <button class="btn-refresh">
                    <span class="icon">↻</span>
                    <span>Refresh Stats</span>
                </button>
            </div>
        `;
        resultsContainer.innerHTML = html;
    }

    // ── Comparison Renderer ────────────────────────────────────────
    function renderComparison(data) {
        const c1 = data.comparison.channel_1;
        const c2 = data.comparison.channel_2;
        const winner = data.conclusion.higher_engagement;

        const renderCol = (insights) => {
            const hoursHistory = insights.upload_hours_history || {};
            const bestHour = insights.best_upload_hour_utc;

            return `
                <div class="channel-header" style="margin-bottom: 1rem;">
                    <h3>${insights.channel_title || 'Unknown Channel'}</h3>
                </div>
                ${insights.error ? `
                <div class="warning-notice" style="margin-bottom: 1rem; padding: 0.75rem;">
                    <span class="icon" style="font-size: 1rem;">⚠️</span>
                    <span style="font-size: 0.8rem;">Partial data: ${insights.error}</span>
                </div>
                ` : ''}
                <div class="results-grid" style="display: flex; flex-direction: column;">
                    ${createInsightCard('Subscribers', formatNumber(insights.subscribers))}
                    ${createInsightCard('Engagement Rate', insights.average_engagement_rate_percent ? insights.average_engagement_rate_percent + '%' : '0%', true)}
                    <div class="insight-card card-upload-hours"
                         role="button" tabindex="0"
                         title="Click to view full upload hour chart"
                         data-hours='${JSON.stringify(hoursHistory)}'
                         data-best="${bestHour}">
                        <div class="label">Best Upload Hour</div>
                        <div class="val">${bestHour !== null && bestHour !== undefined ? bestHour + ':00' : 'N/A'}</div>
                        ${buildHourChart(hoursHistory, bestHour)}
                        <div class="card-cta">📊 Expand Full Chart</div>
                    </div>
                </div>
            `;
        };

        const html = `
            <div class="comparison-wrapper">
                <div class="comparison-col glass-panel">${renderCol(c1)}</div>
                <div class="comparison-col glass-panel">${renderCol(c2)}</div>
            </div>
            <div class="refresh-container">
                <button class="btn-refresh">
                    <span class="icon">↻</span>
                    <span>Refresh Comparison</span>
                </button>
            </div>
        `;
        resultsContainer.innerHTML = html;
    }
});
