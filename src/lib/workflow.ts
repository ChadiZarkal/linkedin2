// src/lib/workflow.ts
// "Tech Wow" LinkedIn post generator
// Finds advanced AI techniques, vulgarizes them into short impressive posts
import { generateContent, generateWithSearch } from "./gemini";
import { publishToLinkedIn } from "./linkedin";
import {
  readCollectionAsync,
  writeCollectionAsync,
  addToCollectionAsync,
  updateInCollectionAsync,
} from "./db";
import { formatForLinkedIn } from "./unicode";
import type { Post, Settings, UsedTopic } from "./types";
import { seedDefaultsAsync } from "./seed";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function getSettings(): Promise<Settings> {
  await seedDefaultsAsync();
  const settings = await readCollectionAsync<Settings>("settings");
  return settings[0];
}

async function getUsedTopics(): Promise<UsedTopic[]> {
  return readCollectionAsync<UsedTopic>("topics");
}

// ─────────────────────────────────────────────
// STEP 1: Find cutting-edge AI techniques
// ─────────────────────────────────────────────
async function findTopics(
  usedTopics: UsedTopic[],
  model: string
): Promise<string[]> {
  const usedList =
    usedTopics.length > 0
      ? `\n\nSujets DÉJÀ TRAITÉS (NE PAS REPROPOSER, ni des sujets trop similaires) :\n${usedTopics.map((t) => `- ${t.title}`).join("\n")}`
      : "";

  const prompt = `Tu es un expert en intelligence artificielle générative et en recherche de pointe.

Ton rôle : trouver 6 techniques/concepts ULTRA AVANCÉS et SPÉCIFIQUES dans le domaine de l'IA générative.

Critères STRICTS :
- Des techniques PRÉCISES et POINTUES (pas "le machine learning" ou "les LLM" qui sont trop généraux)
- Des choses comme : une méthode d'embedding spécifique, un mécanisme d'attention particulier, une technique d'entraînement novatrice, une approche de fine-tuning, un concept d'architecture neuronale, une méthode d'optimisation d'inférence, etc.
- Pas forcément récent : ça peut être une technique existante mais fascinante et peu connue du grand public
- Le sujet doit pouvoir être expliqué de manière impressionnante à quelqu'un qui n'est PAS développeur
- Éviter les sujets qui nécessitent de comprendre trop de prérequis techniques
- Privilégier les sujets qui créent un effet "WOW, je savais pas qu'on pouvait faire ça"
${usedList}

Réponds UNIQUEMENT avec un JSON array de 6 strings, chaque string étant le nom/titre précis de la technique :
["technique 1", "technique 2", ...]`;

  const result = await generateWithSearch(prompt, model);

  try {
    const cleaned = result.text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract from text
    const lines = result.text
      .split("\n")
      .filter((l) => l.trim().length > 5)
      .slice(0, 6);
    return lines.map((l) => l.replace(/^[-*\d.)\s]+/, "").trim());
  }
}

// ─────────────────────────────────────────────
// STEP 2: Pick the most "wow-able" topic
// ─────────────────────────────────────────────
async function selectBestTopic(
  topics: string[],
  model: string
): Promise<{ topic: string; reason: string }> {
  const prompt = `Tu es un expert en vulgarisation scientifique et en contenu LinkedIn viral.

Voici 6 techniques/concepts avancés d'IA générative :
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Choisis LE MEILLEUR sujet selon ces critères (dans l'ordre d'importance) :
1. Effet "WOW" maximal : le lecteur doit se dire "wow, c'est dingue que ça existe"
2. Facilement compréhensible : explicable sans prérequis technique, un non-développeur DOIT comprendre
3. Vendable : on peut en parler de manière captivante en quelques phrases
4. Pas besoin de comprendre des sous-concepts complexes pour saisir l'idée

La cible : des non-développeurs curieux de l'IA + quelques devs qui veulent découvrir une technique qu'ils ne connaissent peut-être pas.

Réponds UNIQUEMENT en JSON :
{
  "topic": "Le titre exact du sujet choisi (tel quel dans la liste)",
  "reason": "Pourquoi ce sujet a été choisi (1-2 phrases)"
}`;

  const result = await generateContent(prompt, model);

  try {
    const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { topic: topics[0], reason: "Premier sujet par défaut" };
  }
}

