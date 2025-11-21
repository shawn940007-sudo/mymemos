import { MessageCircle } from "lucide-react";
import { observer } from "mobx-react-lite";
import { cn } from "@/lib/utils";
import { Memo } from "@/types/proto/api/v1/memo_service";

interface WeiboCommentButtonProps {
  memo: Memo;
  commentCount: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Weibo-style comment button
 * - Shows comment count
 * - Triggers comment expansion
 */
const WeiboCommentButton = observer(({ memo, commentCount, onClick, className }: WeiboCommentButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      <MessageCircle className="w-4 h-4" />
      {commentCount > 0 && <span className="text-sm">{commentCount}</span>}
    </button>
  );
});

export default WeiboCommentButton;

