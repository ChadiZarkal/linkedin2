// ============================================================
// GET/PUT/DELETE /api/posts - Manage posts
// Actions: publish, schedule, approve, reject
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPosts, getPost, savePost, deletePost } from '@/lib/github';
import { publishToLinkedIn } from '@/lib/linkedin';
import { requireAuth, sanitizeError, sanitizeId } from '@/lib/auth';
import type { Post, ApiResponse } from '@/lib/types';

export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<Post[]>>> {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const posts = await getPosts();
    return NextResponse.json({ success: true, data: posts });
  } catch (err) {
    console.error('Get posts error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<Post>>> {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const { id: rawId, action, content, scheduledAt } = await req.json();

    const id = sanitizeId(rawId);
    if (!id) {
      return NextResponse.json({ success: false, error: 'Invalid post id' }, { status: 400 });
    }

    const post = await getPost(id);
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    switch (action) {
      case 'publish': {
        const result = await publishToLinkedIn(post.content);
        post.status = 'published';
        post.publishedAt = new Date().toISOString();
        console.log(`Published to LinkedIn: ${result.id}`);
        break;
      }
      case 'schedule': {
        if (!scheduledAt || typeof scheduledAt !== 'string') {
          return NextResponse.json({ success: false, error: 'Missing scheduledAt' }, { status: 400 });
        }
        const schedDate = new Date(scheduledAt);
        if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
          return NextResponse.json({ success: false, error: 'scheduledAt doit être une date future valide' }, { status: 400 });
        }
        post.status = 'scheduled';
        post.scheduledAt = schedDate.toISOString();
        break;
      }
      case 'approve':
        post.status = 'pending';
        break;
      case 'reject':
        post.status = 'rejected';
        break;
      case 'edit':
        if (typeof content !== 'string' || content.length === 0) {
          return NextResponse.json({ success: false, error: 'Contenu requis' }, { status: 400 });
        }
        if (content.length > 10000) {
          return NextResponse.json({ success: false, error: 'Contenu trop long (max 10K)' }, { status: 400 });
        }
        post.content = content;
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    await savePost(post);
    return NextResponse.json({ success: true, data: post });
  } catch (err) {
    console.error('Update post error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const { id: rawId } = await req.json();
    const id = sanitizeId(rawId);
    if (!id) {
      return NextResponse.json({ success: false, error: 'Invalid post id' }, { status: 400 });
    }

    await deletePost(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
