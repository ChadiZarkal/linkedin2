// ============================================================
// LinkedIn Publishing
// ============================================================

import { formatLinkedInText } from './unicode';

export async function publishToLinkedIn(content: string): Promise<{ id: string }> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const userUrn = process.env.LINKEDIN_USER_URN;

  if (!token || !userUrn) {
    throw new Error('LinkedIn credentials not configured (LINKEDIN_ACCESS_TOKEN, LINKEDIN_USER_URN)');
  }

  // Format text (bold/italic → Unicode)
  const formattedText = formatLinkedInText(content);

  const body = {
    author: userUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: formattedText },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn publish failed: ${res.status} - ${errText}`);
  }

  const postId = res.headers.get('x-restli-id') || 'unknown';
  return { id: postId };
}

export async function validateLinkedInToken(): Promise<boolean> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
