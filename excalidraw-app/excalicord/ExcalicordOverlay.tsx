import React, { useState, useRef, useCallback } from "react";

import "./overlay.scss";

type ExcalicordAspectId = "16:9" | "4:3" | "3:4" | "9:16" | "1:1" | "Custom";

type ExcalicordBackground = {
  id: string;
  label: string;
  color: string;
  category: "all" | "vivid" | "soft" | "dark" | "nature";
  style: React.CSSProperties;
};

type ExcalicordOverlayProps = {
  onClose: () => void;
  aspect: ExcalicordAspectId;
  onAspectChange: (aspect: ExcalicordAspectId) => void;
  background: ExcalicordBackground;
  backgrounds: ExcalicordBackground[];
  onBackgroundChange: (bg: ExcalicordBackground) => void;
  category: ExcalicordBackground["category"];
  onCategoryChange: (category: ExcalicordBackground["category"]) => void;
  layout: "grid" | "vertical" | "horizontal";
  onLayoutChange: (layout: "grid" | "vertical" | "horizontal") => void;
  recordingPad: number;
  onRecordingPadChange: (value: number) => void;
  showSlideshowHint: boolean;
  onRecordStart: () => void;
  onRandom: () => void;
  onComplete: () => void;
  onAddFrame: () => void;
};

const aspectOptions: Array<{
  id: ExcalicordAspectId;
  label: string;
  sub: string;
  ratio: string;
}> = [
  { id: "16:9", label: "16:9", sub: "YouTube", ratio: "16 / 9" },
  { id: "4:3", label: "4:3", sub: "经典", ratio: "4 / 3" },
  { id: "3:4", label: "3:4", sub: "小红书", ratio: "3 / 4" },
  { id: "9:16", label: "9:16", sub: "抖音", ratio: "9 / 16" },
  { id: "1:1", label: "1:1", sub: "正方形", ratio: "1 / 1" },
  { id: "Custom", label: "Custom", sub: "自定义", ratio: "16 / 9" },
];

