class LibraryController {
    constructor() {
        this.currentEntryId = null;
        this.entries = [];

        this.searchInput = document.getElementById('library-search-input');
        this.dateFrom = document.getElementById('library-date-from');
        this.dateTo = document.getElementById('library-date-to');
        this.searchBtn = document.getElementById('library-search-btn');
        this.clearBtn = document.getElementById('library-clear-btn');
        this.reindexBtn = document.getElementById('library-reindex-btn');
        this.resultsEl = document.getElementById('library-results');

        this.detailEmpty = document.getElementById('library-detail-empty');
        this.detailContent = document.getElementById('library-detail-content');
        this.detailTitle = document.getElementById('library-detail-title');
        this.detailDate = document.getElementById('library-detail-date');
        this.detailSource = document.getElementById('library-detail-source');
        this.detailWords = document.getElementById('library-detail-words');
        this.detailLabels = document.getElementById('library-detail-labels');
        this.detailSummary = document.getElementById('library-detail-summary-text');
        this.detailText = document.getElementById('library-detail-text');
        this.copyBtn = document.getElementById('library-copy-btn');
        this.deleteBtn = document.getElementById('library-delete-btn');

        this.init();
    }

    init() {
        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', () => this.search());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearSearch());
        }
        if (this.reindexBtn) {
            this.reindexBtn.addEventListener('click', () => this.reindex());
        }
        if (this.searchInput) {
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.search();
            });
        }
        if (this.copyBtn) {
            this.copyBtn.addEventListener('click', () => this.copyCurrentText());
        }
        if (this.deleteBtn) {
            this.deleteBtn.addEventListener('click', () => this.deleteCurrentEntry());
        }
    }

    async load() {
        await this.search();
    }

    async search() {
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;

        const filters = {};
        if (this.searchInput && this.searchInput.value.trim()) {
            filters.query = this.searchInput.value.trim();
        }
        if (this.dateFrom && this.dateFrom.value) {
            filters.dateFrom = this.dateFrom.value;
        }
        if (this.dateTo && this.dateTo.value) {
            filters.dateTo = this.dateTo.value;
        }

        try {
            const result = await window.electronAPI.transcriptions.list(filters);
            this.entries = result.entries || [];
            this.renderResults(this.entries);
        } catch (err) {
            console.error('Library search error:', err);
            this.renderError('Failed to load transcriptions: ' + err.message);
        }
    }

    clearSearch() {
        if (this.searchInput) this.searchInput.value = '';
        if (this.dateFrom) this.dateFrom.value = '';
        if (this.dateTo) this.dateTo.value = '';
        this.search();
    }

    async reindex() {
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;
        try {
            if (this.reindexBtn) this.reindexBtn.disabled = true;
            const result = await window.electronAPI.transcriptions.reindex();
            await this.search();
            console.log('Reindex complete, count:', result.count);
        } catch (err) {
            console.error('Reindex error:', err);
        } finally {
            if (this.reindexBtn) this.reindexBtn.disabled = false;
        }
    }

    renderResults(entries) {
        if (!this.resultsEl) return;

        if (!entries || entries.length === 0) {
            this.resultsEl.innerHTML = '<div class="library-empty">No transcriptions found. Transcribe a file or recording to get started.</div>';
            return;
        }

        const html = entries.map(entry => {
            const date = entry.date ? new Date(entry.date).toLocaleDateString() : '';
            const labels = (entry.labels || []).map(l => `<span class="library-label">${this.escapeHtml(l)}</span>`).join('');
            const title = this.escapeHtml(entry.title || entry.sourceFile || entry.id);
            const summary = entry.summary ? this.escapeHtml(entry.summary.substring(0, 120)) + (entry.summary.length > 120 ? '…' : '') : '';
            const isActive = this.currentEntryId === entry.id ? ' active' : '';
            return `
                <div class="library-result-item${isActive}" data-id="${entry.id}">
                    <div class="library-result-title">${title}</div>
                    <div class="library-result-meta">
                        <span class="library-meta-tag">📅 ${date}</span>
                        ${entry.wordCount ? `<span class="library-meta-tag">📝 ${entry.wordCount} words</span>` : ''}
                    </div>
                    ${labels ? `<div class="library-labels">${labels}</div>` : ''}
                    ${summary ? `<div class="library-result-summary">${summary}</div>` : ''}
                </div>
            `;
        }).join('');

        this.resultsEl.innerHTML = html;

        this.resultsEl.querySelectorAll('.library-result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.resultsEl.querySelectorAll('.library-result-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                this.showDetail(item.dataset.id);
            });
        });
    }

    renderError(msg) {
        if (this.resultsEl) {
            this.resultsEl.innerHTML = `<div class="library-empty library-error">${this.escapeHtml(msg)}</div>`;
        }
    }

    async showDetail(id) {
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;

        this.currentEntryId = id;

        try {
            const result = await window.electronAPI.transcriptions.get(id);
            if (!result || !result.entry) {
                this.clearDetail();
                return;
            }

            const { entry, text } = result;
            const date = entry.date ? new Date(entry.date).toLocaleString() : '';

            if (this.detailTitle) this.detailTitle.textContent = entry.title || entry.sourceFile || entry.id;
            if (this.detailDate) this.detailDate.textContent = date ? '📅 ' + date : '';
            if (this.detailSource) this.detailSource.textContent = entry.sourceFile ? '🗂️ ' + entry.sourceFile : '';
            if (this.detailWords) this.detailWords.textContent = entry.wordCount ? '📝 ' + entry.wordCount + ' words' : '';

            if (this.detailLabels) {
                const labels = (entry.labels || []).map(l => `<span class="library-label">${this.escapeHtml(l)}</span>`).join('');
                this.detailLabels.innerHTML = labels;
            }

            if (this.detailSummary) this.detailSummary.textContent = entry.summary || '(no summary)';
            if (this.detailText) this.detailText.textContent = text || '';

            if (this.detailEmpty) this.detailEmpty.classList.add('hidden');
            if (this.detailContent) this.detailContent.classList.remove('hidden');

        } catch (err) {
            console.error('Failed to load transcription detail:', err);
            this.clearDetail();
        }
    }

    clearDetail() {
        this.currentEntryId = null;
        if (this.detailEmpty) this.detailEmpty.classList.remove('hidden');
        if (this.detailContent) this.detailContent.classList.add('hidden');
    }

    async copyCurrentText() {
        const text = this.detailText ? this.detailText.textContent : '';
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (this.copyBtn) {
                const orig = this.copyBtn.textContent;
                this.copyBtn.textContent = '✅ Copied';
                setTimeout(() => { this.copyBtn.textContent = orig; }, 1500);
            }
        } catch (err) {
            console.error('Copy failed:', err);
        }
    }

    async deleteCurrentEntry() {
        if (!this.currentEntryId) return;
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;

        const title = this.detailTitle ? this.detailTitle.textContent : this.currentEntryId;
        if (!confirm(`Delete transcription "${title}"? This cannot be undone.`)) return;

        try {
            await window.electronAPI.transcriptions.delete(this.currentEntryId);
            this.clearDetail();
            await this.search();
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete transcription: ' + err.message);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

window.LibraryController = LibraryController;

document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    function switchTab(tabName) {
        tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabName + '-tab'));

        if (tabName === 'library' && window._libraryController) {
            window._libraryController.load();
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab) switchTab(btn.dataset.tab);
        });
    });

    window._libraryController = new LibraryController();
});
