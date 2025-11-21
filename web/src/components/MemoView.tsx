import { BookmarkIcon, EyeOffIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { instanceStore, memoStore, userStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { Memo, MemoRelation_Type, Visibility } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";
import { isSuperUser } from "@/utils/user";
import { getClientInfo } from "@/utils/client-info";
import MemoActionMenu from "./MemoActionMenu";
import MemoContent from "./MemoContent";
import MemoEditor from "./MemoEditor";
import { LocationDisplay } from "./memo-metadata";
import PreviewImageDialog from "./PreviewImageDialog";
import UserAvatar from "./UserAvatar";
import VisibilityIcon from "./VisibilityIcon";
import ImageGrid from "./ImageGrid/ImageGrid";
import WeiboLikeButton from "./WeiboLikeButton/WeiboLikeButton";
import WeiboRepostButton from "./WeiboRepostButton/WeiboRepostButton";
import WeiboCommentButton from "./WeiboCommentButton/WeiboCommentButton";
import WeiboCommentList from "./WeiboCommentList/WeiboCommentList";
import WeiboRepostList from "./WeiboRepostList/WeiboRepostList";

interface Props {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  showNsfwContent?: boolean;
  className?: string;
  parentPage?: string;
}

const MemoView: React.FC<Props> = observer((props: Props) => {
  const { memo, className } = props;
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();
  const user = useCurrentUser();
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [creator, setCreator] = useState(userStore.getUserByName(memo.creator));
  const [showNSFWContent, setShowNSFWContent] = useState(props.showNsfwContent);
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number }>({
    open: false,
    urls: [],
    index: 0,
  });
  const [shortcutActive, setShortcutActive] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const instanceMemoRelatedSetting = instanceStore.state.memoRelatedSetting;
  
  // Get repost count (memos that reference this memo)
  const repostCount = memo.relations.filter(
    (relation) => relation.type === MemoRelation_Type.REFERENCE && relation.relatedMemo?.name === memo.name
  ).length;
  
  // Get comment count
  const commentCount = memo.relations.filter(
    (relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memo.name
  ).length;
  
  // Check if this memo is a repost (has REFERENCE relation where memo is this memo)
  const isRepost = memo.relations.some(
    (relation) => relation.type === MemoRelation_Type.REFERENCE && relation.memo?.name === memo.name
  );
  const originalMemoRelation = memo.relations.find(
    (relation) => relation.type === MemoRelation_Type.REFERENCE && relation.memo?.name === memo.name
  );
  const [originalMemo, setOriginalMemo] = useState<Memo | null>(null);
  
  const relativeTimeFormat = Date.now() - memo.displayTime!.getTime() > 1000 * 60 * 60 * 24 ? "datetime" : "auto";
  const isArchived = memo.state === State.ARCHIVED;
  const readonly = memo.creator !== user?.name && !isSuperUser(user);
  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);
  const parentPage = props.parentPage || location.pathname;
  const clientInfo = getClientInfo();
  const nsfw =
    instanceMemoRelatedSetting.enableBlurNsfwContent &&
    memo.tags?.some((tag) => instanceMemoRelatedSetting.nsfwTags.some((nsfwTag) => tag === nsfwTag || tag.startsWith(`${nsfwTag}/`)));

  // Initial related data: creator and original memo if repost
  useAsyncEffect(async () => {
    const user = await userStore.getOrFetchUserByName(memo.creator);
    setCreator(user);
    
    // Load original memo if this is a repost
    if (originalMemoRelation?.relatedMemo?.name) {
      try {
        const original = await memoStore.getOrFetchMemoByName(originalMemoRelation.relatedMemo.name);
        setOriginalMemo(original);
      } catch (error) {
        console.error("Failed to load original memo:", error);
      }
    }
  }, []);

  const handleGotoMemoDetailPage = useCallback(() => {
    navigateTo(`/${memo.name}`, {
      state: {
        from: parentPage,
      },
    });
  }, [memo.name, parentPage]);

  const handleMemoContentClick = useCallback(async (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.tagName === "IMG") {
      const linkElement = targetEl.closest("a");
      if (linkElement) {
        return;
      }

      const imgUrl = targetEl.getAttribute("src");
      if (imgUrl) {
        setPreviewImage({ open: true, urls: [imgUrl], index: 0 });
      }
    }
  }, []);

  const handleMemoContentDoubleClick = useCallback(async (e: React.MouseEvent) => {
    if (readonly) {
      return;
    }

    if (instanceMemoRelatedSetting.enableDoubleClickEdit) {
      e.preventDefault();
      setShowEditor(true);
    }
  }, []);

  const onEditorConfirm = () => {
    setShowEditor(false);
    userStore.setStatsStateId();
  };

  const archiveMemo = useCallback(async () => {
    if (isArchived) {
      return;
    }

    try {
      await memoStore.updateMemo(
        {
          name: memo.name,
          state: State.ARCHIVED,
        },
        ["state"],
      );
      toast.success(t("message.archived-successfully"));
      userStore.setStatsStateId();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.details);
    }
  }, [isArchived, memo.name, t, memoStore, userStore]);

  useEffect(() => {
    if (!shortcutActive || readonly || showEditor || !cardRef.current) {
      return;
    }

    const cardEl = cardRef.current;
    const isTextInputElement = (element: HTMLElement | null) => {
      if (!element) {
        return false;
      }
      if (element.isContentEditable) {
        return true;
      }
      if (element instanceof HTMLTextAreaElement) {
        return true;
      }
      if (element instanceof HTMLInputElement) {
        const textTypes = ["text", "search", "email", "password", "url", "tel", "number"];
        return textTypes.includes(element.type || "text");
      }
      return false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!cardEl.contains(target) || isTextInputElement(target)) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "e") {
        event.preventDefault();
        setShowEditor(true);
      } else if (key === "a" && !isArchived) {
        event.preventDefault();
        archiveMemo();
      }
    };

    cardEl.addEventListener("keydown", handleKeyDown);
    return () => cardEl.removeEventListener("keydown", handleKeyDown);
  }, [shortcutActive, readonly, showEditor, isArchived, archiveMemo]);

  useEffect(() => {
    if (showEditor || readonly) {
      setShortcutActive(false);
    }
  }, [showEditor, readonly]);

  const handleShortcutActivation = (active: boolean) => {
    if (readonly) {
      return;
    }
    setShortcutActive(active);
  };

  const displayTime = isArchived ? (
    memo.displayTime?.toLocaleString()
  ) : (
    <relative-time datetime={memo.displayTime?.toISOString()} format={relativeTimeFormat}></relative-time>
  );

  // Weibo-style layout
  return showEditor ? (
    <MemoEditor
      autoFocus
      className="mb-2"
      cacheKey={`inline-memo-editor-${memo.name}`}
      memoName={memo.name}
      onConfirm={onEditorConfirm}
      onCancel={() => setShowEditor(false)}
    />
  ) : (
    <div
      className={cn(
        "relative group flex flex-col justify-start items-start bg-card w-full px-3 py-2 mb-2 gap-2 text-card-foreground rounded-lg border border-border transition-colors",
        shortcutActive && !showEditor && "border-ring ring-2 ring-ring bg-accent/10",
        className,
      )}
      ref={cardRef}
      tabIndex={readonly ? -1 : 0}
      onFocus={() => handleShortcutActivation(true)}
      onBlur={() => handleShortcutActivation(false)}
    >
      {/* Header: Avatar, ID, Time, Menu */}
      <div className="w-full flex flex-row justify-start items-start gap-2">
        {/* Avatar */}
        {props.showCreator && creator ? (
          <Link
            className="w-auto hover:opacity-80 rounded-md transition-colors shrink-0"
            to={`/u/${encodeURIComponent(creator.username)}`}
            viewTransition
          >
            <UserAvatar className="w-10 h-10" avatarUrl={creator.avatarUrl} />
          </Link>
        ) : (
          <div className="w-10 h-10 shrink-0" />
        )}
        
        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* ID and Menu row */}
          <div className="w-full flex flex-row justify-between items-start">
            <div className="flex-1 min-w-0 flex flex-col">
              {props.showCreator && creator ? (
                <Link
                  className="text-sm font-medium hover:opacity-80 rounded-md transition-colors truncate"
                  to={`/u/${encodeURIComponent(creator.username)}`}
                  viewTransition
                >
                  {creator.displayName || creator.username}
                </Link>
              ) : null}
              <div className="flex flex-row items-center gap-1 text-xs text-muted-foreground">
                <span
                  className="cursor-pointer hover:opacity-80 transition-colors"
                  onClick={handleGotoMemoDetailPage}
                >
                  {displayTime}
                </span>
                {clientInfo && (
                  <>
                    <span>·</span>
                    <span>{clientInfo}</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Right side: Visibility, Pinned, Menu */}
            <div className="flex flex-row justify-end items-center select-none shrink-0 gap-1">
              {props.showVisibility && memo.visibility !== Visibility.PRIVATE && (
                <Tooltip>
                  <TooltipTrigger>
                    <span className="flex justify-center items-center rounded-md hover:opacity-80">
                      <VisibilityIcon visibility={memo.visibility} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as any)}</TooltipContent>
                </Tooltip>
              )}
              {props.showPinned && memo.pinned && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer">
                        <BookmarkIcon className="w-4 h-auto text-primary" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("common.pinned")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {nsfw && showNSFWContent && (
                <span className="cursor-pointer">
                  <EyeOffIcon className="w-4 h-auto text-primary" onClick={() => setShowNSFWContent(false)} />
                </span>
              )}
              <MemoActionMenu memo={memo} readonly={readonly} onEdit={() => setShowEditor(true)} />
            </div>
          </div>
          
          {/* Content */}
          <div
            className={cn(
              "w-full flex flex-col justify-start items-start gap-2",
              nsfw && !showNSFWContent && "blur-lg transition-all duration-200",
            )}
          >
            {/* Repost preview (if this is a repost) */}
            {isRepost && originalMemo && (
              <div className="w-full bg-muted/50 rounded-lg p-3 border border-border">
                <div className="text-xs text-muted-foreground mb-1">
                  @{originalMemo.creator.split("/")[1]}
                </div>
                <MemoContent
                  memoName={originalMemo.name}
                  content={originalMemo.content}
                  readonly={true}
                  compact={true}
                  className="text-sm"
                />
                {originalMemo.attachments && originalMemo.attachments.length > 0 && (
                  <ImageGrid attachments={originalMemo.attachments} className="mt-2" />
                )}
              </div>
            )}
            
            {/* Main content */}
            <MemoContent
              key={`${memo.name}-${memo.updateTime}`}
              memoName={memo.name}
              content={memo.content}
              readonly={readonly}
              onClick={handleMemoContentClick}
              onDoubleClick={handleMemoContentDoubleClick}
              compact={memo.pinned ? false : props.compact}
              parentPage={parentPage}
            />
            
            {/* Tags (if any) */}
            {memo.tags && memo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {memo.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/explore?tag=${encodeURIComponent(tag)}`}
                    className="text-xs text-primary hover:underline"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
            
            {/* Location */}
            {memo.location && <LocationDisplay mode="view" location={memo.location} />}
            
            {/* Images - Weibo style grid */}
            {memo.attachments && memo.attachments.length > 0 && (
              <ImageGrid attachments={memo.attachments} />
            )}
          </div>
          
          {/* Action bar: Repost, Comment, Like */}
          <div className="w-full flex flex-row justify-start items-center gap-4 pt-1 border-t border-border/50">
            <WeiboRepostButton memo={memo} repostCount={repostCount} />
            <WeiboCommentButton
              memo={memo}
              commentCount={commentCount}
              onClick={() => setShowComments(!showComments)}
            />
            <WeiboLikeButton memo={memo} reactions={memo.reactions} />
            {repostCount > 0 && (
              <WeiboRepostList memo={memo} repostCount={repostCount} />
            )}
          </div>
          
          {/* Comments section */}
          {showComments && (
            <div className="w-full pt-2">
              <WeiboCommentList memo={memo} />
            </div>
          )}
        </div>
      </div>
      
      {nsfw && !showNSFWContent && (
        <>
          <div className="absolute inset-0 bg-transparent" />
          <button
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 py-2 px-4 text-sm text-muted-foreground hover:text-foreground hover:bg-accent hover:border-accent border border-border rounded-lg bg-card transition-colors"
            onClick={() => setShowNSFWContent(true)}
          >
            {t("memo.click-to-show-nsfw-content")}
          </button>
        </>
      )}

      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
      />
    </div>
  );
});

export default memo(MemoView);
