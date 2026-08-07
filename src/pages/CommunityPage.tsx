import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ExperienceReportList,
  ReputationBadge,
  SocialProofCounts,
} from "@/components/community";
import {
  buildAuthorIndex,
  computeReputation,
  deriveReputationEvents,
  isCleanHandle,
} from "@/lib/community/aggregate";
import { moderateContent } from "@/lib/community/moderation";
import { communityStore } from "@/lib/community/createCommunityStore";
import type {
  ExperienceReport,
  ItemAggregate,
  Vote,
} from "@/lib/community/types";

/**
 * `/community` — the Community & social-proof layer (TASK T13).
 *
 * REAL user content only: reports, votes, and social-proof counts are read from
 * (and written to) the `CommunityStore` — local-first `InMemoryCommunityStore`
 * offline, or the AWS-backed store when configured (`createCommunityStore`).
 * There is NO seeded/sample data: an empty board renders honest empty states.
 * Every user submission passes through the deterministic moderation filter
 * (`moderateContent`) before it is stored, and each post can be reported/flagged
 * via the store's `flagContent` hook for later human review.
 */

/** A single shared, general-purpose community board for this route. */
const ITEM_ID = "community-board";

type Notice = { kind: "error" | "info" | "success"; text: string };

export function CommunityPage() {
  const [handle, setHandle] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [reports, setReports] = useState<ExperienceReport[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [aggregate, setAggregate] = useState<ItemAggregate | null>(null);
  const [karmaByHandle, setKarmaByHandle] = useState<Record<string, number>>({});

  const [myVotes, setMyVotes] = useState<Record<string, -1 | 0 | 1>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Reload everything from the store (offline-graceful). */
  const refresh = useCallback(async () => {
    try {
      const [nextReports, nextVotes, nextAgg] = await Promise.all([
        communityStore.listReports(ITEM_ID),
        communityStore.listVotes(),
        communityStore.getItemAggregate(ITEM_ID),
      ]);
      setReports(nextReports);
      setVotes(nextVotes);
      setAggregate(nextAgg);

      // Reputation is DERIVED from real votes (never a fabricated counter).
      const idx = buildAuthorIndex(nextReports, [], []);
      const events = deriveReputationEvents(nextVotes, [], idx);
      setKarmaByHandle(computeReputation(events));
    } catch {
      // Offline / no session: leave collections empty; the UI shows empty states.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requireHandle = (action: string): string | null => {
    const h = handle.trim();
    if (!isCleanHandle(h)) {
      setNotice({
        kind: "error",
        text: `Enter a public handle (3–20 letters, digits, space, _ or -) to ${action}.`,
      });
      return null;
    }
    return h;
  };

  const submitReport = async (e: FormEvent) => {
    e.preventDefault();
    const h = requireHandle("post");
    if (!h) return;
    if (!title.trim() || !body.trim()) {
      setNotice({ kind: "error", text: "Add a title and a write-up first." });
      return;
    }

    // Moderate BEFORE anything is stored/displayed.
    const modTitle = moderateContent(title);
    const modBody = moderateContent(body);
    if (modTitle.verdict === "block" || modBody.verdict === "block") {
      const reasons = [...new Set([...modTitle.reasons, ...modBody.reasons])];
      setNotice({
        kind: "error",
        text: `Your post was blocked by the content filter (${reasons.join(
          ", ",
        )}). Please revise and try again.`,
      });
      return;
    }
    const masked = modTitle.verdict === "mask" || modBody.verdict === "mask";

    setSubmitting(true);
    try {
      await communityStore.createReport({
        itemId: ITEM_ID,
        authorHandle: h,
        title: modTitle.text,
        body: modBody.text,
        tags: [],
      });
      setTitle("");
      setBody("");
      setNotice(
        masked
          ? {
              kind: "info",
              text: "Posted: some language was masked to meet the content policy.",
            }
          : { kind: "success", text: "Posted. Thanks for contributing!" },
      );
      await refresh();
    } catch {
      setNotice({
        kind: "error",
        text: "Could not save your post. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onVote = async (reportId: string, value: -1 | 0 | 1) => {
    const h = requireHandle("vote");
    if (!h) return;
    setMyVotes((prev) => ({ ...prev, [reportId]: value }));
    try {
      await communityStore.castVote({
        targetKind: "report",
        targetId: reportId,
        voterHandle: h,
        dimension: "quality",
        value,
      });
      await refresh();
    } catch {
      setNotice({ kind: "error", text: "Could not record your vote." });
    }
  };

  const onFlag = async (reportId: string) => {
    const h = requireHandle("report content");
    if (!h) return;
    try {
      await communityStore.flagContent({
        targetKind: "report",
        targetId: reportId,
        reporterHandle: h,
        reason: "other",
      });
      setFlaggedIds((prev) => new Set(prev).add(reportId));
      setNotice({
        kind: "info",
        text: "Thanks. This post was reported and will be reviewed.",
      });
    } catch {
      setNotice({ kind: "error", text: "Could not submit your report." });
    }
  };

  const noticeCls =
    notice?.kind === "error"
      ? "border-bear text-bear"
      : notice?.kind === "success"
        ? "border-bull text-bull"
        : "border-accent text-accent";

  const contributors = Object.entries(karmaByHandle).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-8">
      <header className="panel p-6">
        <span className="label text-accent">Community · Social proof</span>
        <h1 className="mt-1 font-display text-3xl font-black text-primary sm:text-4xl">
          Interview Experiences
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
          Crowd-sourced, PII-free write-ups of real superdays and screens, ranked
          by community quality votes. Reputation is a durable, reconstructable
          karma ledger, not mutable counters. All content here comes from real
          contributors.
        </p>
        <p className="mt-3 max-w-2xl rounded border border-subtle px-3 py-2 text-xs leading-relaxed text-muted">
          Be respectful and keep it PII-free (public handles only, no names,
          emails, or contact info). User content is moderated; profanity is masked
          and violations may be removed. Report anything that breaks the rules.
        </p>
      </header>

      <section className="panel-ruled space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-primary">
            Community board
          </h2>
          {aggregate && <SocialProofCounts agg={aggregate} />}
        </div>
        {contributors.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="label text-muted">Top contributors</span>
            {contributors.map(([h, karma]) => (
              <ReputationBadge key={h} handle={h} karma={karma} showHandle />
            ))}
          </div>
        )}
      </section>

      <section className="panel space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold text-primary">
          Share your interview experience
        </h2>
        {notice && (
          <p
            className={`chip ${noticeCls}`}
            role="status"
            aria-live="polite"
          >
            {notice.text}
          </p>
        )}
        <form className="space-y-3" onSubmit={submitReport}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr]">
            <label className="space-y-1">
              <span className="label text-muted">Public handle</span>
              <input
                className="input w-full"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="e.g. quant_trader-7"
                maxLength={20}
              />
            </label>
            <label className="space-y-1">
              <span className="label text-muted">Title</span>
              <input
                className="input w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Optiver onsite, market-making round"
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label text-muted">Your write-up</span>
            <textarea
              className="input min-h-[6rem] w-full"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What was the format? What mattered? Keep it PII-free."
            />
          </label>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Posting…" : "Post experience"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-primary">
          Experience reports
        </h2>
        <ExperienceReportList
          reports={reports}
          votes={votes}
          karmaByHandle={karmaByHandle}
          myVotes={myVotes}
          onVote={onVote}
          onFlag={onFlag}
          flaggedIds={flaggedIds}
        />
      </section>
    </div>
  );
}
