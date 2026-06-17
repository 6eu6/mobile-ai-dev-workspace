import React, { useState, useCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { ensureSignedIn } from '~/lib/stores/auth';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { ModelSelector } from '~/components/chat/ModelSelector';
import { APIKeyManager } from './APIKeyManager';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import FilePreview from './FilePreview';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { SendButton } from './SendButton.client';
import { IconButton } from '~/components/ui/IconButton';
import { toast } from 'react-toastify';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import { SupabaseConnection } from './SupabaseConnection';
import { ExpoQrModal } from '~/components/workbench/ExpoQrModal';
import styles from './BaseChat.module.scss';
import type { ProviderInfo } from '~/types/model';
import { ColorSchemeDialog } from '~/components/ui/ColorSchemeDialog';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { McpTools } from './MCPTools';
import { WebSearch } from './WebSearch.client';

interface ChatBoxProps {
  isModelSettingsCollapsed: boolean;
  setIsModelSettingsCollapsed: (collapsed: boolean) => void;
  provider: any;
  providerList: any[];
  modelList: any[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement> | undefined;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  TEXTAREA_MIN_HEIGHT: number;
  TEXTAREA_MAX_HEIGHT: number;
  isStreaming: boolean;
  handleSendMessage: (event: React.UIEvent, messageInput?: string) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatStarted: boolean;
  exportChat?: () => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  handleFileUpload: () => void;
  setProvider?: ((provider: ProviderInfo) => void) | undefined;
  model?: string | undefined;
  setModel?: ((model: string) => void) | undefined;
  setUploadedFiles?: ((files: File[]) => void) | undefined;
  setImageDataList?: ((dataList: string[]) => void) | undefined;
  handleInputChange?: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  handleStop?: (() => void) | undefined;
  enhancingPrompt?: boolean | undefined;
  enhancePrompt?: (() => void) | undefined;
  onWebSearchResult?: (result: string) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: ((element: ElementInfo | null) => void) | undefined;
}

/* ---------- Mistral-style "+" bottom sheet ---------- */
function PlusBottomSheet({
  open,
  onClose,
  onFileUpload,
  onWebSearch,
  onEnhance,
  enhancingPrompt,
  inputLength,
  isStreaming,
  chatStarted,
  chatMode,
  setChatMode,
  designScheme,
  setDesignScheme,
}: {
  open: boolean;
  onClose: () => void;
  onFileUpload: () => void;
  onWebSearch: () => void;
  onEnhance: () => void;
  enhancingPrompt?: boolean;
  inputLength: number;
  isStreaming: boolean;
  chatStarted: boolean;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
}) {
  if (!open) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fade-in 0.15s ease-out' }}
      />
      {/* Sheet */}
      <div
        className={classNames(
          'fixed bottom-0 left-0 right-0 z-[101]',
          'bg-palmkit-elements-bg-depth-1 dark:bg-[#141414]',
          'border-t border-palmkit-elements-borderColor',
          'rounded-t-2xl',
          'shadow-[0_-4px_30px_rgba(0,0,0,0.15)]',
          'max-h-[70vh] overflow-y-auto',
        )}
        style={{ animation: 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-palmkit-elements-borderColor" />
        </div>

        {/* Action grid */}
        <div className="grid grid-cols-4 gap-1 px-4 pb-6 pt-2">
          <SheetAction
            icon="i-ph:paperclip"
            label="Upload"
            onClick={() => handleAction(onFileUpload)}
          />
          <SheetAction
            icon="i-ph:globe"
            label="Web Search"
            onClick={() => handleAction(onWebSearch)}
            disabled={isStreaming}
          />
          <SheetAction
            icon="i-palmkit:stars"
            label="Enhance"
            onClick={() => handleAction(onEnhance)}
            disabled={inputLength === 0 || enhancingPrompt}
            loading={enhancingPrompt}
          />
          <SheetAction
            icon="i-ph:microphone"
            label="Voice"
            onClick={onClose} /* voice is handled by the main bar */
          />
          {chatStarted && (
            <SheetAction
              icon={chatMode === 'discuss' ? 'i-ph:hammer' : 'i-ph:chats'}
              label={chatMode === 'discuss' ? 'Build' : 'Discuss'}
              onClick={() => {
                setChatMode?.(chatMode === 'discuss' ? 'build' : 'discuss');
                onClose();
              }}
              active={chatMode === 'build'}
            />
          )}
          <SheetAction
            icon="i-ph:paint-brush"
            label="Design"
            onClick={onClose} /* design dialog opens separately */
          >
            <ColorSchemeDialog designScheme={designScheme} setDesignScheme={setDesignScheme} />
          </SheetAction>
          <SheetAction
            icon="i-palmkit:mcp"
            label="MCP"
            onClick={onClose} /* MCP dialog opens separately */
          >
            <McpTools />
          </SheetAction>
          <SheetAction
            icon="i-ph:database"
            label="Supabase"
            onClick={onClose} /* Supabase dialog opens separately */
          >
            <SupabaseConnection />
          </SheetAction>
        </div>
      </div>
    </>
  );
}

/* Single action tile inside the sheet */
function SheetAction({
  icon,
  label,
  onClick,
  disabled,
  active,
  loading,
  children,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-150',
        'active:scale-95',
        active
          ? 'bg-palmkit-elements-item-backgroundActive text-palmkit-elements-textPrimary'
          : 'text-palmkit-elements-textTertiary hover:bg-palmkit-elements-item-backgroundActive hover:text-palmkit-elements-textPrimary',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {loading ? (
        <div className="i-svg-spinners:90-ring-with-bg text-palmkit-elements-loader-progress text-[20px] animate-spin" />
      ) : (
        <div className={`${icon} text-[20px]`} />
      )}
      <span className="text-[11px] font-medium">{label}</span>
      {/* Invisible trigger for dialogs that need to render inside */}
      {children && <div className="absolute opacity-0 pointer-events-none">{children}</div>}
    </button>
  );
}

/* ---------- Main ChatBox ---------- */
export const ChatBox: React.FC<ChatBoxProps> = (props) => {
  const [isPlusOpen, setIsPlusOpen] = useState(false);

  const openPlusSheet = useCallback(() => setIsPlusOpen(true), []);
  const closePlusSheet = useCallback(() => setIsPlusOpen(false), []);

  return (
    <div
      className={classNames(
        'relative w-full max-w-chat mx-auto z-prompt',
        'rounded-2xl',
        'bg-palmkit-elements-prompt-background',
        'border border-palmkit-elements-borderColor',
        'shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]',
        'transition-shadow duration-200',
        'focus-within:shadow-[0_0_0_1px_var(--palmkit-elements-borderColorActive)]',
        'focus-within:border-palmkit-elements-borderColorActive',
      )}
    >
      {/* Model settings - collapsible section */}
      <div>
        <ClientOnly>
          {() => (
            <div className={props.isModelSettingsCollapsed ? 'hidden' : ''}>
              <ModelSelector
                key={props.provider?.name + ':' + props.modelList.length}
                model={props.model}
                setModel={props.setModel}
                modelList={props.modelList}
                provider={props.provider}
                setProvider={props.setProvider}
                providerList={props.providerList || (PROVIDER_LIST as ProviderInfo[])}
                apiKeys={props.apiKeys}
                modelLoading={props.isModelLoading}
              />
              {(props.providerList || []).length > 0 &&
                props.provider &&
                !LOCAL_PROVIDERS.includes(props.provider.name) && (
                  <APIKeyManager
                    provider={props.provider}
                    apiKey={props.apiKeys[props.provider.name] || ''}
                    setApiKey={(key) => {
                      props.onApiKeysChange(props.provider.name, key);
                    }}
                  />
                )}
            </div>
          )}
        </ClientOnly>
      </div>

      {/* File previews */}
      <FilePreview
        files={props.uploadedFiles}
        imageDataList={props.imageDataList}
        onRemove={(index) => {
          props.setUploadedFiles?.(props.uploadedFiles.filter((_, i) => i !== index));
          props.setImageDataList?.(props.imageDataList.filter((_, i) => i !== index));
        }}
      />
      <ClientOnly>
        {() => (
          <ScreenshotStateManager
            setUploadedFiles={props.setUploadedFiles}
            setImageDataList={props.setImageDataList}
            uploadedFiles={props.uploadedFiles}
            imageDataList={props.imageDataList}
          />
        )}
      </ClientOnly>

      {/* Element inspector banner */}
      {props.selectedElement && (
        <div className="flex mx-2 mt-1 gap-2 items-center justify-between rounded-lg border border-palmkit-elements-borderColor text-palmkit-elements-textPrimary py-1 px-2.5 text-xs">
          <div className="flex gap-2 items-center lowercase">
            <code className="bg-palmkit-elements-button-primary-background text-palmkit-elements-button-primary-text rounded px-1.5 py-0.5 mr-0.5 text-[10px] font-bold">
              {props?.selectedElement?.tagName}
            </code>
            <span className="text-palmkit-elements-textSecondary">selected for inspection</span>
          </div>
          <button
            className="text-palmkit-elements-button-primary-text text-xs font-medium hover:underline"
            onClick={() => props.setSelectedElement?.(null)}
          >
            Clear
          </button>
        </div>
      )}

      {/* Main input row — Mistral-style: [+] [textarea] [mic] [send] */}
      <div className="flex items-end gap-0 px-2 pt-2">
        {/* "+" button — opens bottom sheet with all tools */}
        <button
          type="button"
          onClick={openPlusSheet}
          className={classNames(
            'shrink-0 mb-2 w-8 h-8 rounded-full flex items-center justify-center',
            'text-palmkit-elements-textTertiary hover:text-palmkit-elements-textPrimary',
            'hover:bg-palmkit-elements-item-backgroundActive',
            'transition-colors duration-150',
          )}
          title="More tools"
        >
          <div className="i-ph:plus text-[18px]" />
        </button>

        {/* Textarea */}
        <div className="relative flex-1 min-w-0">
          <textarea
            ref={props.textareaRef}
            className={classNames(
              'w-full pl-2 pr-10 py-2.5 outline-none resize-none',
              'text-palmkit-elements-textPrimary placeholder-palmkit-elements-textTertiary',
              'bg-transparent text-sm sm:text-[16px] leading-relaxed',
              'transition-colors duration-150',
            )}
            onMouseDown={(e) => {
              if (!ensureSignedIn()) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            onFocus={(e) => {
              if (!ensureSignedIn()) {
                e.currentTarget.blur();
              }
            }}
            onDragEnter={(e) => { e.preventDefault(); }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDragLeave={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              files.forEach((file) => {
                if (file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const base64Image = ev.target?.result as string;
                    props.setUploadedFiles?.([...props.uploadedFiles, file]);
                    props.setImageDataList?.([...props.imageDataList, base64Image]);
                  };
                  reader.readAsDataURL(file);
                }
              });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (event.shiftKey) return;
                event.preventDefault();
                if (props.isStreaming) { props.handleStop?.(); return; }
                if (event.nativeEvent.isComposing) return;
                props.handleSendMessage?.(event);
              }
            }}
            value={props.input}
            onChange={(event) => {
              if (!ensureSignedIn()) return;
              props.handleInputChange?.(event);
            }}
            onPaste={props.handlePaste}
            style={{
              minHeight: props.TEXTAREA_MIN_HEIGHT,
              maxHeight: props.TEXTAREA_MAX_HEIGHT,
            }}
            placeholder={props.chatMode === 'build' ? 'What do you want to build?' : 'Ask anything...'}
            translate="no"
          />

          {/* Send / Stop — inside textarea */}
          <ClientOnly>
            {() => (
              <SendButton
                show={props.input.length > 0 || props.isStreaming || props.uploadedFiles.length > 0}
                isStreaming={props.isStreaming}
                disabled={!props.providerList || props.providerList.length === 0}
                onClick={(event) => {
                  if (props.isStreaming) { props.handleStop?.(); return; }
                  if (props.input.length > 0 || props.uploadedFiles.length > 0) {
                    props.handleSendMessage?.(event);
                  }
                }}
              />
            )}
          </ClientOnly>
        </div>

        {/* Microphone */}
        <ClientOnly>
          {() => (
            <SpeechRecognitionButton
              isListening={props.isListening}
              onStart={props.startListening}
              onStop={props.stopListening}
              disabled={props.isStreaming}
            />
          )}
        </ClientOnly>
      </div>

      {/* Compact bottom bar — model name only */}
      <div className="flex items-center justify-between px-2 pb-1.5 pt-0">
        <div className="flex items-center gap-1 min-w-0">
          <IconButton
            title="Model Settings"
            className={classNames(
              '!p-1 rounded-md transition-all duration-150 flex items-center gap-1',
              'text-palmkit-elements-textTertiary hover:text-palmkit-elements-textPrimary',
            )}
            onClick={() => props.setIsModelSettingsCollapsed(!props.isModelSettingsCollapsed)}
            disabled={!props.providerList || props.providerList.length === 0}
          >
            <div className={`i-ph:caret-${props.isModelSettingsCollapsed ? 'right' : 'down'} text-[12px]`} />
            <span className="text-[11px] font-medium max-w-[120px] truncate text-palmkit-elements-textTertiary">
              {props.model}
            </span>
          </IconButton>
        </div>
        {props.chatStarted && (
          <button
            className={classNames(
              'text-[11px] font-medium px-2 py-0.5 rounded-md transition-all duration-150',
              props.chatMode === 'build'
                ? 'bg-palmkit-elements-item-backgroundActive text-palmkit-elements-textPrimary'
                : 'text-palmkit-elements-textTertiary hover:text-palmkit-elements-textPrimary',
            )}
            onClick={() => props.setChatMode?.(props.chatMode === 'discuss' ? 'build' : 'discuss')}
          >
            {props.chatMode === 'discuss' ? 'Discuss' : 'Build'}
          </button>
        )}
      </div>

      {/* Mobile keyboard hint */}
      {props.input.length > 1 && (
        <div className="flex sm:hidden items-center justify-end px-3 pb-1.5">
          <div className="text-[10px] text-palmkit-elements-textTertiary">
            <kbd className="px-1 py-0.5 rounded bg-palmkit-elements-bg-depth-2 text-[10px]">Enter</kbd> send{' '}
            <kbd className="px-1 py-0.5 rounded bg-palmkit-elements-bg-depth-2 text-[10px]">Shift+Enter</kbd> new line
          </div>
        </div>
      )}

      <ExpoQrModal open={props.qrModalOpen} onClose={() => props.setQrModalOpen(false)} />

      {/* Plus bottom sheet */}
      <ClientOnly>
        {() => (
          <PlusBottomSheet
            open={isPlusOpen}
            onClose={closePlusSheet}
            onFileUpload={props.handleFileUpload}
            onWebSearch={() => {
              /* WebSearch needs special handling - it opens its own inline UI */
            }}
            onEnhance={() => {
              props.enhancePrompt?.();
              toast.success('Prompt enhanced!');
            }}
            enhancingPrompt={props.enhancingPrompt}
            inputLength={props.input.length}
            isStreaming={props.isStreaming}
            chatStarted={props.chatStarted}
            chatMode={props.chatMode}
            setChatMode={props.setChatMode}
            designScheme={props.designScheme}
            setDesignScheme={props.setDesignScheme}
          />
        )}
      </ClientOnly>
    </div>
  );
};
