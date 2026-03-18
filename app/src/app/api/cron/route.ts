// ============================================================
// GET /api/cron - Cron job for auto-publishing & buffer
// Called by Vercel Cron (vercel.json)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPosts, savePost, getSchedule, getPrompts, generateId } from '@/lib/github';
import { publishToLinkedIn } from '@/lib/linkedin';
import { generateWithSearch, generateContent } from '@/lib/gemini';
import type { Post } from '@/lib/types';

export const maxDuration = 300;

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const log: string[] = [];
  const schedule = await getSchedule();

  if (!schedule.enabled) {
    return NextResponse.json({ message: 'Scheduling is disabled', log: ['Schedule disabled'] });
  }

  const now = new Date();
  const todayDay = now.getUTCDay();
  const currentHour = now.getUTCHours();
  const [scheduleHour] = schedule.time.split(':').map(Number);
  const posts = await getPosts();
  const nowUTCDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;

  // --- Step 1: Publish scheduled posts that are due (any hour) ---
  const scheduledDue = posts.filter(
    p => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt) <= now
  );
  
  for (const post of scheduledDue) {
    try {
      await publishToLinkedIn(post.content);
      post.status = 'published';
      post.publishedAt = new Date().toISOString();
      await savePost(post);
      log.push(`✅ Published scheduled post: ${post.topic}`);
    } catch (err) {
      log.push(`❌ Failed to publish ${post.topic}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // --- Step 2: Auto-publish if it's the right day AND hour ---
  if (schedule.days.includes(todayDay) && currentHour === scheduleHour) {
    const publishedToday = posts.some(
      p => p.status === 'published' && p.publishedAt &&
           p.publishedAt.substring(0, 10) === nowUTCDate
    );

    if (!publishedToday) {
      // Find oldest pending post
      const pending = posts
        .filter(p => p.status === 'pending')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (pending.length > 0) {
        const post = pending[0];
        try {
          await publishToLinkedIn(post.content);
          post.status = 'published';
          post.publishedAt = new Date().toISOString();
          await savePost(post);
          log.push(`✅ Auto-published: ${post.topic}`);
        } catch (err) {
          log.push(`❌ Auto-publish failed: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      } else {
        log.push('⚠️ No pending posts to auto-publish');
      }
    } else {
      log.push('ℹ️ Already published today');
    }
  } else {
    log.push(`ℹ️ Not publishing now (day: ${todayDay}/${schedule.days.join(',')}, hour: ${currentHour}/${scheduleHour})`);
  }

  // --- Step 3: Auto-generate buffer if needed ---
  if (schedule.autoGenerate) {
    const pendingCount = posts.filter(p => p.status === 'pending').length;
    const needed = schedule.minBuffer - pendingCount;

    if (needed > 0) {
      log.push(`📝 Generating ${needed} posts to fill buffer...`);
      const prompts = await getPrompts();

      for (let i = 0; i < needed; i++) {
        try {
          // Research
          const systemParts: string[] = [];
          if (prompts.globalPrompt?.trim()) systemParts.push(prompts.globalPrompt.trim());
          systemParts.push(prompts.research);
          const researchSystem = systemParts.join('\n\n---\n\n');
          
          const { text: research, sources } = await generateWithSearch(
            `Recherche les dernières actualités sur : "${schedule.defaultTopic}"`,
            researchSystem
          );

          // Write
          const writerParts: string[] = [];
          if (prompts.globalPrompt?.trim()) writerParts.push(prompts.globalPrompt.trim());
          writerParts.push(prompts.writer);
          const writerSystem = writerParts.join('\n\n---\n\n');

          const content = await generateContent(
            `Sujet : "${schedule.defaultTopic}"\n\nRecherche :\n${research}\n\nRédige un post LinkedIn.`,
            writerSystem
          );

          const post: Post = {
            id: generateId(),
            topic: schedule.defaultTopic,
            research,
            content,
            sources,
            status: 'pending',
            createdAt: new Date().toISOString(),
          };

          await savePost(post);
          log.push(`✅ Generated buffer post: ${post.id}`);
        } catch (err) {
          log.push(`❌ Buffer generation failed: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    } else {
      log.push(`ℹ️ Buffer OK (${pendingCount} pending, min: ${schedule.minBuffer})`);
    }
  }

  return NextResponse.json({ success: true, log });
}