// ─────────────────────────────────────────────
// STEP 3: Write the post
// ─────────────────────────────────────────────
async function writePost(
  topic: string,
  model: string
): Promise<string> {
  const researchPrompt = `Recherche des informations détaillées et précises sur cette technique/concept d'IA : "${topic}"

Je veux comprendre :
- Qu'est-ce que c'est exactement ?
- Comment ça fonctionne (en termes simples) ?
- Qu'est-ce que ça permet de faire concrètement ?
- Pourquoi c'est impressionnant ?
- Un exemple concret d'application si possible

Sois factuel et précis.`;

  const research = await generateWithSearch(researchPrompt, model);

  const writePrompt = `Tu es un rédacteur LinkedIn expert en vulgarisation de concepts IA avancés.

SUJET : ${topic}

RECHERCHES :
${research.text}

RÈGLES ABSOLUES :
1. Maximum 600 mots. Pas un de plus.
2. ZÉRO bullshit. Pas de phrases creuses, pas de "dans un monde en constante évolution", pas de clichés LinkedIn.
3. Va DROIT AU BUT. Commence par ce que c'est et pourquoi c'est fou.
4. Le lecteur doit comprendre SANS être développeur.
5. Crée l'effet "wow" : le lecteur doit se dire "putain c'est dingue".
6. Structure : Accroche percutante → La technique en 2-3 phrases simples → Ce que ça implique/permet → Pourquoi c'est fascinant
7. Pour les devs : ils doivent se dire "ah intéressant, je connaissais pas cette approche, je comprends l'intérêt"
8. Ton : direct, intelligent, impressionnant mais accessible. Comme si tu expliquais un truc de fou à un ami intelligent qui n'est pas dev.
9. PAS de hashtags. PAS de "Et vous qu'en pensez-vous ?". PAS de call to action bullshit.
10. PAS d'emojis excessifs. 1-2 max si vraiment pertinent.
11. Utilise **gras** pour les mots clés importants (sera converti en Unicode bold pour LinkedIn).

Fournis UNIQUEMENT le texte du post, prêt à publier. Rien d'autre.`;

  return generateContent(writePrompt, model);
}

// ─────────────────────────────────────────────
// MAIN: Generate a single "Tech Wow" post
// ─────────────────────────────────────────────
export async function generateTechWowPost(): Promise<Post> {
  const settings = await getSettings();
  const model = settings.globalModel || "gemini-2.0-flash";
  const usedTopics = await getUsedTopics();

  // Step 1: Find topics
  const topics = await findTopics(usedTopics, model);

  // Step 2: Pick the best one
  const selected = await selectBestTopic(topics, model);

  // Step 3: Write the post
  const content = await writePost(selected.topic, model);

  // Track the used topic for deduplication
  const usedTopic: UsedTopic = {
    id: generateId(),
    title: selected.topic,
    usedAt: new Date().toISOString(),
  };
  await addToCollectionAsync("topics", usedTopic);

  // Save the post
  const post: Post = {
    id: generateId(),
    topic: selected.topic,
    content,
    status: settings.autoPublish ? "approved" : "pending",
    linkedinPostId: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
  };
  await addToCollectionAsync("posts", post);

  return post;
}

// ─────────────────────────────────────────────
// PUBLISH: Publish a specific post to LinkedIn
// ─────────────────────────────────────────────
export async function publishPost(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const posts = await readCollectionAsync<Post>("posts");
  const post = posts.find((p) => p.id === postId);
  if (!post) return { success: false, error: "Post non trouvé" };

  const formattedContent = formatForLinkedIn(post.content);
  const result = await publishToLinkedIn(formattedContent);

  if (result.success) {
    await updateInCollectionAsync<Post>("posts", postId, {
      status: "published",
      linkedinPostId: result.id,
      publishedAt: new Date().toISOString(),
    } as Partial<Post>);
    return { success: true };
  }

  return { success: false, error: result.error };
}

// ─────────────────────────────────────────────
// CRON: Daily routine
// Called every day by Vercel Cron
// ─────────────────────────────────────────────
export async function dailyCron(): Promise<{
  generated: number;
  published: number;
  errors: string[];
}> {
  const settings = await getSettings();
  const posts = await readCollectionAsync<Post>("posts");
  const errors: string[] = [];
  let generated = 0;
  let published = 0;

  // Count pending posts (not yet published or rejected)
  const pendingPosts = posts.filter(
    (p) => p.status === "pending" || p.status === "approved"
  );

  // Step 1: Fill the buffer — generate posts until we have enough pending
  const needed = Math.max(0, settings.pendingBuffer - pendingPosts.length);

  for (let i = 0; i < needed; i++) {
    try {
      await generateTechWowPost();
      generated++;
    } catch (e) {
      errors.push(
        `Generation error: ${e instanceof Error ? e.message : String(e)}`
      );
      break; // Stop generating if there's an error
    }
  }

  // Step 2: If autoPublish, publish 1 post per day
  if (settings.autoPublish) {
    // Check if we already published today
    const today = new Date().toISOString().split("T")[0];
    const publishedToday = posts.some(
      (p) =>
        p.status === "published" &&
        p.publishedAt &&
        p.publishedAt.startsWith(today)
    );

    if (!publishedToday) {
      // Re-read posts (might have new ones from generation above)
      const allPosts = await readCollectionAsync<Post>("posts");
      // Find the oldest pending/approved post
      const toPublish = allPosts
        .filter((p) => p.status === "pending" || p.status === "approved")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0];

      if (toPublish) {
        const result = await publishPost(toPublish.id);
        if (result.success) {
          published++;
        } else {
          errors.push(`Publish error: ${result.error}`);
        }
      }
    }
  }

  return { generated, published, errors };
}
