import { buildThread, type ThreadNode } from "@/lib/community/aggregate";
import type { Comment } from "@/lib/community/types";

/**
 * DiscussionThread — renders a per-item DISCUSSION as a nested, chronological
 * tree built by the pure `buildThread`. Presentational only: it does not fetch
 * or mutate; a `onReply(parentId)` callback lets the integrator open a composer.
 * Replies are visually indented with a hairline rail; deep nesting is capped for
 * readability (deeper replies still render, just at the max indent).
 */
const MAX_INDENT = 4;

function ThreadItem({
  node,
  depth,
  onReply,
}: {
  node: ThreadNode;
  depth: number;
  onReply?: (parentId: string) => void;
}) {
  const indent = Math.min(depth, MAX_INDENT);
  return (
    <li
      className={indent > 0 ? "border-l border-subtle pl-3" : undefined}
      style={indent > 0 ? { marginLeft: `${indent * 4}px` } : undefined}
    >
      <div className="space-y-1 py-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="num text-secondary">{node.comment.authorHandle}</span>
        </div>
        <p className="whitespace-pre-line text-sm text-primary">
          {node.comment.body}
        </p>
        {onReply && (
          <button
            type="button"
            onClick={() => onReply(node.comment.id)}
            className="label text-muted hover:text-accent"
          >
            Reply
          </button>
        )}
      </div>
      {node.replies.length > 0 && (
        <ul className="space-y-1">
          {node.replies.map((child) => (
            <ThreadItem
              key={child.comment.id}
              node={child}
              depth={depth + 1}
              onReply={onReply}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function DiscussionThread({
  comments,
  onReply,
}: {
  comments: Comment[];
  onReply?: (parentId: string) => void;
}) {
  const roots = buildThread(comments);

  if (roots.length === 0) {
    return (
      <p className="label text-muted">
        No discussion yet — start the conversation.
      </p>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Discussion thread">
      {roots.map((node) => (
        <ThreadItem
          key={node.comment.id}
          node={node}
          depth={0}
          onReply={onReply}
        />
      ))}
    </ul>
  );
}
