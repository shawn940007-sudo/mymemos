import { Repeat2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { memoStore } from "@/store";
import { Memo, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import MemoEditor from "../MemoEditor";
import { Dialog, DialogContent } from "../ui/dialog";

interface WeiboRepostButtonProps {
  memo: Memo;
  repostCount: number;
  className?: string;
}

/**
 * Weibo-style repost button
 * - Shows repost count
 * - Opens dialog to create repost memo
 */
const WeiboRepostButton = observer(({ memo, repostCount, className }: WeiboRepostButtonProps) => {
  const currentUser = useCurrentUser();
  const [showRepostDialog, setShowRepostDialog] = useState(false);

  const handleRepostClick = () => {
    if (!currentUser) {
      return;
    }
    setShowRepostDialog(true);
  };

  const handleRepostConfirm = async (newMemoName: string) => {
    try {
      const newMemo = await memoStore.getOrFetchMemoByName(newMemoName);
      
      // Create REFERENCE relation to original memo
      await memoServiceClient.setMemoRelations({
        name: newMemo.name,
        relations: [
          {
            memo: {
              name: newMemo.name,
            },
            relatedMemo: {
              name: memo.name,
            },
            type: MemoRelation_Type.REFERENCE,
          },
        ],
      });

      // Refresh memo to update repost count
      await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
      setShowRepostDialog(false);
    } catch (error) {
      console.error("Failed to repost:", error);
    }
  };

  return (
    <>
      <button
        onClick={handleRepostClick}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground transition-colors",
          className
        )}
        disabled={!currentUser}
      >
        <Repeat2 className="w-4 h-4" />
        {repostCount > 0 && <span className="text-sm">{repostCount}</span>}
      </button>
      <Dialog open={showRepostDialog} onOpenChange={setShowRepostDialog}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4">
            <div className="text-sm font-medium">转发</div>
            {/* Show original memo preview */}
            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <div className="text-sm text-muted-foreground mb-2">@{memo.creator.split("/")[1]}</div>
              <div className="text-sm whitespace-pre-wrap">{memo.content}</div>
            </div>
            <MemoEditor
              cacheKey={`repost-${memo.name}`}
              placeholder="说点什么..."
              autoFocus
              onConfirm={handleRepostConfirm}
              onCancel={() => setShowRepostDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default WeiboRepostButton;

