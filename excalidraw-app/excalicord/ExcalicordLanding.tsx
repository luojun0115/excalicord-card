import "./excalicord.scss";

const ExcalicordLanding = () => {
  return (
    <div className="excalicord-root">
      <div className="excalicord-bg" aria-hidden="true" />
      <div className="excalicord-shell">
        <header className="excalicord-topbar">
          <div className="excalicord-topbar-group">
            <button className="excalicord-icon-btn" aria-label="Lock">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="10" width="12" height="10" rx="2" />
                <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Hand">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11" />
                <path d="M10 11V5.5a1.5 1.5 0 0 1 3 0V11" />
                <path d="M13 11V6.5a1.5 1.5 0 0 1 3 0V12" />
                <path d="M6.5 12.5l1.8 6.5a3.5 3.5 0 0 0 3.4 2.5h2.6a3.5 3.5 0 0 0 3.5-3.5v-3.8" />
              </svg>
            </button>
            <button className="excalicord-icon-btn active" aria-label="Select">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 3l7.8 7.8-3.2.9L11.5 20l2-1-1.9-7.6 3.6-1L5 3z" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Rectangle">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="7" width="14" height="10" rx="2" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Diamond">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4l6 8-6 8-6-8 6-8z" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Ellipse">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <ellipse cx="12" cy="12" rx="7" ry="5" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Arrow">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h12" />
                <path d="M13 7l5 5-5 5" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Line">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 17l12-10" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Pen">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 17l10-10 2 2-10 10H6z" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Text">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 7h12" />
                <path d="M12 7v12" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Image">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="6" width="16" height="12" rx="2" />
                <path d="M8 14l3-3 5 5" />
                <circle cx="9" cy="10" r="1.5" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Eraser">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 14l6-6 6 6-4 4H8z" />
              </svg>
            </button>
            <button className="excalicord-icon-btn" aria-label="Library">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 6h10v3H7z" />
                <path d="M6 11h12v7H6z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="excalicord-leftmenu">
          <div className="excalicord-leftmenu-header">
            <button className="excalicord-icon-btn" aria-label="Menu">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7h14" />
                <path d="M5 12h14" />
                <path d="M5 17h14" />
              </svg>
            </button>
          </div>
          <div className="excalicord-leftmenu-panel">
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">[O]</span>
              <span>打开</span>
              <span className="excalicord-menu-shortcut">Cmd+O</span>
            </div>
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">[S]</span>
              <span>保存到...</span>
            </div>
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">[D]</span>
              <span>导出图片...</span>
              <span className="excalicord-menu-shortcut">Cmd+Shift+E</span>
            </div>
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">[F]</span>
              <span>Find on canvas</span>
              <span className="excalicord-menu-shortcut">Cmd+F</span>
            </div>
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">[?]</span>
              <span>帮助</span>
            </div>
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">[X]</span>
              <span>重置画布</span>
            </div>
            <div className="excalicord-menu-divider" />
            <div className="excalicord-menu-section">Excalidraw links</div>
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">GH</span>
              <span>GitHub</span>
            </div>
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">X</span>
              <span>Follow us</span>
            </div>
            <div className="excalicord-menu-item">
              <span className="excalicord-menu-icon">DC</span>
              <span>Discord chat</span>
            </div>
            <div className="excalicord-menu-divider" />
            <div className="excalicord-menu-section">
              画布背景 Canvas Background
            </div>
            <div className="excalicord-color-row">
              <span className="excalicord-color" />
              <span className="excalicord-color" />
              <span className="excalicord-color" />
              <span className="excalicord-color" />
              <span className="excalicord-color" />
              <span className="excalicord-color" />
            </div>
          </div>
        </div>

        <div className="excalicord-canvas">
          <div className="excalicord-canvas-label">Slide 1</div>
        </div>

        <div className="excalicord-right-rail">
          <div className="excalicord-controls">
            <button className="excalicord-control-btn" aria-label="Settings">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z" />
                <path d="M4.5 12h2" />
                <path d="M17.5 12h2" />
                <path d="M12 4.5v2" />
                <path d="M12 17.5v2" />
              </svg>
            </button>
            <button className="excalicord-control-btn" aria-label="Document">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 4h7l4 4v12H7z" />
                <path d="M14 4v4h4" />
              </svg>
            </button>
            <button className="excalicord-record-btn">● 录制</button>
          </div>

          <div className="excalicord-slides-panel">
            <div className="excalicord-slides-title">幻灯片 Slides</div>
            <div className="excalicord-slide" data-active="false">
              1
            </div>
            <div className="excalicord-slide" data-active="true">
              2
            </div>
            <div className="excalicord-slide" data-active="false">
              3
            </div>
            <div className="excalicord-slide-add">+</div>
          </div>
        </div>

        <div className="excalicord-teleprompter">
          <div className="excalicord-tele-header">
            <div className="excalicord-tele-title">
              <span className="excalicord-doc-icon">DOC</span>
              提词器 teleprompter
            </div>
            <button className="excalicord-icon-btn" aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6l-12 12" />
              </svg>
            </button>
          </div>
          <div className="excalicord-tele-body">
            <div className="excalicord-tele-left">
              <div className="excalicord-tele-play">▶</div>
              <div className="excalicord-tele-label">滚动速度</div>
              <div className="excalicord-tele-sublabel">SCROLLING SPEED</div>
              <div className="excalicord-slider">
                <span className="excalicord-slider-dot" />
              </div>
              <div className="excalicord-tele-label">透明度</div>
              <div className="excalicord-tele-sublabel">TRANSPARENCY</div>
              <div className="excalicord-slider">
                <span className="excalicord-slider-dot" />
              </div>
            </div>
            <div className="excalicord-tele-text">
              在此粘贴你的脚本...
              <span>此文本仅对你可见，不会出现在录制中。</span>
            </div>
          </div>
        </div>

        <div className="excalicord-recording-settings">
          <button className="excalicord-close">×</button>
          <div className="excalicord-settings-head">
            <div className="excalicord-title-cn">录制设置</div>
            <div className="excalicord-title-en">Recording settings</div>
            <div className="excalicord-title-underline" />
          </div>

          <div className="excalicord-settings-section">
            <div className="excalicord-section-title">画面比例</div>
            <div className="excalicord-section-sub">ASPECT RATIO</div>
            <div className="excalicord-section-underline" />
            <div className="excalicord-ratio-grid">
              <div className="excalicord-ratio-card active">
                <div className="excalicord-ratio-big">16:9</div>
                <div className="excalicord-ratio-sub">YouTube</div>
              </div>
              <div className="excalicord-ratio-card">
                <div className="excalicord-ratio-big">4:3</div>
                <div className="excalicord-ratio-sub">经典</div>
              </div>
              <div className="excalicord-ratio-card">
                <div className="excalicord-ratio-big">3:4</div>
                <div className="excalicord-ratio-sub">小红书</div>
              </div>
              <div className="excalicord-ratio-card">
                <div className="excalicord-ratio-big">9:16</div>
                <div className="excalicord-ratio-sub">抖音</div>
              </div>
              <div className="excalicord-ratio-card">
                <div className="excalicord-ratio-big">1:1</div>
                <div className="excalicord-ratio-sub">正方形</div>
              </div>
              <div className="excalicord-ratio-card">
                <div className="excalicord-ratio-big">Custom</div>
                <div className="excalicord-ratio-sub">自定义</div>
              </div>
            </div>
          </div>

          <div className="excalicord-settings-section">
            <div className="excalicord-section-title">背景</div>
            <div className="excalicord-section-sub">BACKGROUND</div>
            <div className="excalicord-section-underline" />
            <div className="excalicord-tag-row">
              <span className="excalicord-tag active">全部</span>
              <span className="excalicord-tag">鲜艳</span>
              <span className="excalicord-tag">柔和</span>
              <span className="excalicord-tag">深色</span>
              <span className="excalicord-tag">自然</span>
            </div>
            <button className="excalicord-random">随机选择壁纸</button>
            <div className="excalicord-wall-grid">
              <div className="excalicord-wall" data-selected="false" />
              <div className="excalicord-wall" data-selected="true" />
              <div className="excalicord-wall" data-selected="false" />
              <div className="excalicord-wall" data-selected="false" />
              <div className="excalicord-wall" data-selected="false" />
              <div className="excalicord-wall" data-selected="false" />
              <div className="excalicord-wall" data-selected="false" />
              <div className="excalicord-wall" data-selected="false" />
            </div>
          </div>
        </div>

        <div className="excalicord-preview">
          <div className="excalicord-preview-label">预览 PREVIEW</div>
          <div className="excalicord-preview-card">
            <div className="excalicord-preview-lines" />
          </div>
        </div>

        <div className="excalicord-slideshow-banner">
          幻灯片模式：录制时按 ← → 键切换幻灯片
          <span>
            Slideshow Mode: Press the left and right arrow keys (← →) to switch
            slides while recording.
          </span>
        </div>

        <div className="excalicord-zoom">
          <button>-</button>
          <span>53%</span>
          <button>+</button>
        </div>
      </div>
    </div>
  );
};

export default ExcalicordLanding;
