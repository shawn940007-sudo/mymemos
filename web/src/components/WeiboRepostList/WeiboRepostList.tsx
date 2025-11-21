import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";
import { memoServiceClient } from "@/grpcweb";
import { memoStore } from "@/store";
import { Memo, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import MemoView from "../MemoView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

interface WeiboRepostListProps {
  memo: Memo;
  repostCount: number;
  onClose?: () => void;
}

/**
 * Weibo-style repost list dialog
 * - Shows all memos that reposted this memo
 * - Displays in a dialog/modal
 */
const WeiboRepostList = observer(({ memo, repostCount, onClose }: WeiboRepostListProps) => {
  const [reposts, setReposts] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadReposts = async () => {
    setLoading(true);
    try {
      // Get all REFERENCE relations where relatedMemo is the current memo
      const relations = await memoServiceClient.listMemoRelations({
        name: memo.name,
      });

      const repostRelations = relations.relations.filter(
        (r) => r.type === MemoRelation_Type.REFERENCE && r.relatedMemo?.name === memo.name
      );

      // Fetch all repost memos
      const repostMemos = await Promise.all(
        repostRelations.map((r) => memoStore.getOrFetchMemoByName(r.memo!.name))
      );

      setReposts(repostMemos);
    } catch (error) {
      console.error("Failed to load reposts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadReposts();
    }
  }, [open, memo.name]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && onClose) {
      onClose();
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        查看转发 ({repostCount})
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>转发 ({repostCount})</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="text-sm text-muted-foreground p-4">加载中...</div>
          ) : reposts.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">暂无转发</div>
          ) : (
            <div className="space-y-2">
              {reposts.map((repost) => (
                <MemoView key={repost.name} memo={repost} showCreator compact />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

export default WeiboRepostList;

