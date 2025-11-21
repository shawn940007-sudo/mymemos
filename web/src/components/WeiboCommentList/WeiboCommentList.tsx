import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";
import { memoServiceClient } from "@/grpcweb";
import { memoStore, userStore } from "@/store";
import { Memo, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import MemoEditor from "../MemoEditor";
import MemoView from "../MemoView";
import { cn } from "@/lib/utils";

// Comment item component with reply functionality
const CommentItem = observer(({ 
  comment, 
  depth, 
  allComments, 
  parentMemoName,
  onCommentsUpdate 
}: { 
  comment: Memo; 
  depth: number; 
  allComments: Memo[]; 
  parentMemoName: string;
  onCommentsUpdate: () => void;
}) => {
  const [showReplyEditor, setShowReplyEditor] = useState(false);
  
  // Find child comments (comments whose parent is this comment)
  const childComments = allComments.filter((c) => c.parent === comment.name);

  const handleReplyCreated = async (replyMemoName: string) => {
    try {
      const replyMemo = await memoStore.getOrFetchMemoByName(replyMemoName);
      
      // Create COMMENT relation to the original memo (not the parent comment)
      await memoServiceClient.setMemoRelations({
        name: replyMemo.name,
        relations: [
          {
            memo: {
              name: replyMemo.name,
            },
            relatedMemo: {
              name: parentMemoName,
            },
            type: MemoRelation_Type.COMMENT,
          },
        ],
      });

      onCommentsUpdate();
      setShowReplyEditor(false);
    } catch (error) {
      console.error("Failed to create reply:", error);
    }
  };

  return (
    <div className={cn("w-full", depth > 0 && "ml-4 border-l-2 border-border/30 pl-3")}>
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <MemoView memo={comment} showCreator compact className="mb-0" />
          </div>
          <button
            onClick={() => setShowReplyEditor(!showReplyEditor)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            回复
          </button>
        </div>
        {showReplyEditor && (
          <div className="pt-2 border-t border-border/30">
            <MemoEditor
              cacheKey={`reply-${comment.name}`}
              placeholder={`回复 @${comment.creator.split("/")[1]}...`}
              parentMemoName={comment.name}
              autoFocus
              onConfirm={handleReplyCreated}
              onCancel={() => setShowReplyEditor(false)}
            />
          </div>
        )}
        {childComments.length > 0 && (
          <div className="mt-1 space-y-1">
            {childComments.map((child) => (
              <CommentItem
                key={child.name}
                comment={child}
                depth={depth + 1}
                allComments={allComments}
                parentMemoName={parentMemoName}
                onCommentsUpdate={onCommentsUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

interface WeiboCommentListProps {
  memo: Memo;
  className?: string;
}

/**
 * Weibo-style comment list with nested comments support
 * - Shows comments inline under the memo
 * - Supports nested comments (comments on comments)
 * - Recursive rendering with indentation
 */
const WeiboCommentList = observer(({ memo, className }: WeiboCommentListProps) => {
  const [comments, setComments] = useState<Memo[]>([]);
  const [allComments, setAllComments] = useState<Memo[]>([]);
  const [showCommentEditor, setShowCommentEditor] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      try {
        // Get all COMMENT relations where relatedMemo is the current memo
        const relations = await memoServiceClient.listMemoRelations({
          name: memo.name,
        });

        const commentRelations = relations.relations.filter(
          (r) => r.type === MemoRelation_Type.COMMENT && r.relatedMemo?.name === memo.name
        );

        // Fetch all comment memos
        const allCommentMemos = await Promise.all(
          commentRelations.map((r) => memoStore.getOrFetchMemoByName(r.memo!.name))
        );

        // Build comment tree
        // Top-level comments: parent is the original memo or undefined
        const topLevelComments = allCommentMemos.filter((c) => !c.parent || c.parent === memo.name);

        setComments(topLevelComments);
        setAllComments(allCommentMemos);
      } catch (error) {
        console.error("Failed to load comments:", error);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [memo.name]);

  const handleCommentCreated = async (commentMemoName: string) => {
    try {
      const commentMemo = await memoStore.getOrFetchMemoByName(commentMemoName);
      
      // Create COMMENT relation
      await memoServiceClient.setMemoRelations({
        name: commentMemo.name,
        relations: [
          {
            memo: {
              name: commentMemo.name,
            },
            relatedMemo: {
              name: memo.name,
            },
            type: MemoRelation_Type.COMMENT,
          },
        ],
      });

      // Refresh comments
      await refreshComments();
      setShowCommentEditor(false);
    } catch (error) {
      console.error("Failed to create comment:", error);
    }
  };

  const refreshComments = async () => {
    const relations = await memoServiceClient.listMemoRelations({
      name: memo.name,
    });
    const commentRelations = relations.relations.filter(
      (r) => r.type === MemoRelation_Type.COMMENT && r.relatedMemo?.name === memo.name
    );
    const allCommentMemos = await Promise.all(
      commentRelations.map((r) => memoStore.getOrFetchMemoByName(r.memo!.name))
    );
    const topLevelComments = allCommentMemos.filter((c) => !c.parent || c.parent === memo.name);
    setComments(topLevelComments);
    setAllComments(allCommentMemos);
    await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
  };

  if (loading) {
    return <div className={cn("text-sm text-muted-foreground p-2", className)}>加载中...</div>;
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentItem
              key={comment.name}
              comment={comment}
              depth={0}
              allComments={allComments}
              parentMemoName={memo.name}
              onCommentsUpdate={refreshComments}
            />
          ))}
        </div>
      )}
      {showCommentEditor && (
        <div className="pt-2 border-t border-border">
            <MemoEditor
              cacheKey={`comment-${memo.name}`}
              placeholder="写评论..."
              parentMemoName={memo.name}
              autoFocus
              onConfirm={handleCommentCreated}
              onCancel={() => setShowCommentEditor(false)}
            />
        </div>
      )}
      {!showCommentEditor && (
        <button
          onClick={() => setShowCommentEditor(true)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          写评论...
        </button>
      )}
    </div>
  );
});

export default WeiboCommentList;

