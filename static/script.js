document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('analyze-form');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const loader = submitBtn.querySelector('.loader');
    const errorMsg = document.getElementById('error-message');
    const resultsContainer = document.getElementById('results-container');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const ch1 = document.getElementById('channel1').value.trim();
        const ch2 = document.getElementById('channel2').value.trim();
        
        if (!ch1) return;

        // Reset UI
        errorMsg.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        submitBtn.disabled = true;

        try {
            if (ch2) {
                // Comparison Mode
                const res = await fetch(`/compare?channel_id_1=${encodeURIComponent(ch1)}&channel_id_2=${encodeURIComponent(ch2)}`);
                if (!res.ok) throw new Error('Failed to fetch comparison data');
                const data = await res.json();
                renderComparison(data);
            } else {
                // Analysis Mode
                const res = await fetch(`/analyze?channel_id=${encodeURIComponent(ch1)}`);
                if (!res.ok) throw new Error('Channel not found or API error');
                const data = await res.json();
                renderSingleAnalysis(data);
            }
            resultsContainer.classList.remove('hidden');
        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
        } finally {
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            submitBtn.disabled = false;
        }
    });

    function createInsightCard(label, val) {
        return `
            <div class="insight-card">
                <div class="label">${label}</div>
                <div class="val">${val !== null && val !== undefined ? val : 'N/A'}</div>
            </div>
        `;
    }

    function formatNumber(num) {
        if (!num) return 0;
        return new Intl.NumberFormat().format(num);
    }

    function renderSingleAnalysis(data) {
        const insights = data.insights;
        const html = `
            <div class="channel-header">
                <h2>${insights.channel_title || 'Unknown Channel'}</h2>
            </div>
            <div class="results-grid">
                ${createInsightCard('Subscribers', formatNumber(insights.subscribers))}
                ${createInsightCard('Total Views', formatNumber(insights.total_views))}
                ${createInsightCard('Video Count', formatNumber(insights.video_count))}
                ${createInsightCard('Engagement Rate', insights.average_engagement_rate_percent ? insights.average_engagement_rate_percent + '%' : '0%')}
                ${createInsightCard('Best Upload Hour (UTC)', insights.best_upload_hour_utc !== null ? insights.best_upload_hour_utc + ':00' : 'N/A')}
                ${createInsightCard('Avg Upload Freq (Days)', insights.avg_days_between_uploads)}
            </div>
        `;
        resultsContainer.innerHTML = html;
    }

    function renderComparison(data) {
        const c1 = data.comparison.channel_1;
        const c2 = data.comparison.channel_2;
        const winner = data.conclusion.higher_engagement;

        const renderCol = (insights) => `
            <div class="channel-header" style="margin-bottom: 1rem;">
                <h3>${insights.channel_title || 'Unknown Channel'}</h3>
            </div>
            <div class="results-grid" style="display: flex; flex-direction: column;">
                ${createInsightCard('Subscribers', formatNumber(insights.subscribers))}
                ${createInsightCard('Engagement Rate', insights.average_engagement_rate_percent ? insights.average_engagement_rate_percent + '%' : '0%')}
                ${createInsightCard('Best Upload Hour', insights.best_upload_hour_utc !== null ? insights.best_upload_hour_utc + ':00' : 'N/A')}
            </div>
        `;

        const winnerTitle = winner === document.getElementById('channel1').value.trim() 
                            ? (c1.channel_title || 'Primary Channel') 
                            : (c2.channel_title || 'Secondary Channel');

        const html = `
            <div class="comparison-wrapper">
                <div class="comparison-col glass-panel">${renderCol(c1)}</div>
                <div class="comparison-col glass-panel">${renderCol(c2)}</div>
            </div>
            <div class="winner-banner">
                🏆 ${winnerTitle} has the better overall engagement rate!
            </div>
        `;
        resultsContainer.innerHTML = html;
    }
});
