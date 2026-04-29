import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  useEditorInterface,
  ExcalidrawAPIProvider,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  THEME,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  ExcalLogo,
  usersIcon,
  exportToPlus,
  share,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import {
  isElementLink,
  isFrameElement,
  isInitializedImageElement,
  newElementWith,
  newFrameElement,
} from "@excalidraw/element";
import {
  bumpElementVersions,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  ExcalidrawFrameElement,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  isExcalidrawPlusSignedUser,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import {
  ExportToExcalidrawPlus,
  exportToExcalidrawPlus,
} from "./components/ExportToExcalidrawPlus";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  importFromBackend,
  isCollaborationLink,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import { FileStatusStore } from "./data/fileStatusStore";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { ExcalidrawPlusIframeExport } from "./ExcalidrawPlusIframeExport";

import "./index.scss";

import { AppSidebar } from "./components/AppSidebar";
import ExcalicordOverlay from "./excalicord/ExcalicordOverlay";

import type { CollabAPI } from "./collab/Collab";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();

  let scene: Omit<
    RestoredDataState,
    // we're not storing files in the scene database/localStorage, and instead
    // fetch them async from a different store
    "files"
  > & {
    scrollToContent?: boolean;
  } = {
    elements: restoreElements(localDataState?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(localDataState?.appState, null),
  };

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        const imported = await importFromBackend(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
        );

        scene = {
          elements: bumpElementVersions(
            restoreElements(imported.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            localDataState?.elements,
          ),
          appState: restoreAppState(
            imported.appState,
            // local appState when importing from backend to ensure we restore
            // localStorage user settings which we do not persist on server.
            localDataState?.appState,
          ),
        };
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const ExcalidrawWrapper = () => {
  const excalidrawAPI = useExcalidrawAPI();

  const [errorMessage, setErrorMessage] = useState("");
  const [isExcalicordOpen, setIsExcalicordOpen] = useState(false);
  const [excalicordAspect, setExcalicordAspect] = useState<
    "16:9" | "4:3" | "3:4" | "9:16" | "1:1" | "Custom"
  >("16:9");
  type ExcalicordBackground = {
    id: string;
    label: string;
    color: string;
    category: "all" | "vivid" | "soft" | "dark" | "nature";
    style: React.CSSProperties;
  };

  const excalicordBackgrounds = useRef<ExcalicordBackground[]>([
    {
      id: "pastel-1",
      label: "Pastel Lavender",
      color: "#f6d7e6",
      category: "soft",
      style: { background: "#f6d7e6" },
    },
    {
      id: "pastel-2",
      label: "Iris Mint",
      color: "#e1e7ff",
      category: "soft",
      style: { background: "#e1e7ff" },
    },
    {
      id: "tropic-1",
      label: "Tropic Pop",
      color: "#c9f5e7",
      category: "vivid",
      style: { background: "#c9f5e7" },
    },
    {
      id: "sunset-1",
      label: "Sunset Glow",
      color: "#ffd2bf",
      category: "vivid",
      style: { background: "#ffd2bf" },
    },
    {
      id: "citrus-1",
      label: "Citrus",
      color: "#ffe6a7",
      category: "vivid",
      style: { background: "#ffe6a7" },
    },
    {
      id: "warm-1",
      label: "Warm Reds",
      color: "#ffc2b7",
      category: "vivid",
      style: { background: "#ffc2b7" },
    },
    {
      id: "ocean-1",
      label: "Ocean",
      color: "#c7e9ff",
      category: "nature",
      style: { background: "#c7e9ff" },
    },
    {
      id: "sand-1",
      label: "Sand",
      color: "#f6efd5",
      category: "nature",
      style: { background: "#f6efd5" },
    },
    {
      id: "aurora-1",
      label: "Aurora",
      color: "#1b1b32",
      category: "dark",
      style: {
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(88, 197, 255, 0.7), transparent 55%), radial-gradient(circle at 60% 20%, rgba(255, 76, 161, 0.75), transparent 60%), linear-gradient(135deg, #1b1b32, #0b0d1a)",
      },
    },
    {
      id: "sunrise-1",
      label: "Sunrise Hills",
      color: "#f6d2b1",
      category: "nature",
      style: {
        backgroundImage:
          "linear-gradient(180deg, #ffd1b0 0%, #f5b774 45%, #c56b6b 75%, #5c4b4b 100%)",
      },
    },
    {
      id: "botanic-1",
      label: "Botanic",
      color: "#e7f1e9",
      category: "nature",
      style: {
        backgroundImage:
          "radial-gradient(circle at 20% 20%, #cfe7d3 0%, transparent 45%), radial-gradient(circle at 80% 20%, #b8d8bf 0%, transparent 45%), linear-gradient(135deg, #f5f9f6, #e8f2ec)",
      },
    },
    {
      id: "fabric-1",
      label: "Fabric",
      color: "#667a6d",
      category: "dark",
      style: {
        backgroundImage:
          "radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.25), transparent 45%), linear-gradient(135deg, #3c4a42, #70867a)",
      },
    },
    {
      id: "tile-1",
      label: "Tiles",
      color: "#a9b1c7",
      category: "soft",
      style: {
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.5) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,0.5) 25%, transparent 25%), linear-gradient(45deg, rgba(255,255,255,0.5) 25%, transparent 25%), linear-gradient(315deg, rgba(255,255,255,0.5) 25%, transparent 25%)",
        backgroundPosition: "8px 0, 8px 0, 0 0, 0 0",
        backgroundSize: "16px 16px",
        backgroundColor: "#cfe0f2",
      },
    },
    {
      id: "brick-1",
      label: "Brick",
      color: "#d98b77",
      category: "vivid",
      style: {
        backgroundImage:
          "linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)",
        backgroundSize: "26px 14px",
        backgroundColor: "#d9826f",
      },
    },
    {
      id: "petals-1",
      label: "Petals",
      color: "#f4dfe2",
      category: "soft",
      style: {
        backgroundImage:
          "radial-gradient(circle at 30% 30%, #f0c6cc 0%, transparent 45%), radial-gradient(circle at 70% 60%, #f7e2c9 0%, transparent 45%), linear-gradient(135deg, #f7e6f4, #cfe2f2)",
      },
    },
    {
      id: "mountain-1",
      label: "Mountain",
      color: "#8fb3d8",
      category: "nature",
      style: {
        backgroundImage:
          "linear-gradient(180deg, #9fd4ff 0%, #e4f1ff 40%, #c8d5e6 70%, #6e8699 100%)",
      },
    },
  ]);
  const [excalicordBackground, setExcalicordBackground] = useState(
    excalicordBackgrounds.current[1],
  );
  const [excalicordCategory, setExcalicordCategory] = useState<
    "all" | "vivid" | "soft" | "dark" | "nature"
  >("all");
  const [excalicordLayout, setExcalicordLayout] = useState<
    "grid" | "vertical" | "horizontal"
  >("vertical");
  const [excalicordRecordingPad, setExcalicordRecordingPad] = useState(4);
  const [excalicordSlides, setExcalicordSlides] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [excalicordActiveSlideId, setExcalicordActiveSlideId] = useState<
    string | null
  >(null);
  const excalicordSlideIndexRef = useRef(0);
  const excalicordActiveSlideIdRef = useRef<string | null>(null);
  const [recordingFrameTick, setRecordingFrameTick] = useState(0);
  const excalicordSlidesSigRef = useRef("");
  const [showFirstSlideHint, setShowFirstSlideHint] = useState(() => {
    try {
      return !window.localStorage.getItem("excalicord_first_slide_hint_seen");
    } catch {
      return true;
    }
  });
  const [showSlideshowHint, setShowSlideshowHint] = useState(false);
  const [isRecordingOverlayOpen, setIsRecordingOverlayOpen] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(
    null,
  );
  const [recordingElapsed, setRecordingElapsed] = useState("00:00");
  const [recordingStatus, setRecordingStatus] = useState<
    "idle" | "recording" | "paused"
  >("idle");
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState("");
  const [teleprompterPlaying, setTeleprompterPlaying] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(50);
  const [teleprompterOpacity, setTeleprompterOpacity] = useState(100);
  const [teleprompterPos, setTeleprompterPos] = useState({ x: 0, y: 60 });
  const teleprompterScrollRef = useRef<number>(0);
  const teleprompterAnimationRef = useRef<number | null>(null);
  const teleprompterTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const teleprompterDragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Sync active slide ID to ref for recording
  useEffect(() => {
    excalicordActiveSlideIdRef.current = excalicordActiveSlideId;
  }, [excalicordActiveSlideId]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingPrevBgRef = useRef<string | null>(null);
  const slideshowHintTimerRef = useRef<number | null>(null);
  const recordingFrameRafRef = useRef<number | null>(null);
  const recordingFrameKeyRef = useRef("");
  const isCollabDisabled = isRunningInIframe();

  const scrollToSlide = useCallback(
    (slideId: string, animate = false, fitToContent = false) => {
      if (!excalidrawAPI) {
        return;
      }
      let viewportZoomFactor: number | undefined;
      if (fitToContent && excalicordRecordingPad > 0) {
        const { width, height } = excalidrawAPI.getAppState();
        if (
          width > excalicordRecordingPad * 2 &&
          height > excalicordRecordingPad * 2
        ) {
          const fx = (width - excalicordRecordingPad * 2) / width;
          const fy = (height - excalicordRecordingPad * 2) / height;
          viewportZoomFactor = Math.max(0.1, Math.min(1, Math.min(fx, fy)));
        }
      }
      excalidrawAPI.scrollToContent(slideId, {
        animate,
        fitToContent,
        viewportZoomFactor,
      });
    },
    [excalidrawAPI, excalicordRecordingPad],
  );

  const addFrameForAspect = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const ratioMap: Record<string, number> = {
      "16:9": 16 / 9,
      "4:3": 4 / 3,
      "3:4": 3 / 4,
      "9:16": 9 / 16,
      "1:1": 1,
      Custom: 16 / 9,
    };
    const ratio = ratioMap[excalicordAspect] ?? 16 / 9;
    const baseLong = 900;
    const width = ratio >= 1 ? baseLong : baseLong * ratio;
    const height = ratio >= 1 ? baseLong / ratio : baseLong;
    const appState = excalidrawAPI.getAppState();
    const zoom = appState.zoom.value;
    const centerX = -appState.scrollX + appState.width / 2 / zoom;
    const centerY = -appState.scrollY + appState.height / 2 / zoom;
    const existing = excalidrawAPI.getSceneElements();
    const frames = existing.filter((el) => el.type === "frame");
    const frameCount = frames.length;
    const padding = 120;
    const gridSpacing = 80;
    let x = Math.round(centerX - width / 2);
    let y = Math.round(centerY - height / 2);
    if (excalicordLayout === "vertical") {
      y = Math.round(centerY - height / 2) + frameCount * (height + padding);
    } else if (excalicordLayout === "horizontal") {
      x = Math.round(centerX - width / 2) + frameCount * (width + gridSpacing);
    } else {
      const perRow = ratio >= 1 ? 2 : 3;
      const columns = Math.max(1, perRow);
      const col = frameCount % columns;
      const row = Math.floor(frameCount / columns);
      const totalWidth = columns * width + (columns - 1) * gridSpacing;
      const startX = Math.round(centerX - totalWidth / 2);
      x = startX + col * (width + gridSpacing);
      y = Math.round(centerY - height / 2) + row * (height + padding);
    }
    const frame = newFrameElement({
      x,
      y,
      width,
      height,
      name: `Slide ${frameCount + 1}`,
    });
    excalidrawAPI.updateScene({
      elements: [...existing, frame],
      appState: {
        selectedElementIds: { [frame.id]: true },
      },
    });
    excalidrawAPI.scrollToContent(frame.id, { animate: true });
    if (showFirstSlideHint) {
      setShowFirstSlideHint(false);
      try {
        window.localStorage.setItem("excalicord_first_slide_hint_seen", "1");
      } catch {
        // ignore storage errors
      }
    }
  }, [excalidrawAPI, excalicordAspect, excalicordLayout, showFirstSlideHint]);

  const getFrameForViewportCenter = useCallback(
    (appState: AppState, frames: readonly ExcalidrawFrameElement[]) => {
      if (!frames.length) {
        return null;
      }
      const zoom = appState.zoom.value || 1;
      const centerX = -appState.scrollX + appState.width / 2 / zoom;
      const centerY = -appState.scrollY + appState.height / 2 / zoom;
      const inViewport = frames.find(
        (frame) =>
          centerX >= frame.x &&
          centerX <= frame.x + frame.width &&
          centerY >= frame.y &&
          centerY <= frame.y + frame.height,
      );
      if (inViewport) {
        return inViewport;
      }
      let closest: ExcalidrawFrameElement | null = null;
      let closestDist = Number.POSITIVE_INFINITY;
      for (const frame of frames) {
        const fx = frame.x + frame.width / 2;
        const fy = frame.y + frame.height / 2;
        const dx = centerX - fx;
        const dy = centerY - fy;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist) {
          closestDist = dist;
          closest = frame;
        }
      }
      return closest;
    },
    [],
  );

  const getActiveFrame = useCallback(() => {
    if (!excalidrawAPI) {
      return null;
    }
    const appState = excalidrawAPI.getAppState();
    const frames = excalidrawAPI
      .getSceneElements()
      .filter((el) => el.type === "frame");
    if (!frames.length) {
      return null;
    }
    const selectedId = Object.keys(appState.selectedElementIds).find((id) =>
      frames.some((frame) => frame.id === id),
    );
    const preferredId = excalicordActiveSlideId || selectedId;
    if (preferredId) {
      const match = frames.find((frame) => frame.id === preferredId);
      if (match) {
        return match;
      }
    }
    return getFrameForViewportCenter(appState, frames) || frames[0];
  }, [excalidrawAPI, excalicordActiveSlideId, getFrameForViewportCenter]);

  const getActiveFrameViewportRect = useCallback(() => {
    if (!excalidrawAPI) {
      return null;
    }
    const interactiveCanvas = document.querySelector(
      ".excalidraw__canvas.interactive",
    ) as HTMLCanvasElement | null;
    const canvasRect = interactiveCanvas?.getBoundingClientRect();
    if (!canvasRect) {
      return null;
    }
    const appState = excalidrawAPI.getAppState();
    const activeFrame = getActiveFrame();
    if (!activeFrame) {
      return null;
    }
    const zoom = appState.zoom.value || 1;
    // Calculate frame position relative to canvas (not viewport)
    // to avoid coordinate mismatches when UI state changes
    const relativeLeft = (activeFrame.x + appState.scrollX) * zoom;
    const relativeTop = (activeFrame.y + appState.scrollY) * zoom;
    return {
      left: relativeLeft,
      top: relativeTop,
      width: activeFrame.width * zoom,
      height: activeFrame.height * zoom,
      canvasLeft: canvasRect.left,
      canvasTop: canvasRect.top,
    };
  }, [excalidrawAPI, getActiveFrame]);

  const recordingFrameStyle = useMemo(() => {
    const frameRect = getActiveFrameViewportRect();
    if (!frameRect) {
      return {} as React.CSSProperties;
    }
    // Convert relative coordinates to viewport coordinates for the overlay frame
    const viewportLeft = frameRect.left + frameRect.canvasLeft;
    const viewportTop = frameRect.top + frameRect.canvasTop;
    return {
      "--excalicord-frame-x": `${viewportLeft}px`,
      "--excalicord-frame-y": `${viewportTop}px`,
      "--excalicord-frame-w": `${frameRect.width}px`,
      "--excalicord-frame-h": `${frameRect.height}px`,
      "--excalicord-frame-zoom": "1",
      "--excalicord-frame-pad": `${excalicordRecordingPad}px`,
    } as React.CSSProperties;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getActiveFrameViewportRect, excalicordRecordingPad, recordingFrameTick]);

  const handleRecordStart = useCallback(() => {
    setShowSlideshowHint(true);
    if (slideshowHintTimerRef.current) {
      window.clearTimeout(slideshowHintTimerRef.current);
    }
    slideshowHintTimerRef.current = window.setTimeout(() => {
      setShowSlideshowHint(false);
      slideshowHintTimerRef.current = null;
    }, 6000);
  }, []);

  const handleRecordToggle = useCallback(() => {
    setIsRecordingOverlayOpen((prev) => {
      const next = !prev;
      if (next) {
        handleRecordStart();
      } else {
        setRecordingStartedAt(null);
        setRecordingElapsed("00:00");
        setRecordingStatus("idle");
      }
      return next;
    });
  }, [handleRecordStart]);

  const handleRecordingCancel = useCallback(() => {
    setIsRecordingOverlayOpen(false);
    setRecordingStartedAt(null);
    setRecordingElapsed("00:00");
    setRecordingStatus("idle");
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (excalidrawAPI && recordingPrevBgRef.current !== null) {
      excalidrawAPI.updateScene({
        appState: { viewBackgroundColor: recordingPrevBgRef.current },
      });
      recordingPrevBgRef.current = null;
    }
    recordedChunksRef.current = [];
  }, [excalidrawAPI]);

  const handleRecordingStart = useCallback(() => {
    if (recordingStartedAt) {
      return;
    }
    const startRecording = () => {
      if (excalidrawAPI) {
        const appState = excalidrawAPI.getAppState();
        recordingPrevBgRef.current = appState.viewBackgroundColor;
        if (
          !appState.viewBackgroundColor ||
          appState.viewBackgroundColor === "transparent"
        ) {
          excalidrawAPI.updateScene({
            appState: { viewBackgroundColor: "#ffffff" },
          });
        }
      }
      const staticCanvas = document.querySelector(
        ".excalidraw__canvas.static",
      ) as HTMLCanvasElement | null;
      const interactiveCanvas = document.querySelector(
        ".excalidraw__canvas.interactive",
      ) as HTMLCanvasElement | null;
      if (!interactiveCanvas || !interactiveCanvas.captureStream) {
        return;
      }
      // record from a composed canvas to avoid black output in some browsers
      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = interactiveCanvas.width;
      compositeCanvas.height = interactiveCanvas.height;
      const compositeCtx = compositeCanvas.getContext("2d");
      if (!compositeCtx) {
        return;
      }
      let compositeRaf: number | null = null;
      const renderComposite = () => {
        const canvasRect = interactiveCanvas.getBoundingClientRect();
        // Calculate active frame rect using ref to get latest slide ID
        let frameRect = null;
        if (excalidrawAPI) {
          const appState = excalidrawAPI.getAppState();
          const frames = excalidrawAPI
            .getSceneElements()
            .filter((el) => el.type === "frame");
          const activeSlideId = excalicordActiveSlideIdRef.current;
          let activeFrame = null;
          if (activeSlideId) {
            activeFrame = frames.find((frame) => frame.id === activeSlideId);
          }
          if (!activeFrame && frames.length) {
            // fallback to viewport center
            const zoom = appState.zoom.value || 1;
            const centerX = -appState.scrollX + appState.width / 2 / zoom;
            const centerY = -appState.scrollY + appState.height / 2 / zoom;
            let closest = null;
            let closestDist = Number.POSITIVE_INFINITY;
            for (const frame of frames) {
              const fx = frame.x + frame.width / 2;
              const fy = frame.y + frame.height / 2;
              const dx = centerX - fx;
              const dy = centerY - fy;
              const dist = dx * dx + dy * dy;
              if (dist < closestDist) {
                closestDist = dist;
                closest = frame;
              }
            }
            activeFrame = closest || frames[0];
          }
          if (activeFrame) {
            const zoom = appState.zoom.value || 1;
            const relativeLeft = (activeFrame.x + appState.scrollX) * zoom;
            const relativeTop = (activeFrame.y + appState.scrollY) * zoom;
            frameRect = {
              left: relativeLeft,
              top: relativeTop,
              width: activeFrame.width * zoom,
              height: activeFrame.height * zoom,
              canvasLeft: canvasRect.left,
              canvasTop: canvasRect.top,
            };
          }
        }
        if (frameRect) {
          const pad = excalicordRecordingPad;
          const scaleX =
            interactiveCanvas.width / Math.max(1, canvasRect.width);
          const scaleY =
            interactiveCanvas.height / Math.max(1, canvasRect.height);
          const targetW = Math.max(1, frameRect.width + pad * 2);
          const targetH = Math.max(1, frameRect.height + pad * 2);
          const dstW = Math.max(1, Math.round(targetW * scaleX));
          const dstH = Math.max(1, Math.round(targetH * scaleY));
          if (
            compositeCanvas.width !== dstW ||
            compositeCanvas.height !== dstH
          ) {
            compositeCanvas.width = dstW;
            compositeCanvas.height = dstH;
          }
          // frameRect.left/top are now relative to canvas, not viewport
          // So we only need to subtract pad and scale
          let sx = (frameRect.left - pad) * scaleX;
          let sy = (frameRect.top - pad) * scaleY;
          let sw = targetW * scaleX;
          let sh = targetH * scaleY;
          let dx = 0;
          let dy = 0;

          // clamp source rect to canvas bounds and adjust dest rect accordingly
          if (sx < 0) {
            dx = -sx;
            sw += sx;
            sx = 0;
          }
          if (sy < 0) {
            dy = -sy;
            sh += sy;
            sy = 0;
          }
          if (sx + sw > interactiveCanvas.width) {
            sw = interactiveCanvas.width - sx;
          }
          if (sy + sh > interactiveCanvas.height) {
            sh = interactiveCanvas.height - sy;
          }
          if (sw <= 0 || sh <= 0) {
            compositeCtx.fillStyle = "#ffffff";
            compositeCtx.fillRect(
              0,
              0,
              compositeCanvas.width,
              compositeCanvas.height,
            );
            if (staticCanvas) {
              compositeCtx.drawImage(staticCanvas, 0, 0);
            }
            compositeCtx.drawImage(interactiveCanvas, 0, 0);
            compositeRaf = window.requestAnimationFrame(renderComposite);
            return;
          }
          const dw = Math.max(1, Math.round(sw));
          const dh = Math.max(1, Math.round(sh));
          compositeCtx.fillStyle = "#ffffff";
          compositeCtx.fillRect(
            0,
            0,
            compositeCanvas.width,
            compositeCanvas.height,
          );
          if (staticCanvas) {
            compositeCtx.drawImage(
              staticCanvas,
              sx,
              sy,
              sw,
              sh,
              dx,
              dy,
              dw,
              dh,
            );
          }
          compositeCtx.drawImage(
            interactiveCanvas,
            sx,
            sy,
            sw,
            sh,
            dx,
            dy,
            dw,
            dh,
          );
        } else {
          compositeCtx.fillStyle = "#ffffff";
          compositeCtx.fillRect(
            0,
            0,
            compositeCanvas.width,
            compositeCanvas.height,
          );
          if (staticCanvas) {
            compositeCtx.drawImage(staticCanvas, 0, 0);
          }
          compositeCtx.drawImage(interactiveCanvas, 0, 0);
        }
        compositeRaf = window.requestAnimationFrame(renderComposite);
      };
      renderComposite();
      const stream = compositeCanvas.captureStream(30);
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      let recorder: MediaRecorder | null = null;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9",
        });
      } catch {
        try {
          recorder = new MediaRecorder(stream, {
            mimeType: "video/webm;codecs=vp8",
          });
        } catch {
          recorder = new MediaRecorder(stream);
        }
      }
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "excalicord-recording.webm";
        a.click();
        URL.revokeObjectURL(url);
        recordedChunksRef.current = [];
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (compositeRaf !== null) {
          window.cancelAnimationFrame(compositeRaf);
        }
        if (excalidrawAPI && recordingPrevBgRef.current !== null) {
          excalidrawAPI.updateScene({
            appState: { viewBackgroundColor: recordingPrevBgRef.current },
          });
          recordingPrevBgRef.current = null;
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingStartedAt(Date.now());
      setRecordingStatus("recording");
    };

    const activeFrame = getActiveFrame();
    if (activeFrame && excalidrawAPI) {
      scrollToSlide(activeFrame.id, false, true);
      // Wait for scroll to complete before updating frame and starting recording
      setTimeout(() => {
        setRecordingFrameTick((prev) => prev + 1);
        window.requestAnimationFrame(() => {
          startRecording();
        });
      }, 50);
      return;
    }
    startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recordingStartedAt,
    excalidrawAPI,
    getActiveFrame,
    excalicordRecordingPad,
    scrollToSlide,
  ]);

  const handleRecordingPauseToggle = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }
    if (recordingStatus === "recording") {
      recorder.pause();
      setRecordingStatus("paused");
    } else if (recordingStatus === "paused") {
      recorder.resume();
      setRecordingStatus("recording");
    }
  }, [recordingStatus]);

  const handleRecordingStop = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecordingStatus("idle");
    setRecordingStartedAt(null);
    setRecordingElapsed("00:00");
    setIsRecordingOverlayOpen(false);
  }, []);

  useEffect(() => {
    if (!recordingStartedAt) {
      return;
    }
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(seconds % 60).padStart(2, "0");
      setRecordingElapsed(`${mm}:${ss}`);
    }, 500);
    return () => window.clearInterval(timer);
  }, [recordingStartedAt]);

  useEffect(() => {
    return () => {
      if (slideshowHintTimerRef.current) {
        window.clearTimeout(slideshowHintTimerRef.current);
      }
      if (recordingFrameRafRef.current) {
        window.cancelAnimationFrame(recordingFrameRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!teleprompterDragRef.current.isDragging) return;
      const dx = e.clientX - teleprompterDragRef.current.startX;
      const dy = e.clientY - teleprompterDragRef.current.startY;
      setTeleprompterPos({
        x: teleprompterDragRef.current.initialX - dx,
        y: teleprompterDragRef.current.initialY + dy,
      });
    };
    const handleMouseUp = () => {
      teleprompterDragRef.current.isDragging = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!isRecordingOverlayOpen || !excalidrawAPI) {
      return;
    }
    const tick = () => {
      const appState = excalidrawAPI.getAppState();
      const key = `${appState.scrollX}:${appState.scrollY}:${appState.zoom.value}:${excalicordActiveSlideId}`;
      if (key !== recordingFrameKeyRef.current) {
        recordingFrameKeyRef.current = key;
        setRecordingFrameTick((prev) => prev + 1);
      }
      recordingFrameRafRef.current = window.requestAnimationFrame(tick);
    };
    recordingFrameRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (recordingFrameRafRef.current) {
        window.cancelAnimationFrame(recordingFrameRafRef.current);
        recordingFrameRafRef.current = null;
      }
    };
  }, [isRecordingOverlayOpen, excalidrawAPI, excalicordActiveSlideId]);

  useEffect(() => {
    const textarea = teleprompterTextareaRef.current;
    if (!textarea || !teleprompterPlaying) {
      return;
    }
    let lastTime = performance.now();
    const scroll = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      const speed = teleprompterSpeed / 2000;
      textarea.scrollTop += speed * delta;
      if (textarea.scrollTop >= textarea.scrollHeight - textarea.clientHeight) {
        setTeleprompterPlaying(false);
        return;
      }
      teleprompterAnimationRef.current = requestAnimationFrame(scroll);
    };
    teleprompterAnimationRef.current = requestAnimationFrame(scroll);
    return () => {
      if (teleprompterAnimationRef.current) {
        cancelAnimationFrame(teleprompterAnimationRef.current);
      }
    };
  }, [teleprompterPlaying, teleprompterSpeed]);

  useEffect(() => {
    if (!isRecordingOverlayOpen || !excalicordSlides.length || !excalidrawAPI) {
      return;
    }
    const indexFromId = excalicordActiveSlideId
      ? excalicordSlides.findIndex(
          (slide) => slide.id === excalicordActiveSlideId,
        )
      : -1;
    if (indexFromId >= 0) {
      excalicordSlideIndexRef.current = indexFromId;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = Math.min(
        excalicordSlides.length - 1,
        Math.max(0, excalicordSlideIndexRef.current + delta),
      );
      excalicordSlideIndexRef.current = nextIndex;
      const nextId = excalicordSlides[nextIndex]?.id;
      if (nextId) {
        setExcalicordActiveSlideId(nextId);
        excalidrawAPI.updateScene({
          appState: { selectedElementIds: { [nextId]: true } },
        });
        // Wait for scene update before scrolling to ensure clean render
        requestAnimationFrame(() => {
          scrollToSlide(nextId, false, true);
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isRecordingOverlayOpen,
    excalicordSlides,
    excalicordActiveSlideId,
    excalidrawAPI,
    scrollToSlide,
  ]);

  useEffect(() => {
    if (!excalidrawAPI || !excalicordActiveSlideId) {
      return;
    }
    if (recordingStatus === "recording" || recordingStatus === "paused") {
      scrollToSlide(excalicordActiveSlideId, false, true);
      // Ensure canvas is fully rendered before capturing frame
      // Use multiple RAF + setTimeout to wait for scroll and render completion
      const waitForRender = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              setRecordingFrameTick((prev) => prev + 1);
            }, 100);
          });
        });
      };
      waitForRender();
    }
  }, [excalidrawAPI, excalicordActiveSlideId, recordingStatus, scrollToSlide]);

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  const editorInterface = useEditorInterface();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  // ---------------------------------------------------------------------------
  // Hoisted loadImages
  // ---------------------------------------------------------------------------
  const loadImages = useCallback(
    (data: ResolutionType<typeof initializeScene>, isInitialLoad = false) => {
      if (!data.scene || !excalidrawAPI) {
        return;
      }

      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          if (fileIds.length) {
            // Direct Firebase call (not through FileManager), so track manually
            FileStatusStore.updateStatuses(
              fileIds.map((id) => [id, "loading"]),
            );
          }
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
            FileStatusStore.updateStatuses([
              ...loadedFiles.map((f) => [f.id, "loaded"] as [FileId, "loaded"]),
              ...[...erroredFiles.keys()].map(
                (id) => [id, "error"] as [FileId, "error"],
              ),
            ]);
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(async ({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({
            currentFileIds: fileIds,
          });
        }
      }
    },
    [collabAPI, excalidrawAPI],
  );

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }

    initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
      loadImages(data, /* isInitialLoad */ true);
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              elements: restoreElements(data.scene.elements, null, {
                repairBindings: true,
              }),
              appState: restoreAppState(data.scene.appState, null),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
    };
  }, [isCollabDisabled, collabAPI, excalidrawAPI, setLangCode, loadImages]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    const frames = elements.filter(
      (element): element is ExcalidrawFrameElement & { index: string } =>
        isFrameElement(element) && !element.isDeleted,
    );
    if (frames.length || excalicordSlidesSigRef.current) {
      const sortedFrames = [...frames].sort((a, b) => {
        if (a.y === b.y) {
          return a.x - b.x;
        }
        return a.y - b.y;
      });
      const signature = sortedFrames
        .map((frame) => `${frame.id}:${frame.x}:${frame.y}`)
        .join("|");
      if (signature !== excalicordSlidesSigRef.current) {
        excalicordSlidesSigRef.current = signature;
        setExcalicordSlides(
          sortedFrames.map((frame, index) => ({
            id: frame.id,
            label: `${index + 1}`,
          })),
        );
      }
    }
    const selectedFrameId = frames.find(
      (frame) => appState.selectedElementIds[frame.id],
    )?.id;
    if (selectedFrameId && selectedFrameId !== excalicordActiveSlideId) {
      setExcalicordActiveSlideId(selectedFrameId);
    } else if (!selectedFrameId && frames.length) {
      const centerFrame = getFrameForViewportCenter(appState, frames);
      if (centerFrame && centerFrame.id !== excalicordActiveSlideId) {
        setExcalicordActiveSlideId(centerFrame.id);
      }
    }

    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // ---------------------------------------------------------------------------
  // onExport — intercepts file save to wait for pending image loads
  // ---------------------------------------------------------------------------
  const onExport: Required<ExcalidrawProps>["onExport"] = useCallback(
    async function* () {
      let snapshot = FileStatusStore.getSnapshot();
      const { pending, total } = FileStatusStore.getPendingCount(
        snapshot.value,
      );
      if (pending === 0) {
        return;
      }

      // Yield initial progress
      yield {
        type: "progress",
        progress: (total - pending) / total,
        message: `Loading images (${total - pending}/${total})...`,
      };

      // Wait for all pending images to finish
      while (true) {
        snapshot = await FileStatusStore.pull(snapshot.version);
        const { pending: nowPending, total: nowTotal } =
          FileStatusStore.getPendingCount(snapshot.value);

        yield {
          type: "progress",
          progress: (nowTotal - nowPending) / nowTotal,
          message: `Loading images (${nowTotal - nowPending}/${nowTotal})...`,
        };

        if (nowPending === 0) {
          await new Promise((r) => setTimeout(r, 500));
          yield {
            type: "progress",
            message: `Preparing export...`,
          };
          return;
        }
      }
    },
    [],
  );

  // const onExport = () => {
  //   return new Promise((r) => setTimeout(r, 2500));
  //   // console.log("onExport");
  // };

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  const ExcalidrawPlusCommand = {
    label: "Excalidraw+",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: ["plus", "cloud", "server"],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };
  const ExcalidrawPlusAppCommand = {
    label: "Sign up",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: [
      "excalidraw",
      "plus",
      "cloud",
      "server",
      "signin",
      "login",
      "signup",
    ],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_APP
        }?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
      })}
    >
      <Excalidraw
        onChange={onChange}
        onExport={onExport}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={isCollaborating}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              onExportToBackend,
              renderCustomUI: excalidrawAPI
                ? (elements, appState, files) => {
                    return (
                      <ExportToExcalidrawPlus
                        elements={elements}
                        appState={appState}
                        files={files}
                        name={excalidrawAPI.getName()}
                        onError={(error) => {
                          excalidrawAPI?.updateScene({
                            appState: {
                              errorMessage: error.message,
                            },
                          });
                        }}
                        onSuccess={() => {
                          excalidrawAPI.updateScene({
                            appState: { openDialog: null },
                          });
                        }}
                      />
                    );
                  }
                : undefined,
            },
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        renderTopRightUI={(isMobile) => {
          if (isMobile || isRecordingOverlayOpen) {
            return null;
          }

          return (
            <div className="excalidraw-ui-top-right">
              <button
                type="button"
                className="excalicord-settings-trigger"
                onClick={() => setIsExcalicordOpen((prev) => !prev)}
                aria-pressed={isExcalicordOpen}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z" />
                  <path d="M4.5 12h2" />
                  <path d="M17.5 12h2" />
                  <path d="M12 4.5v2" />
                  <path d="M12 17.5v2" />
                </svg>
                设置
              </button>
              <button
                type="button"
                className="excalicord-record-trigger"
                onClick={handleRecordToggle}
                aria-pressed={isRecordingOverlayOpen}
              >
                ● 录制
              </button>

              {collabAPI && !isCollabDisabled && (
                <>
                  {collabError.message && (
                    <CollabError collabError={collabError} />
                  )}
                  <LiveCollaborationTrigger
                    isCollaborating={isCollaborating}
                    onSelect={() =>
                      setShareDialogState({ isOpen: true, type: "share" })
                    }
                    editorInterface={editorInterface}
                  />
                </>
              )}
            </div>
          );
        }}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.scrollToContent(element.link, { animate: true });
          }
        }}
      >
        <AppMainMenu
          onCollabDialogOpen={onCollabDialogOpen}
          isCollaborating={isCollaborating}
          isCollabEnabled={!isCollabDisabled}
          theme={appTheme}
          setTheme={(theme) => setAppTheme(theme)}
          refresh={() => forceRefresh((prev) => !prev)}
        />
        <AppWelcomeScreen
          onCollabDialogOpen={onCollabDialogOpen}
          isCollabEnabled={!isCollabDisabled}
        />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
          {excalidrawAPI && (
            <OverwriteConfirmDialog.Action
              title={t("overwriteConfirm.action.excalidrawPlus.title")}
              actionLabel={t("overwriteConfirm.action.excalidrawPlus.button")}
              onClick={() => {
                exportToExcalidrawPlus(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                  excalidrawAPI.getName(),
                );
              }}
            >
              {t("overwriteConfirm.action.excalidrawPlus.description")}
            </OverwriteConfirmDialog.Action>
          )}
        </OverwriteConfirmDialog>
        <AppFooter onChange={() => excalidrawAPI?.refresh()} />
        {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

        <TTDDialogTrigger />
        {isCollaborating && isOffline && (
          <div className="alertalert--warning">
            {t("alerts.collabOfflineWarning")}
          </div>
        )}
        {localStorageQuotaExceeded && (
          <div className="alert alert--danger">
            {t("alerts.localStorageQuotaExceeded")}
          </div>
        )}
        {latestShareableLink && (
          <ShareableLinkDialog
            link={latestShareableLink}
            onCloseRequest={() => setLatestShareableLink(null)}
            setErrorMessage={setErrorMessage}
          />
        )}
        {excalidrawAPI && !isCollabDisabled && (
          <Collab excalidrawAPI={excalidrawAPI} />
        )}

        <ShareDialog
          collabAPI={collabAPI}
          onExportToBackend={async () => {
            if (excalidrawAPI) {
              try {
                await onExportToBackend(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                );
              } catch (error: any) {
                setErrorMessage(error.message);
              }
            }
          }}
        />

        <AppSidebar />
        {!isExcalicordOpen && excalicordSlides.length > 0 && (
          <div className="excalicord-slide-panel">
            <div className="excalicord-slide-panel-title">幻灯片</div>
            {excalicordSlides.map((slide) => (
              <button
                key={slide.id}
                type="button"
                className="excalicord-slide-panel-item"
                data-active={excalicordActiveSlideId === slide.id}
                onClick={() => {
                  if (excalidrawAPI) {
                    setExcalicordActiveSlideId(slide.id);
                    excalidrawAPI.updateScene({
                      appState: {
                        selectedElementIds: { [slide.id]: true },
                      },
                    });
                    scrollToSlide(
                      slide.id,
                      !isRecordingOverlayOpen,
                      isRecordingOverlayOpen,
                    );
                  }
                }}
              >
                {slide.label}
              </button>
            ))}
            <button
              type="button"
              className="excalicord-slide-panel-add"
              onClick={addFrameForAspect}
            >
              +
            </button>
          </div>
        )}
        {isExcalicordOpen && (
          <ExcalicordOverlay
            onClose={() => setIsExcalicordOpen(false)}
            aspect={excalicordAspect}
            onAspectChange={setExcalicordAspect}
            background={excalicordBackground}
            backgrounds={excalicordBackgrounds.current}
            category={excalicordCategory}
            onCategoryChange={setExcalicordCategory}
            layout={excalicordLayout}
            onLayoutChange={setExcalicordLayout}
            recordingPad={excalicordRecordingPad}
            onRecordingPadChange={setExcalicordRecordingPad}
            onRandom={() => {
              const pool =
                excalicordCategory === "all"
                  ? excalicordBackgrounds.current
                  : excalicordBackgrounds.current.filter(
                      (bg) => bg.category === excalicordCategory,
                    );
              if (!pool.length) {
                return;
              }
              const next = pool[Math.floor(Math.random() * pool.length)];
              setExcalicordBackground(next);
              if (excalidrawAPI) {
                excalidrawAPI.updateScene({
                  appState: {
                    viewBackgroundColor: next.color,
                  },
                });
              }
            }}
            showSlideshowHint={showSlideshowHint}
            onRecordStart={handleRecordStart}
            onComplete={() => setIsExcalicordOpen(false)}
            onAddFrame={addFrameForAspect}
            onBackgroundChange={(bg) => {
              setExcalicordBackground(bg);
              if (excalidrawAPI) {
                excalidrawAPI.updateScene({
                  appState: {
                    viewBackgroundColor: bg.color,
                  },
                });
              }
            }}
          />
        )}
        {isRecordingOverlayOpen && excalicordSlides.length > 0 && (
          <div className="excalicord-recording-overlay">
            <div className="excalicord-recording-topbar">
              <div className="excalicord-recording-group">
                <button
                  className="excalicord-recording-icon"
                  aria-label="Settings"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z" />
                    <path d="M4.5 12h2" />
                    <path d="M17.5 12h2" />
                    <path d="M12 4.5v2" />
                    <path d="M12 17.5v2" />
                  </svg>
                </button>
                <button
                  className={clsx("excalicord-recording-icon", {
                    active: isTeleprompterOpen,
                  })}
                  aria-label="提词器"
                  title="提词器"
                  onClick={() => setIsTeleprompterOpen((prev) => !prev)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 4h7l4 4v12H7z" />
                    <path d="M14 4v4h4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="excalicord-recording-cancel"
                  onClick={handleRecordingCancel}
                >
                  × 取消
                </button>
                {recordingStatus === "idle" ? (
                  <button
                    type="button"
                    className="excalicord-recording-start"
                    onClick={handleRecordingStart}
                  >
                    ● 开始录制
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="excalicord-recording-pause"
                      onClick={handleRecordingPauseToggle}
                    >
                      {recordingStatus === "paused" ? "▶ 继续" : "Ⅱ 暂停"}
                    </button>
                    <button
                      type="button"
                      className="excalicord-recording-stop"
                      onClick={handleRecordingStop}
                    >
                      ■ 停止
                    </button>
                    <span className="excalicord-recording-timer">
                      <span className="excalicord-recording-dot" />
                      {recordingElapsed}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div
              className="excalicord-recording-frame"
              style={recordingFrameStyle}
              aria-hidden="true"
            />
            {showSlideshowHint && (
              <div className="excalicord-recording-hint">
                幻灯片模式：录制时按 ← → 键切换幻灯片
              </div>
            )}
            {isTeleprompterOpen && (
              <div
                className="excalicord-teleprompter-panel"
                style={{
                  opacity: teleprompterOpacity / 100,
                  right: `${teleprompterPos.x}px`,
                  top: `${teleprompterPos.y}px`,
                  left: "auto",
                  bottom: "auto",
                }}
              >
                <div
                  className="excalicord-teleprompter-header"
                  onMouseDown={(e) => {
                    teleprompterDragRef.current.isDragging = true;
                    teleprompterDragRef.current.startX = e.clientX;
                    teleprompterDragRef.current.startY = e.clientY;
                    teleprompterDragRef.current.initialX = teleprompterPos.x;
                    teleprompterDragRef.current.initialY = teleprompterPos.y;
                    e.preventDefault();
                  }}
                  style={{ cursor: "move" }}
                >
                  <div className="excalicord-teleprompter-title">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 4h7l4 4v12H7z" />
                      <path d="M14 4v4h4" />
                    </svg>
                    提词器
                  </div>
                  <button
                    className="excalicord-teleprompter-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTeleprompterOpen(false);
                    }}
                    aria-label="关闭提词器"
                  >
                    ×
                  </button>
                </div>
                <div className="excalicord-teleprompter-controls">
                  <button
                    className={clsx("excalicord-teleprompter-play", {
                      playing: teleprompterPlaying,
                    })}
                    onClick={() => setTeleprompterPlaying((p) => !p)}
                    aria-label={teleprompterPlaying ? "暂停" : "播放"}
                  >
                    {teleprompterPlaying ? "⏸" : "▶"}
                  </button>
                  <div className="excalicord-teleprompter-sliders">
                    <div className="excalicord-teleprompter-slider-row">
                      <span>滚动速度</span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={teleprompterSpeed}
                        onChange={(e) =>
                          setTeleprompterSpeed(Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="excalicord-teleprompter-slider-row">
                      <span>透明度</span>
                      <input
                        type="range"
                        min={30}
                        max={100}
                        value={teleprompterOpacity}
                        onChange={(e) =>
                          setTeleprompterOpacity(Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                </div>
                <textarea
                  ref={teleprompterTextareaRef}
                  className="excalicord-teleprompter-textarea"
                  placeholder="在此粘贴你的脚本..."
                  value={teleprompterText}
                  onChange={(e) => setTeleprompterText(e.target.value)}
                  readOnly={teleprompterPlaying}
                />
              </div>
            )}
          </div>
        )}
        {!isExcalicordOpen && excalicordSlides.length === 0 && (
          <div className="excalicord-floating-add">
            {showFirstSlideHint && (
              <span className="excalicord-floating-add-label">
                添加你的第一张幻灯片
              </span>
            )}
            <button
              type="button"
              className="excalicord-floating-add-btn"
              onClick={addFrameForAspect}
              aria-label="Add slide"
            >
              +
            </button>
          </div>
        )}

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: t("labels.liveCollaboration"),
              category: DEFAULT_CATEGORIES.app,
              keywords: [
                "team",
                "multiplayer",
                "share",
                "public",
                "session",
                "invite",
              ],
              icon: usersIcon,
              perform: () => {
                setShareDialogState({
                  isOpen: true,
                  type: "collaborationOnly",
                });
              },
            },
            {
              label: t("roomDialog.button_stopSession"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!collabAPI?.isCollaborating(),
              keywords: [
                "stop",
                "session",
                "end",
                "leave",
                "close",
                "exit",
                "collaboration",
              ],
              perform: () => {
                if (collabAPI) {
                  collabAPI.stopCollaboration();
                  if (!collabAPI.isCollaborating()) {
                    setShareDialogState({ isOpen: false });
                  }
                }
              },
            },
            {
              label: t("labels.share"),
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              icon: share,
              keywords: [
                "link",
                "shareable",
                "readonly",
                "export",
                "publish",
                "snapshot",
                "url",
                "collaborate",
                "invite",
              ],
              perform: async () => {
                setShareDialogState({ isOpen: true, type: "share" });
              },
            },
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/excalidraw/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.followUs"),
              icon: XBrandIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["twitter", "contact", "social", "community"],
              perform: () => {
                window.open(
                  "https://x.com/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.discordChat"),
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              icon: DiscordIcon,
              keywords: [
                "chat",
                "talk",
                "contact",
                "bugs",
                "requests",
                "report",
                "feedback",
                "suggestions",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://discord.gg/UexuTaE",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            ...(isExcalidrawPlusSignedUser
              ? [
                  {
                    ...ExcalidrawPlusAppCommand,
                    label: "Sign in / Go to Excalidraw+",
                  },
                ]
              : [ExcalidrawPlusCommand, ExcalidrawPlusAppCommand]),

            {
              label: t("overwriteConfirm.action.excalidrawPlus.button"),
              category: DEFAULT_CATEGORIES.export,
              icon: exportToPlus,
              predicate: true,
              keywords: ["plus", "export", "save", "backup"],
              perform: () => {
                if (excalidrawAPI) {
                  exportToExcalidrawPlus(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                    excalidrawAPI.getName(),
                  );
                }
              },
            },
            {
              ...CommandPalette.defaultItems.toggleTheme,
              perform: () => {
                setAppTheme(
                  editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                );
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!pwaEvent,
              perform: () => {
                if (pwaEvent) {
                  pwaEvent.prompt();
                  pwaEvent.userChoice.then(() => {
                    // event cannot be reused, but we'll hopefully
                    // grab new one as the event should be fired again
                    pwaEvent = null;
                  });
                }
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>
    </div>
  );
};

const ExcalidrawApp = () => {
  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return <ExcalidrawPlusIframeExport />;
  }

  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <ExcalidrawAPIProvider>
          <ExcalidrawWrapper />
        </ExcalidrawAPIProvider>
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
