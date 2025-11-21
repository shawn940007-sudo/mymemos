import { ThumbsUp } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { memoStore } from "@/store";
import { Memo, Reaction } from "@/types/proto/api/v1/memo_service";
import "./WeiboLikeButton.css";

interface WeiboLikeButtonProps {
  memo: Memo;
  reactions: Reaction[];
  className?: string;
}

/**
 * Weibo-style like button with animation
 * - Single click to like/unlike
 * - Shows animation when liked
 * - Uses thumbs up icon
 */
const WeiboLikeButton = observer(({ memo, reactions, className }: WeiboLikeButtonProps) => {
  const currentUser = useCurrentUser();
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Check if current user has liked (thumbs up reaction)
  const hasLiked = reactions.some(
    (r) => r.reactionType === "👍" && r.creator === currentUser?.name
  );

  const handleLikeClick = async () => {
    if (!currentUser) {
      return;
    }

    try {
      if (hasLiked) {
        // Unlike: find and delete the reaction
        const userReactions = reactions.filter(
          (r) => r.reactionType === "👍" && r.creator === currentUser.name
        );
        for (const reaction of userReactions) {
          await memoServiceClient.deleteMemoReaction({ name: reaction.name });
        }
      } else {
        // Like: add reaction
        setIsAnimating(true);
        await memoServiceClient.upsertMemoReaction({
          name: memo.name,
          reaction: {
            contentId: memo.name,
            reactionType: "👍",
          },
        });
        // Reset animation after a short delay
        setTimeout(() => setIsAnimating(false), 600);
      }
      await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
    } catch (error) {
      console.error("Failed to toggle like:", error);
      setIsAnimating(false);
    }
  };

  return (
    <button
      onClick={handleLikeClick}
      className={cn(
        "weibo-like-button flex items-center gap-1 px-2 py-1 rounded transition-colors",
        hasLiked && "text-red-500",
        !hasLiked && "text-muted-foreground hover:text-foreground",
        className
      )}
      disabled={!currentUser}
    >
      <ThumbsUp
        className={cn(
          "w-4 h-4 transition-transform",
          hasLiked && "weibo-like-icon-liked",
          isAnimating && "weibo-like-icon-animate"
        )}
        fill={hasLiked ? "currentColor" : "none"}
      />
    </button>
  );
});

export default WeiboLikeButton;

