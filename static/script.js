document.addEventListener('DOMContentLoaded', () => {
    // ── Elements ──────────────────────────────────────────────────
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

    // Auth Elements
    const authModal = document.getElementById('auth-modal');
    const authModalClose = document.getElementById('auth-modal-close');
    const openAuthModalBtn = document.getElementById('open-auth-modal');
    const authTabLogin = document.getElementById('tab-login');
    const authTabSignup = document.getElementById('tab-signup');
    const authLoginPanel = document.getElementById('auth-login-panel');
    const authSignupPanel = document.getElementById('auth-signup-panel');
    const authConfirmPanel = document.getElementById('auth-confirm-panel');
    const authErrorDiv = document.getElementById('auth-error');
    const authSuccessDiv = document.getElementById('auth-success');
    const signedOutDiv = document.getElementById('auth-signed-out');
    const signedInDiv = document.getElementById('auth-signed-in');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const userDropdownEmail = document.getElementById('user-dropdown-email');
    const userInitialSpan = document.getElementById('user-initial');
    const signoutBtn = document.getElementById('signout-btn');
    const viewSavedBtn = document.getElementById('view-saved-btn');

    // Chat Elements
    const chatFab = document.getElementById('chat-fab');
    const chatPanel = document.getElementById('chat-panel');
    const chatCloseBtn = document.getElementById('chat-close');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send');

    // FAQ Elements
    const faqList = document.getElementById('faq-list');
    const faqPlayer = document.getElementById('faq-player');
    const faqPlaceholder = document.getElementById('faq-placeholder');
    const faqNowPlaying = document.getElementById('faq-now-playing');
    const faqPlayingTitle = document.getElementById('faq-playing-title');

    // State Variables
    let userPool = null;
    let cognitoConfig = null;
    let jwtToken = localStorage.getItem('jwtToken') || null;
    let currentChannelInsights = null;

    // ── Cognito Configuration and Initialization ────────────────
    const fetchConfig = async () => {
        try {
            const res = await fetch('/config');
            cognitoConfig = await res.json();
            if (cognitoConfig.features.auth && typeof AmazonCognitoIdentity !== 'undefined') {
                const poolData = {
                    UserPoolId: cognitoConfig.cognitoUserPoolId,
                    ClientId: cognitoConfig.cognitoClientId
                };
                userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
                checkSession();
            } else {
                signedOutDiv.classList.add('hidden');
            }
        } catch (e) {
            console.warn('Failed to load Cognito config:', e);
            signedOutDiv.classList.add('hidden');
        }
    };

    const authenticatedFetch = async (url, options = {}) => {
        if (jwtToken) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${jwtToken}`
            };
        }
        return fetch(url, options);
    };

    // ── Session & UI state management ─────────────────────────────
    function checkSession() {
        if (!userPool) return;
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser != null) {
            cognitoUser.getSession((err, session) => {
                if (err) {
                    console.error('Session error:', err);
                    showSignedOut();
                    return;
                }
                if (session.isValid()) {
                    jwtToken = session.getIdToken().getJwtToken();
                    localStorage.setItem('jwtToken', jwtToken);
                    const email = session.getIdToken().payload.email || cognitoUser.getUsername();
                    showSignedIn(email);
                } else {
                    showSignedOut();
                }
            });
        } else {
            showSignedOut();
        }
    }

    function checkUrlHash() {
        const hash = window.location.hash;
        if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const idToken = params.get('id_token');
            if (idToken) {
                jwtToken = idToken;
                localStorage.setItem('jwtToken', jwtToken);
                window.location.hash = ''; // clear hash
                try {
                    const claims = JSON.parse(atob(idToken.split('.')[1]));
                    showSignedIn(claims.email || 'User');
                } catch (e) {
                    console.error('Failed to parse external token:', e);
                }
            }
        }
    }

    function showSignedIn(email) {
        signedOutDiv.classList.add('hidden');
        signedInDiv.classList.remove('hidden');
        userDropdownEmail.textContent = email;
        userInitialSpan.textContent = email.charAt(0).toUpperCase();
        loadChatHistory();
    }

    function showSignedOut() {
        signedInDiv.classList.add('hidden');
        signedOutDiv.classList.remove('hidden');
        jwtToken = null;
        localStorage.removeItem('jwtToken');
        clearChatPanel();
    }

    // ── Auth Actions ──────────────────────────────────────────────
    function clearAuthMessages() {
        authErrorDiv.classList.add('hidden');
        authErrorDiv.textContent = '';
        authSuccessDiv.classList.add('hidden');
        authSuccessDiv.textContent = '';
    }

    function showAuthError(msg) {
        authSuccessDiv.classList.add('hidden');
        authErrorDiv.textContent = msg;
        authErrorDiv.classList.remove('hidden');
    }

    function showAuthSuccess(msg) {
        authErrorDiv.classList.add('hidden');
        authSuccessDiv.textContent = msg;
        authSuccessDiv.classList.remove('hidden');
    }

    function switchAuthTab(tab) {
        clearAuthMessages();
        if (tab === 'login') {
            authTabLogin.classList.add('active');
            authTabSignup.classList.remove('active');
            authLoginPanel.classList.remove('hidden');
            authSignupPanel.classList.add('hidden');
            authConfirmPanel.classList.add('hidden');
            document.getElementById('auth-modal-title').textContent = 'Welcome Back';
        } else {
            authTabLogin.classList.remove('active');
            authTabSignup.classList.add('active');
            authLoginPanel.classList.add('hidden');
            authSignupPanel.classList.remove('hidden');
            authConfirmPanel.classList.add('hidden');
            document.getElementById('auth-modal-title').textContent = 'Create Account';
        }
    }

    function showConfirmPanel(email) {
        authLoginPanel.classList.add('hidden');
        authSignupPanel.classList.add('hidden');
        authConfirmPanel.classList.remove('hidden');
        document.getElementById('auth-modal-title').textContent = 'Verify Email';
        // store email for code confirmation
        authConfirmPanel.dataset.email = email;
    }

    // Email + Password signup
    document.getElementById('signup-submit-btn').addEventListener('click', () => {
        const email = document.getElementById('auth-signup-email').value.trim();
        const password = document.getElementById('auth-signup-password').value.trim();
        if (!email || !password) {
            showAuthError("Please fill out all fields.");
            return;
        }
        if (!userPool) return;

        const attributeList = [];
        const dataEmail = { Name: 'email', Value: email };
        const attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute(dataEmail);
        attributeList.push(attributeEmail);

        userPool.signUp(email, password, attributeList, null, (err, result) => {
            if (err) {
                showAuthError(err.message || "Signup failed.");
                return;
            }
            showAuthSuccess("Verification code sent to email.");
            showConfirmPanel(email);
        });
    });

    // Confirm Registration
    document.getElementById('confirm-submit-btn').addEventListener('click', () => {
        const email = authConfirmPanel.dataset.email;
        const code = document.getElementById('auth-confirm-code').value.trim();
        if (!code) {
            showAuthError("Please enter the confirmation code.");
            return;
        }

        const userData = { Username: email, Pool: userPool };
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
        cognitoUser.confirmRegistration(code, true, (err, result) => {
            if (err) {
                showAuthError(err.message || "Verification failed.");
                return;
            }
            showAuthSuccess("Verification successful! You can now sign in.");
            switchAuthTab('login');
        });
    });

    // Email + Password login
    document.getElementById('login-submit-btn').addEventListener('click', () => {
        const email = document.getElementById('auth-login-email').value.trim();
        const password = document.getElementById('auth-login-password').value.trim();
        if (!email || !password) {
            showAuthError("Please fill out all fields.");
            return;
        }

        const authenticationData = { Username: email, Password: password };
        const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
        const userData = { Username: email, Pool: userPool };
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: (result) => {
                jwtToken = result.getIdToken().getJwtToken();
                localStorage.setItem('jwtToken', jwtToken);
                showSignedIn(email);
                closeAuthModal();
            },
            onFailure: (err) => {
                showAuthError(err.message || "Sign in failed.");
            }
        });
    });

    // Social Provider Google redirect
    const handleGoogleOAuth = () => {
        if (cognitoConfig && cognitoConfig.cognitoDomain) {
            // cognitoDomain is the full base URL e.g. https://xxx.auth.us-west-2.amazoncognito.com
            const domain = cognitoConfig.cognitoDomain.replace(/\/$/, ''); // strip trailing slash
            const clientId = cognitoConfig.cognitoClientId;
            const redirectUri = window.location.origin + '/';
            // Basic validation to surface common misconfigurations
            if (!domain.includes('.auth.') || !domain.includes('amazoncognito.com')) {
                alert('COGNITO_DOMAIN appears misconfigured. Please set the full Cognito domain (e.g. https://your-domain.auth.us-west-2.amazoncognito.com) in environment variables.');
                return;
            }
            const url = `${domain}/oauth2/authorize?identity_provider=Google&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&client_id=${clientId}&scope=email+openid+profile`;
            window.location.href = url;
        } else {
            alert("Google Sign-In requires COGNITO_DOMAIN configured in environment variables.");
        }
    };
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleOAuth);
    document.getElementById('google-signup-btn').addEventListener('click', handleGoogleOAuth);

    // Sign out
    signoutBtn.addEventListener('click', () => {
        if (userPool) {
            const cognitoUser = userPool.getCurrentUser();
            if (cognitoUser) {
                cognitoUser.signOut();
            }
        }
        showSignedOut();
        userDropdown.classList.add('hidden');
    });

    // Toggle dropdown
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
        userDropdown.classList.add('hidden');
    });

    // Modal actions
    function openAuthModal() {
        clearAuthMessages();
        switchAuthTab('login');
        authModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    function closeAuthModal() {
        authModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    openAuthModalBtn.addEventListener('click', openAuthModal);
    authModalClose.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    authTabLogin.addEventListener('click', () => switchAuthTab('login'));
    authTabSignup.addEventListener('click', () => switchAuthTab('signup'));

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

        requestAnimationFrame(() => requestAnimationFrame(() => {
            content.querySelectorAll('.fhb-bar:not(.fhb-bar--empty)').forEach(bar => {
                bar.style.height = bar.dataset.h + 'px';
            });
        }));

        content.addEventListener('click', (e) => {
            const bar = e.target.closest('.fhb-bar');
            if (!bar) return;

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
        if (e.key === 'Escape') {
            closeModal();
            closeHoursModal();
            closeAuthModal();
        }
    });

    // Delegated click: info btn, refresh btn, upload hours card, save channel
    document.addEventListener('click', async (e) => {
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

        const saveBtn = e.target.closest('#save-channel-btn');
        if (saveBtn) {
            if (!jwtToken) {
                openAuthModal();
                showAuthError("Please sign in to save channels to your account.");
                return;
            }
            const channelId = saveBtn.dataset.id;
            try {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                const res = await authenticatedFetch(`/user/channels/${channelId}`, { method: 'POST' });
                if (res.ok) {
                    saveBtn.textContent = 'Saved ✅';
                    saveBtn.style.background = 'rgba(52, 211, 153, 0.15)';
                    saveBtn.style.color = '#34d399';
                } else {
                    saveBtn.textContent = 'Error ❌';
                    saveBtn.disabled = false;
                }
            } catch (err) {
                console.error(err);
                saveBtn.textContent = 'Error ❌';
                saveBtn.disabled = false;
            }
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
                const res = await authenticatedFetch(`/compare?channel_id_1=${encodeURIComponent(ch1)}&channel_id_2=${encodeURIComponent(ch2)}`);
                if (!res.ok) throw new Error('Failed to fetch comparison data');
                const data = await res.json();
                currentChannelInsights = null; // Comparison is active, clear context
                renderComparison(data);
            } else {
                const res = await authenticatedFetch(`/analyze?channel_id=${encodeURIComponent(ch1)}`);
                if (!res.ok) throw new Error('Channel not found or API error');
                const data = await res.json();
                currentChannelInsights = data.insights;
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

    function buildFullHourChart(hoursHistory, bestHour) {
        if (!hoursHistory || Object.keys(hoursHistory).length === 0) {
            return '<p class="fhb-empty">No upload hour data available for this channel.</p>';
        }

        const norm = {};
        Object.entries(hoursHistory).forEach(([h, v]) => { norm[parseInt(h, 10)] = v; });

        const maxViews = Math.max(...Object.values(norm), 1);
        const CHART_H = 150;

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
            <div class="fhb-detail-panel" id="fhb-detail-panel"></div>
        `;
    }

    function renderHourDetail(hour, views, bestHour, bestViews, maxViews) {
        const hasData = views > 0;
        const isBest = hour === bestHour && bestViews > 0;
        const pctOfBest = (bestViews > 0 && hasData) ? Math.round((views / bestViews) * 100) : 0;

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
        const sampleSize = insights.recent_video_sample_size || 0;
        const normalPct = sampleSize ? (100 - (insights.shorts_percentage || 0)).toFixed(1) : 0;

        const html = `
            <div class="channel-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <h2>${insights.channel_title || 'Unknown Channel'}</h2>
                <button class="btn-save-channel" id="save-channel-btn" data-id="${insights.channel_id || data.channel_id}">
                    📌 Save Channel
                </button>
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
                ${createInsightCard('Video Count (Total)', formatNumber(insights.video_count))}
                ${createInsightCard(`Shorts (Sample of ${sampleSize})`, `${insights.shorts_count || 0} (${insights.shorts_percentage || 0}%)`)}
                ${createInsightCard(`Videos (Sample of ${sampleSize})`, `${insights.normal_video_count || 0} (${normalPct}%)`)}
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

        const renderCol = (insights) => {
            const hoursHistory = insights.upload_hours_history || {};
            const bestHour = insights.best_upload_hour_utc;
            const sampleSize = insights.recent_video_sample_size || 0;
            const normalPct = sampleSize ? (100 - (insights.shorts_percentage || 0)).toFixed(1) : 0;

            return `
                <div class="channel-header" style="margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center;">
                    <h3>${insights.channel_title || 'Unknown Channel'}</h3>
                    <button class="btn-save-channel" id="save-channel-btn" data-id="${insights.channel_id || insights.youtube_id || ''}">
                        📌 Save
                    </button>
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
                    ${createInsightCard(`Shorts (Sample of ${sampleSize})`, `${insights.shorts_count || 0} (${insights.shorts_percentage || 0}%)`)}
                    ${createInsightCard(`Videos (Sample of ${sampleSize})`, `${insights.normal_video_count || 0} (${normalPct}%)`)}
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

    // ── FAQ Setup ─────────────────────────────────────────────────
    function initFAQ() {
        if (typeof FAQ_CONFIG === 'undefined' || !FAQ_CONFIG.length) return;
        faqList.innerHTML = FAQ_CONFIG.map((item, idx) => `
            <button class="faq-item" data-index="${idx}">
                <div>${item.question}</div>
                <div class="faq-item-desc">${item.description || ''}</div>
            </button>
        `).join('');

        // Bind clicks
        faqList.querySelectorAll('.faq-item').forEach(btn => {
            btn.addEventListener('click', () => {
                faqList.querySelectorAll('.faq-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const idx = parseInt(btn.dataset.index, 10);
                const configItem = FAQ_CONFIG[idx];
                loadFAQVideo(configItem);
            });
        });
    }

    function loadFAQVideo(item) {
        if (!item.videoId || item.videoId.startsWith('PLACEHOLDER')) {
            faqPlaceholder.classList.remove('hidden');
            faqPlayer.classList.add('hidden');
            faqNowPlaying.classList.add('hidden');
            return;
        }

        faqPlaceholder.classList.add('hidden');
        faqPlayer.classList.remove('hidden');
        faqPlayer.src = `https://www.youtube.com/embed/${item.videoId}?autoplay=1`;
        faqNowPlaying.classList.remove('hidden');
        faqPlayingTitle.textContent = item.question;
    }

    // ── Chatbot UI & Messaging ────────────────────────────────────
    function toggleChatPanel() {
        chatPanel.classList.toggle('visible');
        if (chatPanel.classList.contains('visible')) {
            chatInput.focus();
            scrollToBottom();
        }
    }

    chatFab.addEventListener('click', toggleChatPanel);
    chatCloseBtn.addEventListener('click', () => chatPanel.classList.remove('visible'));

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendMessage(role, content) {
        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg chat-msg--${role === 'user' ? 'user' : 'ai'}`;

        // Simple HTML sanitizing/formatting for line breaks
        const formattedContent = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");

        msgDiv.innerHTML = `<div>${formattedContent}</div>`;
        chatMessages.appendChild(msgDiv);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-typing';
        typingDiv.id = 'chat-typing-indicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(typingDiv);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('chat-typing-indicator');
        if (indicator) indicator.remove();
    }

    async function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = '';
        appendMessage('user', text);
        showTypingIndicator();

        try {
            const res = await authenticatedFetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    channel_insights: currentChannelInsights
                })
            });

            removeTypingIndicator();

            if (res.ok) {
                const data = await res.json();
                appendMessage('assistant', data.reply);
            } else {
                if (res.status === 401) {
                    appendMessage('assistant', "🔒 Chat history is saved to accounts. Please sign in to message the AI.");
                } else {
                    appendMessage('assistant', "⚠️ I'm having trouble connecting to the server. Please try again.");
                }
            }
        } catch (e) {
            removeTypingIndicator();
            appendMessage('assistant', "⚠️ Network error. Please check your connection.");
        }
    }

    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    async function loadChatHistory() {
        if (!jwtToken) return;
        try {
            const res = await authenticatedFetch('/chat/history');
            if (res.ok) {
                const data = await res.json();
                if (data.history && data.history.length > 0) {
                    chatMessages.innerHTML = ''; // clear welcome
                    data.history.forEach(msg => {
                        appendMessage(msg.role, msg.content);
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to load chat history:', e);
        }
    }

    function clearChatPanel() {
        chatMessages.innerHTML = `
            <div class="chat-welcome">
                <div class="chat-welcome-icon">✨</div>
                <p>Hi! Analyze a channel first, then ask me anything about it — growth strategy, best upload times, engagement tips, and more.</p>
                <p class="chat-welcome-note">Sign in to save your conversation history.</p>
            </div>
        `;
    }

    // ── Saved Channels View ───────────────────────────────────────
    viewSavedBtn.addEventListener('click', async () => {
        userDropdown.classList.add('hidden');
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('hidden');

        try {
            resultsContainer.innerHTML = '<div style="text-align:center; padding: 2rem;"><div class="loader" style="margin: 0 auto 1rem;"></div>Loading saved channels...</div>';
            const res = await authenticatedFetch('/user/channels');
            if (!res.ok) throw new Error("Failed to load saved channels");
            const data = await res.json();

            if (!data.channels || data.channels.length === 0) {
                resultsContainer.innerHTML = `
                    <div style="text-align:center; padding:3rem 1.5rem;" class="glass-panel">
                        <h3 style="margin-bottom:0.5rem;">No Saved Channels Yet</h3>
                        <p style="color:var(--text-secondary); font-size:0.95rem; margin-bottom:1.5rem;">Channels you pin will show up here for quick access.</p>
                    </div>
                `;
                return;
            }

            let cardsHtml = data.channels.map(ch => {
                let insights = {};
                try {
                    insights = typeof ch.insights === 'string' ? JSON.parse(ch.insights) : ch.insights;
                } catch (e) { console.error(e); }

                return `
                    <div class="insight-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <h4 style="font-size:1.15rem; font-weight:700; margin-bottom:0.25rem;">${ch.channel_title || 'Channel'}</h4>
                            <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:1rem;">ID: ${ch.channel_id}</p>
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.5rem;">
                                <span style="color:var(--text-secondary)">Subscribers:</span>
                                <span style="font-weight:600">${formatCompact(insights.subscribers)}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.5rem;">
                                <span style="color:var(--text-secondary)">Engagement:</span>
                                <span style="font-weight:600">${insights.average_engagement_rate_percent || 0}%</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                            <button class="btn-refresh quick-load-btn" data-id="${ch.channel_id}" style="flex:1; padding:0.4rem 0.8rem; font-size:0.8rem; justify-content:center;">
                                Load Metrics
                            </button>
                            <button class="btn-refresh quick-delete-btn" data-id="${ch.channel_id}" style="border-color:rgba(239,68,68,0.3); color:#f87171; padding:0.4rem 0.8rem; font-size:0.8rem; justify-content:center;">
                                Remove
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            resultsContainer.innerHTML = `
                <div class="channel-header">
                    <h2>📌 Your Saved Channels</h2>
                </div>
                <div class="results-grid">
                    ${cardsHtml}
                </div>
            `;

            // Bind Load and Delete click actions
            resultsContainer.querySelectorAll('.quick-load-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.getElementById('channel1').value = btn.dataset.id;
                    document.getElementById('channel2').value = '';
                    performSearch();
                });
            });

            resultsContainer.querySelectorAll('.quick-delete-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const channelId = btn.dataset.id;
                    try {
                        btn.disabled = true;
                        btn.textContent = 'Removing...';
                        const delRes = await authenticatedFetch(`/user/channels/${channelId}`, { method: 'DELETE' });
                        if (delRes.ok) {
                            viewSavedBtn.click(); // refresh list
                        } else {
                            btn.disabled = false;
                            btn.textContent = 'Remove';
                        }
                    } catch (e) {
                        btn.disabled = false;
                        btn.textContent = 'Remove';
                    }
                });
            });

        } catch (e) {
            resultsContainer.innerHTML = `<div class="error-message">${e.message}</div>`;
        }
    });

    // ── Start Init ────────────────────────────────────────────────
    fetchConfig();
    checkUrlHash();
    initFAQ();
});
