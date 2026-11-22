import { z } from 'zod';
import type { CareerProfile } from '../../shared/preparation';

const draftSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  fullName: z.string(),
  headline: z.string(),
  github: z.string(),
  linkedin: z.string(),
  leetcode: z.string(),
  gfg: z.string(),
  experience: z.enum(['student', 'junior', 'experienced']),
  background: z.string(),
  codingContext: z.string(),
  resume: z.string(),
  targetRole: z.string(),
  jobDescription: z.string(),
  days: z.number(),
  hoursPerDay: z.number(),
  repositories: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      description: z.string(),
      language: z.string(),
      signals: z.array(z.object({ skillId: z.string(), finding: z.string(), url: z.string() })),
      warnings: z.array(z.string()),
    }),
  ),
});

const key = (userId: string) => 'jobfit-profile-draft:' + userId;

/** Browser storage can be corrupt, full, or disabled; it must never block account data. */
export function readProfileDraft(userId: string): CareerProfile | null {
  try {
    const parsed = draftSchema.safeParse(JSON.parse(sessionStorage.getItem(key(userId)) || 'null'));
    if (!parsed.success || (parsed.data.ownerId && parsed.data.ownerId !== userId)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeProfileDraft(userId: string, profile: CareerProfile): void {
  try {
    sessionStorage.setItem(key(userId), JSON.stringify(profile));
  } catch {
    // Keep the live form when browser storage is unavailable.
  }
}

export function clearProfileDraft(userId: string): void {
  try {
    sessionStorage.removeItem(key(userId));
  } catch {
    // A successful API save remains successful even when browser cleanup fails.
  }
}
