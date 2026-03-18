// ============================================================
// LinkedIn Publishing — REST Posts API (v2 UGC is deprecated)
// ============================================================

import { formatLinkedInText } from './unicode';

export async function publishToLinkedIn(content: string): Promise<{ id: string }> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const userUrn = process.env.LINKEDIN_USER_URN;

  if (!token || !userUrn) {
    throw new Error('LinkedIn credentials not configured (LINKEDIN_ACCESS_TOKEN, LINKEDIN_USER_URN)');
  }

  // Validate token before publishing
  const tokenOk = await validateLinkedInToken();
  if (!tokenOk) {
    throw new Error('LinkedIn access token is expired or invalid. Please refresh it.');
  }

  // Format text (bold/italic → Unicode)
  const formattedText = formatLinkedInText(content);

  const body = {
    author: userUrn,
    commentary: formattedText,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
  };

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn publish failed: ${res.status} - ${errText}`);
  }

  const postId = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || 'unknown';
  return { id: postId };
}

let _tokenValid: boolean | null = null;
let _tokenCheckedAt = 0;
const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000; // Cache for 5 min

export async function validateLinkedInToken(): Promise<boolean> {
  // Cache the validation result for 5 minutes
  if (_tokenValid !== null && Date.now() - _tokenCheckedAt < TOKEN_CHECK_INTERVAL) {
    return _tokenValid;
  }

  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    _tokenValid = false;
    _tokenCheckedAt = Date.now();
    return false;
  }

  try {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    _tokenValid = res.ok;
    _tokenCheckedAt = Date.now();
    return _tokenValid;
  } catch {
    _tokenValid = false;
    _tokenCheckedAt = Date.now();
    return false;
  }
}
