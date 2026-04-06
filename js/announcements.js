// Announcements Manager — flat ordered list, drag to reorder, swipe to delete

export class AnnouncementsManager {
  constructor(gameState, storage, tts, audioManager) {
    this.gameState = gameState;
    this.storage = storage;
    this.tts = tts;
    this.audioManager = audioManager;
    this.audioCache = {};
    this.draggedIndex = null;

    this.setupEventListeners();
  }

  setGameState(gameState) {
    this.gameState = gameState;
    this.audioCache = {};
  }

  clearAudioCache() {
    this.audioCache = {};
    this.render();
  }

  setupEventListeners() {
    document.getElementById('add-announcement-btn').addEventListener('click', () => {
      this.openModal();
    });

    document.getElementById('announcement-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('announcement-save').addEventListener('click', () => {
      this.saveAnnouncement();
    });

    document.getElementById('announcement-delete').addEventListener('click', () => {
      this.deleteAnnouncement();
    });

    const overlay = document.getElementById('announcement-modal');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });
  }

  render() {
    const announcements = this.gameState.announcements || [];
    const list = document.getElementById('announcement-list');

    if (announcements.length === 0) {
      list.innerHTML = '<div class="empty-list-msg">No announcements yet. Tap + to add one.</div>';
      return;
    }

    list.innerHTML = announcements.map((item, index) => {
      const isDynamic = item.type === 'dynamic';
      const isEdited = isDynamic && !!item.text;
      const hasCachedAudio = !!this.audioCache[item.id];
      const statusClass = isEdited ? 'edited' : (isDynamic ? 'auto' : (hasCachedAudio ? 'ready' : 'pending'));
      const statusText = isEdited ? 'EDITED' : (isDynamic ? 'AUTO' : (hasCachedAudio ? 'READY' : 'PENDING'));

      let actionBtn = '';
      if (hasCachedAudio) {
        actionBtn = `<button class="announcement-preview-btn" data-id="${item.id}" title="Preview (left channel)">PREVIEW</button>`;
      } else {
        actionBtn = `<button class="announcement-render-btn" data-id="${item.id}" title="Generate audio">RENDER</button>`;
      }

      const isFirst = index === 0;
      const isLast = index === announcements.length - 1;

      return `<div class="announcement-item-wrapper" data-index="${index}">
        <div class="announcement-swipe-bg">Delete</div>
        <div class="announcement-item" data-id="${item.id}" data-index="${index}">
          <div class="reorder-btns">
            <button class="reorder-btn" data-index="${index}" data-dir="up" ${isFirst ? 'disabled' : ''} title="Move up">&#9650;</button>
            <button class="reorder-btn" data-index="${index}" data-dir="down" ${isLast ? 'disabled' : ''} title="Move down">&#9660;</button>
          </div>
          <span class="announcement-title">${item.title}</span>
          <div class="announcement-controls">
            <span class="status-badge ${statusClass}">${statusText}</span>
            ${actionBtn}
            <button class="announcement-play-btn" data-id="${item.id}" title="Play to PA (right channel)">&#9654;</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // Click on title to edit
    list.querySelectorAll('.announcement-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.reorder-btns')) return;
        this.openModal(el.dataset.id);
      });
    });

    // Reorder buttons
    list.querySelectorAll('.reorder-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const dir = btn.dataset.dir;
        if (dir === 'up' && index > 0) {
          this.reorder(index, index - 1);
        } else if (dir === 'down' && index < announcements.length - 1) {
          this.reorder(index, index + 1);
        }
      });
    });

    // Render buttons
    list.querySelectorAll('.announcement-render-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.preRender(btn.dataset.id);
      });
    });

    // Preview buttons
    list.querySelectorAll('.announcement-preview-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.previewAnnouncement(btn.dataset.id);
      });
    });

    // Play buttons
    list.querySelectorAll('.announcement-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playAnnouncement(btn.dataset.id);
      });
    });

    // Swipe to delete
    this.setupSwipeDelete(list);
  }

  reorder(fromIndex, toIndex) {
    const announcements = this.gameState.announcements;
    const [moved] = announcements.splice(fromIndex, 1);
    announcements.splice(toIndex, 0, moved);
    this.storage.saveGame(this.gameState);
    this.render();
  }

  // ─── Swipe to Delete (touch) ───

  setupSwipeDelete(list) {
    const wrappers = list.querySelectorAll('.announcement-item-wrapper');

    wrappers.forEach(wrapper => {
      const item = wrapper.querySelector('.announcement-item');
      let startX = 0;
      let currentX = 0;
      let swiping = false;

      item.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = 0;
        swiping = true;
        item.style.transition = 'none';
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        if (!swiping) return;
        currentX = e.touches[0].clientX - startX;
        // Only allow swipe left (negative)
        if (currentX < 0) {
          item.style.transform = `translateX(${Math.max(currentX, -120)}px)`;
        }
      }, { passive: true });

      item.addEventListener('touchend', () => {
        swiping = false;
        item.style.transition = 'transform 0.25s ease';

        if (currentX < -80) {
          // Swiped far enough — delete
          item.style.transform = 'translateX(-100%)';
          const id = item.dataset.id;
          setTimeout(() => {
            this.gameState.announcements = this.gameState.announcements.filter(a => a.id !== id);
            delete this.audioCache[id];
            this.storage.saveGame(this.gameState);
            this.render();
          }, 250);
        } else {
          // Snap back
          item.style.transform = 'translateX(0)';
        }
      });
    });
  }

  // ─── Text Generation ───

  getAnnouncementText(item) {
    if (item.type !== 'dynamic') return item.text;
    // Dynamic items always regenerate from current score — never use stale text
    // Also clear any cached audio since score may have changed
    delete this.audioCache[item.id];
    return this.generateScoreText();
  }

  // ─── Audio ───

  async preRender(id) {
    const item = this.gameState.announcements.find(a => a.id === id);
    if (!item) return;

    const text = this.getAnnouncementText(item);
    if (!text) return;

    const btn = document.querySelector(`.announcement-render-btn[data-id="${id}"]`);
    if (btn) { btn.textContent = '...'; btn.disabled = true; }

    try {
      const audio = await this.tts.generateAudio(text);
      this.audioCache[id] = audio;
      this.render();
    } catch (err) {
      alert(`Render failed: ${err.message}`);
      if (btn) { btn.textContent = 'RENDER'; btn.disabled = false; }
    }
  }

  previewAnnouncement(id) {
    if (this.audioCache[id]) {
      this.audioManager.preview(this.audioCache[id]);
    }
  }

  async playAnnouncement(id) {
    const item = this.gameState.announcements.find(a => a.id === id);
    if (!item) return;

    if (this.audioCache[id]) {
      this.audioManager.play(this.audioCache[id]);
      return;
    }

    const text = this.getAnnouncementText(item);
    if (!text) return;

    const btn = document.querySelector(`.announcement-play-btn[data-id="${id}"]`);
    if (btn) { btn.textContent = '...'; btn.disabled = true; }

    try {
      const audio = await this.tts.generateAudio(text);
      this.audioCache[id] = audio;
      this.audioManager.play(audio);
      this.render();
    } catch (err) {
      alert(`Play failed: ${err.message}`);
    } finally {
      if (btn) { btn.innerHTML = '&#9654;'; btn.disabled = false; }
    }
  }

  // ─── Modal ───

  openModal(editId) {
    const modal = document.getElementById('announcement-modal');
    const titleInput = document.getElementById('announcement-title');
    const textInput = document.getElementById('announcement-text');
    const deleteBtn = document.getElementById('announcement-delete');
    const refreshBtn = document.getElementById('announcement-refresh');
    const dynamicCheckbox = document.getElementById('announcement-dynamic');
    const dynamicHint = document.getElementById('dynamic-hint');
    const modalTitle = document.getElementById('announcement-modal-title');

    dynamicCheckbox.onchange = () => {
      dynamicHint.style.display = dynamicCheckbox.checked ? 'block' : 'none';
      if (dynamicCheckbox.checked && !textInput.value.trim()) {
        textInput.value = this.generateScoreText();
      }
    };

    if (editId) {
      const item = this.gameState.announcements.find(a => a.id === editId);
      if (!item) return;
      modalTitle.textContent = 'Edit Announcement';
      titleInput.value = item.title;
      textInput.value = this.getAnnouncementText(item);
      dynamicCheckbox.checked = item.type === 'dynamic';
      dynamicHint.style.display = item.type === 'dynamic' ? 'block' : 'none';
      deleteBtn.style.display = 'block';
      modal.dataset.editId = editId;

      if (item.type === 'dynamic') {
        refreshBtn.style.display = 'block';
        refreshBtn.onclick = () => { textInput.value = this.generateScoreText(); };
      } else {
        refreshBtn.style.display = 'none';
      }
    } else {
      modalTitle.textContent = 'Add Announcement';
      titleInput.value = '';
      textInput.value = '';
      dynamicCheckbox.checked = false;
      dynamicHint.style.display = 'none';
      deleteBtn.style.display = 'none';
      refreshBtn.style.display = 'none';
      delete modal.dataset.editId;
    }

    modal.style.display = 'flex';
  }

  generateScoreText() {
    const homeTeam = this.gameState.homeTeam.mascot || this.gameState.homeTeam.name || 'Home';
    const awayTeam = this.gameState.awayTeam.mascot || this.gameState.awayTeam.name || 'Visiting';
    const { homeScore, awayScore } = this.gameState;
    if (homeScore === awayScore) {
      return `The score is tied, ${homeTeam} ${homeScore}, ${awayTeam} ${awayScore}.`;
    }
    const leader = homeScore > awayScore ? homeTeam : awayTeam;
    const trailer = homeScore > awayScore ? awayTeam : homeTeam;
    return `The ${leader} lead ${Math.max(homeScore, awayScore)} to ${Math.min(homeScore, awayScore)} over the ${trailer}.`;
  }

  closeModal() {
    document.getElementById('announcement-modal').style.display = 'none';
  }

  saveAnnouncement() {
    const modal = document.getElementById('announcement-modal');
    const title = document.getElementById('announcement-title').value.trim();
    const text = document.getElementById('announcement-text').value.trim();
    const isDynamic = document.getElementById('announcement-dynamic').checked;

    if (!title || (!text && !isDynamic)) {
      alert('Please fill in title and text.');
      return;
    }

    if (!this.gameState.announcements) {
      this.gameState.announcements = [];
    }

    const editId = modal.dataset.editId;
    if (editId) {
      const item = this.gameState.announcements.find(a => a.id === editId);
      if (item) {
        item.title = title;
        item.text = isDynamic ? '' : text;
        item.type = isDynamic ? 'dynamic' : 'static';
        delete this.audioCache[editId];
      }
    } else {
      this.gameState.announcements.push({
        id: `custom-${Date.now()}`,
        title,
        text: isDynamic ? '' : text,
        type: isDynamic ? 'dynamic' : 'static',
      });
    }

    this.storage.saveGame(this.gameState);
    this.render();
    this.closeModal();
  }

  deleteAnnouncement() {
    const modal = document.getElementById('announcement-modal');
    const editId = modal.dataset.editId;
    if (!editId) return;

    if (!confirm('Delete this announcement?')) return;

    this.gameState.announcements = this.gameState.announcements.filter(a => a.id !== editId);
    delete this.audioCache[editId];
    this.storage.saveGame(this.gameState);
    this.render();
    this.closeModal();
  }
}
