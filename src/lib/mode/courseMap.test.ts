import { describe, expect, it } from "vitest";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { skillKeySet } from "@/lib/roadmap/skillGraph";
import {
  COURSES,
  courseForTopic,
  courseIds,
  courseTopicKeySet,
  getCourse,
  isCourseTopic,
  topicsInCourse,
} from "./courseMap";

const P = (s: string) => topicKeyOf("probability", s);

describe("Case A course → topic mapping", () => {
  it("has two courses surfaced by their UI labels (no M362 codes)", () => {
    expect(courseIds()).toEqual(["m362k", "m362m"]);
    expect(getCourse("m362k")?.label).toBe("Intro to Probability");
    expect(getCourse("m362m")?.label).toBe("Intro to Stochastic Processes");
  });

  it("maps every course topicKey to a REAL skill-graph node (no phantom topics)", () => {
    const keys = skillKeySet();
    for (const c of COURSES) {
      for (const k of [...c.topicKeys, ...c.sharedTopicKeys]) {
        expect(keys.has(k), `${k} should be a real skill-graph node`).toBe(true);
      }
    }
  });

  it("places the seven ex-ERK topics as first-class course topics", () => {
    expect(getCourse("m362k")!.topicKeys).toEqual(
      expect.arrayContaining([
        P("Moment Generating Functions"),
        P("Gamma Distribution"),
        P("Joint Distributions"),
        P("Limit Theorems"),
      ]),
    );
    expect(getCourse("m362m")!.topicKeys).toEqual(
      expect.arrayContaining([
        P("Branching Processes"),
        P("Continuous-Time Markov Chains"),
        P("Markov Chain Structure"),
      ]),
    );
  });

  it("displays 21 ordered topics across the two tracks (13 + 6 primary + 2 shared)", () => {
    expect(topicsInCourse("m362k")).toHaveLength(13);
    expect(topicsInCourse("m362m")).toHaveLength(8); // 6 primary + 2 shared
    const total =
      topicsInCourse("m362k").length + topicsInCourse("m362m").length;
    expect(total).toBe(21);
  });

  it("shows Conditional Probability & Poisson as shared/upstream in Stochastic Processes", () => {
    const m = topicsInCourse("m362m");
    expect(m).toContain(P("Conditional Probability"));
    expect(m).toContain(P("Poisson Distribution & Process"));
  });

  it("courseForTopic resolves shared topics to their PRIMARY owner (m362k)", () => {
    expect(courseForTopic(P("Conditional Probability"))).toBe("m362k");
    expect(courseForTopic(P("Poisson Distribution & Process"))).toBe("m362k");
    expect(courseForTopic(P("Markov Chains"))).toBe("m362m");
    expect(courseForTopic(P("Brownian Motion"))).toBe("m362m");
  });

  it("courseForTopic is undefined for beyond-the-course / foundation topics", () => {
    expect(courseForTopic(P("Betting & Sizing"))).toBeUndefined();
    expect(courseForTopic(P("Game Theory & Puzzles"))).toBeUndefined();
    expect(courseForTopic(topicKeyOf("mental-math"))).toBeUndefined();
    expect(courseForTopic(topicKeyOf("interview-games"))).toBeUndefined();
  });

  it("isCourseTopic / courseTopicKeySet agree with the mapping", () => {
    expect(isCourseTopic(P("Expected Value"))).toBe(true);
    expect(isCourseTopic(P("Betting & Sizing"))).toBe(false);
    expect(courseTopicKeySet().size).toBe(19); // 13 + 6 primary owners
  });
});