const ExcalicordOverlay = ({
  onClose,
  aspect,
  onAspectChange,
  background,
  backgrounds,
  onBackgroundChange,
  category,
  onCategoryChange,
  layout,
  onLayoutChange,
  recordingPad,
  onRecordingPadChange,
  showSlideshowHint,
  onRecordStart,
  onRandom,
  onComplete,
  onAddFrame,
}: ExcalicordOverlayProps) => {
  const [teleprompterText, setTeleprompterText] = useState(
    "在此粘贴你的脚本...\n\n此文本仅对你可见，不会出现在录制中。",
  );
  const [teleSize, setTeleSize] = useState({ width: 520, height: 200 });
  const [showSettings, setShowSettings] = useState(false);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: teleSize.width,
      startH: teleSize.height,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const deltaX = moveEvent.clientX - resizeRef.current.startX;
      const deltaY = moveEvent.clientY - resizeRef.current.startY;
      setTeleSize({
        width: Math.max(300, resizeRef.current.startW + deltaX),
        height: Math.max(120, resizeRef.current.startH + deltaY),
      });
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [teleSize]);

  const visibleBackgrounds =
    category === "all"
      ? backgrounds
      : backgrounds.filter((bg) => bg.category === category);
  return (
    <div className="excalicord-overlay" role="dialog" aria-modal="true">
      <div className="excalicord-overlay-surface">
        {/* 隐藏浮动控制、幻灯片面板和提词器，只显示设置弹窗 */}
        {/* <div className="excalicord-floating-controls">
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
          <button className="excalicord-record-btn" onClick={onRecordStart}>
            ● 录制
          </button>
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
          <div className="excalicord-slide-add-wrap">
            <span className="excalicord-slide-add-chip">
              添加你的第一张幻灯片
            </span>
            <button
              type="button"
              className="excalicord-slide-add"
              onClick={onAddFrame}
            >
              +
            </button>
          </div>
        </div>

        <div
          className="excalicord-teleprompter"
          ref={teleprompterRef}
          style={{ width: teleSize.width }}
        >
          <div className="excalicord-tele-header">
            <div className="excalicord-tele-title">
              <span className="excalicord-doc-icon">DOC</span>
              提词器 teleprompter
            </div>
            <button
              className="excalicord-icon-btn"
              aria-label="Close"
              onClick={onClose}
            >
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
            <div className="excalicord-tele-textarea-wrap">
              <textarea
                className="excalicord-tele-textarea"
                value={teleprompterText}
                onChange={(e) => setTeleprompterText(e.target.value)}
                style={{ height: teleSize.height }}
                placeholder="在此粘贴你的脚本..."
              />
              <div
                className="excalicord-tele-resize-handle"
                onMouseDown={handleResizeMouseDown}
              />
              <div className="excalicord-tele-hint">
                此文本仅对你可见，不会出现在录制中。
              </div>
            </div>
          </div>
        </div> */}

        <div className="excalicord-settings-backdrop" onClick={onClose}>
          <div
            className="excalicord-recording-settings"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="excalicord-close" onClick={onClose}>
              ×
            </button>
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
              {aspectOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="excalicord-ratio-card"
                  data-active={aspect === item.id}
                  onClick={() => onAspectChange(item.id)}
                >
                  <div className="excalicord-ratio-big">{item.label}</div>
                  <div className="excalicord-ratio-sub">{item.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="excalicord-settings-section">
            <div className="excalicord-section-title">排列</div>
            <div className="excalicord-section-sub">LAYOUT</div>
            <div className="excalicord-section-underline" />
            <div className="excalicord-tag-row">
              <button
                type="button"
                className="excalicord-tag"
                data-active={layout === "grid"}
                onClick={() => onLayoutChange("grid")}
              >
                网格
              </button>
              <button
                type="button"
                className="excalicord-tag"
                data-active={layout === "vertical"}
                onClick={() => onLayoutChange("vertical")}
              >
                纵向
              </button>
              <button
                type="button"
                className="excalicord-tag"
                data-active={layout === "horizontal"}
                onClick={() => onLayoutChange("horizontal")}
              >
                横向
              </button>
            </div>
          </div>

          <div className="excalicord-settings-section">
            <div className="excalicord-section-title">背景</div>
            <div className="excalicord-section-sub">BACKGROUND</div>
            <div className="excalicord-section-underline" />
            <div className="excalicord-tag-row">
              <button
                type="button"
                className="excalicord-tag"
                data-active={category === "all"}
                onClick={() => onCategoryChange("all")}
              >
                全部
              </button>
              <button
                type="button"
                className="excalicord-tag"
                data-active={category === "vivid"}
                onClick={() => onCategoryChange("vivid")}
              >
                鲜艳
              </button>
              <button
                type="button"
                className="excalicord-tag"
                data-active={category === "soft"}
                onClick={() => onCategoryChange("soft")}
              >
                柔和
              </button>
              <button
                type="button"
                className="excalicord-tag"
                data-active={category === "dark"}
                onClick={() => onCategoryChange("dark")}
              >
                深色
              </button>
              <button
                type="button"
                className="excalicord-tag"
                data-active={category === "nature"}
                onClick={() => onCategoryChange("nature")}
              >
                自然
              </button>
            </div>
            <button className="excalicord-random" onClick={onRandom}>
              随机选择壁纸
            </button>
            <div className="excalicord-wall-grid">
              {visibleBackgrounds.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  className="excalicord-wall"
                  data-selected={background.id === bg.id}
                  style={bg.style}
                  onClick={() => onBackgroundChange(bg)}
                  aria-label={bg.label}
                />
              ))}
            </div>
          </div>

          <div className="excalicord-settings-section">
            <div className="excalicord-section-title">录制范围</div>
            <div className="excalicord-section-sub">RECORDING MARGINS</div>
            <div className="excalicord-section-underline" />
            <div className="excalicord-range-row">
              <span>紧贴</span>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={recordingPad}
                onChange={(event) =>
                  onRecordingPadChange(Number(event.target.value))
                }
              />
              <span>偏大</span>
            </div>
          </div>
          <div className="excalicord-settings-actions">
            <button
              type="button"
              className="excalicord-complete"
              onClick={onComplete}
            >
              完成
            </button>
          </div>
          </div>
        </div>

        {/* 隐藏预览组件
        <div className="excalicord-preview">
          <div className="excalicord-preview-label">预览 PREVIEW</div>
          <div className="excalicord-preview-card" style={background.style}>
            <div className="excalicord-preview-lines" />
          </div>
        </div>
        */}

        {showSlideshowHint && (
          <div className="excalicord-slideshow-banner">
            幻灯片模式：录制时按 ← → 键切换幻灯片
            <span>
              Slideshow Mode: Press the left and right arrow keys (← →) to
              switch slides while recording.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcalicordOverlay;
