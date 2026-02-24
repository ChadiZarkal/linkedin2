// src/lib/linkedin.ts
// LinkedIn API publishing utilities

export async function publishToLinkedIn(
  text: string,
  imageUrl?: string | null
): Promise<{ id: string; success: boolean; error?: string }> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const userUrn = process.env.LINKEDIN_USER_URN;

  if (!accessToken || !userUrn) {
    return { id: "", success: false, error: "Missing LinkedIn credentials" };
  }

  try {
    // If image provided, upload it first
    let imageAsset: string | null = null;
    if (imageUrl) {
      try {
        imageAsset = await uploadImageToLinkedIn(imageUrl, accessToken, userUrn);
      } catch (e) {
        console.error("Image upload failed, posting without image:", e);
      }
    }

    const specificContent = imageAsset
      ? {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "IMAGE",
            media: [
              {
                status: "READY",
                media: imageAsset,
              },
            ],
          },
        }
      : {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        };

    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        author: userUrn,
        lifecycleState: "PUBLISHED",
        specificContent,
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        id: "",
        success: false,
        error: `LinkedIn API error: ${error.message || JSON.stringify(error)}`,
      };
    }

    const data = await response.json();
    return { id: data.id, success: true };
  } catch (error) {
    return {
      id: "",
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function uploadImageToLinkedIn(
  imageUrl: string,
  accessToken: string,
  userUrn: string
): Promise<string> {
  // Step 1: Register upload
  const registerResponse = await fetch(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: userUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      }),
    }
  );

  if (!registerResponse.ok) {
    throw new Error(`Failed to register upload: ${registerResponse.status}`);
  }

  const registerData = await registerResponse.json();
  const uploadUrl =
    registerData.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl;
  const asset = registerData.value.asset;

  // Step 2: Download image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Failed to download image: ${imageResponse.status}`);
  const imageBuffer = await imageResponse.arrayBuffer();

  // Step 3: Upload to LinkedIn
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "image/jpeg",
    },
    body: imageBuffer,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload image: ${uploadResponse.status}`);
  }

  return asset;
}

export async function validateLinkedInToken(): Promise<boolean> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!accessToken) return false;

  try {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
