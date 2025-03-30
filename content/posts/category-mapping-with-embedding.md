---
title: "Category Mapping with Embedding"
description: "A deep dive into how I used embeddings and LLMs to automate a complex product categorization migration."
date: "2023-07-01"
draft: false
---

Recently, I faced a daunting task: migrating all of our existing product deals to a brand new, more comprehensive, and standardized set of canonical product categories. This was critical for improving product discoverability, ensuring consistent marketing, and enabling better reporting. Think of it as moving from a somewhat disorganized, ad-hoc filing system to a meticulously organized, hierarchical library catalog.

The problem? Our system had *tens of thousands* of deals, each with existing category assignments that were often inconsistent, incomplete, or simply didn't map cleanly to the new structure. Manually re-categorizing everything was out of the question. It would have taken an absurd amount of time and been incredibly prone to errors. I needed an automated solution, but a simple keyword-based approach wouldn't work. The nuances of product descriptions and the potential mismatches between the old and new categories demanded something far more intelligent.

## The Challenge: Bridging the Old and New

The core challenge was bridging the semantic gap between the *existing* (often messy) category assignments and the *new* canonical categories. Here are a few examples to illustrate the problem:

*   **Old:** "mens-clothing.shirts-t-shirts" **New:** "Apparel.Men's.Tops.T-Shirts"
*   **Old:** "health-beauty.fragrance-cologne" **New:** "Beauty & Personal Care.Fragrances.Men's Fragrances"
*   **Old:** "home-decor" **New:** "Home & Garden.Home Decor.Candles & Home Fragrances" (for a scented candle deal)

The old categories could be incomplete, use different wording, or have a different level of granularity. I couldn't just create a simple lookup table. I needed a system that could:

1.  **Understand the *meaning*** of the product description, going beyond simple keyword matching.
2.  **Leverage the *existing* category information**, even if imperfect, as a valuable hint.
3.  **Intelligently select the best match** within the *new* canonical category hierarchy.

## My AI-Powered Solution: A Two-Stage Migration

I developed a two-stage AI-powered system that combines the strengths of embedding-based similarity matching and the contextual reasoning of large language models (LLMs).

### Stage 1: Embedding-Based Similarity – Finding the Right Neighborhood

The first stage leverages pre-computed embeddings of the *new* canonical categories. Embeddings are numerical representations that capture the semantic meaning of text. Similar concepts have similar embeddings. I calculated the embedding of each product deal's description (including the title and any existing category information, after some complex preprocessing). Then, I compared this "deal embedding" to the embeddings of all the *top-level* categories in the new taxonomy.

```typescript
// (Simplified representation)
import { calculateCosineSimilarity } from './similarity';
import canonicalCategoryData from './canonical_categories.json'; // My NEW category embeddings
import { getAIClient } from './ai_client'; // Interface to AI models

async function migrateCategory(dealDetails) {
  const { title, description, existingCategories } = dealDetails;
  const { createTextEmbedding } = getAIClient();

  // 1. Create an embedding for the deal, including (preprocessed) existing categories.
  const dealEmbedding = await createTextEmbedding(
    `${title} ${description} ${existingCategories ? prepareCategories(existingCategories) : ''}`
  );

    // 2. Compare against top-level canonical category embeddings.
  const topLevelCategories = Object.entries(canonicalCategoryData)
      .map(([key, data]) => [key, data.embedding]);

  let bestMatch = null;
  let highestScore = -Infinity;

  for (const [categoryName, categoryEmbedding] of topLevelCategories) {
    const similarity = calculateCosineSimilarity(dealEmbedding, categoryEmbedding);
    if (similarity > highestScore) {
      highestScore = similarity;
      bestMatch = categoryName;
    }
  }
    // ... (continued below)
}
```

I used cosine similarity to measure how "close" the embeddings are. A score of 1 is a perfect match; -1 is completely opposite. This quickly and efficiently identifies the *general area* within the new category structure where the deal likely belongs. If the similarity score exceeds a threshold (I used 0.8), I'm confident enough to assign the deal to that top-level category.  Then, I repeat the process with the *sub-categories* of that top-level to get a more precise placement (e.g., "Apparel" -> "Men's" -> "Tops" -> "T-Shirts").

### Stage 2: LLM Reasoning – Refining the Choice

What if the embedding similarity is *below* my threshold? This is where the LLM comes in, handling cases where:

*   The deal description is brief or uses unusual language.
*   The existing categories are particularly unhelpful or misleading.
*   The best fit in the new taxonomy isn't immediately obvious.

I construct a prompt for the LLM that includes:

*   The deal's title and description.
*   The (potentially cleaned-up) *existing* categories.
*   A list of the *new* canonical categories to choose from.

```typescript
// (Continuing from the previous code snippet)

const SIMILARITY_THRESHOLD = 0.8;

async function migrateCategory(dealDetails) {
  // ... (previous code)

  // If similarity is high enough, we're done!
    if (highestScore >= SIMILARITY_THRESHOLD) {
        const subCategories = canonicalCategoryData[bestMatch].children; // Get sub-categories
        const subCategoryMatch = await findBestSubCategory(dealEmbedding, subCategories); // Find the best sub-category
        return [bestMatch, subCategoryMatch].filter(Boolean).join('.'); // Return "TopLevel.SubLevel"
    }

  // If similarity is low, bring in the LLM.
  const availableCategories = topLevelCategories.map(([categoryName]) => categoryName);
  const suggestedCategory = await getCategorySuggestion(dealDetails, availableCategories);

  return suggestedCategory;
}
```

The `getCategorySuggestion` function (shown later) interacts with the LLM, providing the prompt and receiving the suggested category. The LLM acts like a "smart categorizer," using its contextual understanding to make the best decision.

## The Key: Cleaning Up the Existing Categories

The most crucial and, I think, trickiest part of my solution is how I handle the *existing* category information. I can't just ignore it; it often contains valuable clues.  But I can't trust it blindly, either. The `refineExistingCategories` function is the key to this delicate balance.

```typescript
export function refineExistingCategories(categories: string, similarityScores: number[]): string {
  const keywords = categories
    .split(',')
    .map((cat) => cat.split('.').map((subCat) => subCat.split('-')))

  let i = 0;
  function filterKeywords(arr: any[]): any[] {
    return arr
      .map((item) => {
        if (Array.isArray(item)) {
          return filterKeywords(item)
        }
        // THIS IS THE CORE LOGIC: Remove keywords with low similarity.
        return similarityScores[i++] > KEYWORD_SIMILARITY_THRESHOLD ? item : null
      })
      .filter((item) => item !== null)
  }

  return (filterKeywords(keywords) as string[][][])
    .map((category) =>
      category
        .map((subCategory) => {
          return subCategory.join('-')
        })
        .join('.')
    )
    .join(',')
}
```

Here's a breakdown:

1.  **Deconstruct:** I break down the existing categories into a hierarchical structure of individual keywords.  For example, "health-beauty.fragrance-cologne,mens-clothing" becomes `[[["health", "beauty"], ["fragrance", "cologne"]], [["mens", "clothing"]]]`.

2.  **Individual Keyword Embeddings:** I create an embedding for *each individual keyword* from the old categories.

3.  **Similarity Check:** I compare *each keyword embedding* to the embedding of the deal description ( *without* the old categories). This measures how relevant each *individual keyword* is to the *core* product information.

4.  **Strategic Removal:** If a keyword's similarity is *below* a threshold (`KEYWORD_SIMILARITY_THRESHOLD`, which I set to 0.75), I *remove* it. This eliminates noise and prevents misleading information from influencing the LLM.

5.  **Reconstruct:** I rebuild the "cleaned" existing categories string using only the remaining keywords.

**Example:**

Let's say a deal for a men's cologne has the old category "health-beauty.fragrance-cologne".

1.  **Keywords:** `[[["health", "beauty"], ["fragrance", "cologne"]]]`
2.  **Embeddings:** I create embeddings for "health", "beauty", "fragrance", and "cologne".
3.  **Similarity:** I compare each to the deal description embedding. "health" and "beauty" likely have *low* similarity; "fragrance" and "cologne" have *high* similarity.
4.  **Removal:** "health" and "beauty" are removed.
5.  **Result:** The cleaned category becomes "fragrance-cologne".

This "cleaned" category is then used in the LLM prompt, providing a much more focused and relevant hint. This significantly boosts the accuracy of the LLM's suggestions.

## The Full Code

Here's a more complete view of the code, including helper functions and the LLM interaction:

```typescript
import { calculateCosineSimilarity } from './similarity';
import canonicalCategoryData from './canonical_categories.json';
import { getAIClient } from './ai_client';
import { AppLogger } from './logger';

type CategoryData = typeof canonicalCategoryData;

const SIMILARITY_THRESHOLD = 0.8;
const KEYWORD_SIMILARITY_THRESHOLD = 0.75;

async function findBestMatch<T extends string>(
  { title, description, existingCategories, sourceEmbedding, comparisonEmbeddings }:
    {
      title: string;
      description: string;
      existingCategories?: string | null;
      sourceEmbedding: Array<number> | null;
      comparisonEmbeddings: Array<[T, Array<number>]>
    },
  logger: AppLogger
): Promise<T | undefined> {

  let bestMatch: string | null = null;
  let highestScore = -Infinity;
  const { createTextEmbedding } = getAIClient(logger);

  if (sourceEmbedding !== null) {
    // Calculate cosine similarities and find the best match (embedding stage).
    comparisonEmbeddings.forEach(([targetCategory, targetEmbedding]) => {
      const similarity = calculateCosineSimilarity(sourceEmbedding, targetEmbedding);
      if (similarity > highestScore) {
        highestScore = similarity;
        bestMatch = targetCategory;
      }
    });
  }

  if (highestScore >= SIMILARITY_THRESHOLD) return bestMatch as T;

  // --- LLM Fallback (if embedding similarity is low) ---
  const targetCategoryNames = comparisonEmbeddings.map(([category]) => category);

  // No existing categories? Simple LLM prompt.
  if (!existingCategories) {
    return await getCategorySuggestion<T>(
      `Product title: ${title}\nProduct description: ${description}\nAvailable categories:\n`,
      targetCategoryNames,
      logger
    );
  }

  // Existing categories?  Refine them *first*!
  const categoryKeywords = existingCategories.split(/[^a-zA-Z0-9]/g);
  const keywordEmbeddings = await Promise.all(categoryKeywords.map((keyword) => createTextEmbedding(keyword)));
  const productEmbeddingWithoutCategories = await createTextEmbedding(`${title} ${description}`);

  if (keywordEmbeddings.every((e) => e !== null) && productEmbeddingWithoutCategories) {
    const similarities = (keywordEmbeddings as unknown as number[][]).map((embedding) =>
      calculateCosineSimilarity(embedding, productEmbeddingWithoutCategories)
    );

    const refinedCategories = refineExistingCategories(existingCategories, similarities);

    const prompt = `Product title: ${title}\nProduct description: ${description}\nPrevious categories: ${refinedCategories}\nAvailable categories:\n`;
    return await getCategorySuggestion<T>(prompt, targetCategoryNames, logger);
  }
}
async function getCategorySuggestion<T extends string>(
    partialPrompt: string,
    availableCategories: T[],
    logger: AppLogger
): Promise<T | undefined> {
    const { createChatCompletion } = getAIClient(logger);

    const suggestion = await createChatCompletion({
        systemMessage:
            'You are a categorization assistant that helps choose new product categories during a taxonomy migration.',
        userMessage: `${partialPrompt}${availableCategories.join(', ')}\nNew category:`,
    });
    if (!suggestion) {
        return undefined;
    }
    // Ensure the suggestion is one of the available categories (case-insensitive).
    return availableCategories.find((c) => c.toLowerCase() === suggestion.trim().toLowerCase());
}
export function prepareCategories(categories: string) {
    return [...new Set(categories.split(/[^a-zA-Z0-9]/g))].join(' ')
}

export async function migrateCategory(
    dealDetails: {
        title: string;
        description: string;
        existingCategories?: string | null;
    },
    logger: AppLogger
) {
    const { createTextEmbedding } = getAIClient(logger);

    const { title, description, existingCategories } = dealDetails;

    const dealEmbedding = await createTextEmbedding(
        `${title} ${description}${existingCategories ? ` ${prepareCategories(existingCategories)}` : ''}`
    );

    const topLevelCategories = Object.entries(canonicalCategoryData).map<
        [keyof CategoryData, number[]]
    >(([key, data]) => [key, data.embedding]);

    const topLevelMatch = await findBestMatch<keyof CategoryData>(
        {
            sourceEmbedding: dealEmbedding,
            comparisonEmbeddings: topLevelCategories,
            title,
            description,
            existingCategories,
        },
        logger
    );
    if (!topLevelMatch) {
        return null;
    }

    const subLevelMatch = await findBestMatch<string>(
        {
            title,
            description,
            existingCategories,
            sourceEmbedding: dealEmbedding,
            comparisonEmbeddings: canonicalCategoryData[topLevelMatch].children as [string, number[]][],
        },
        logger
    );

    return [topLevelMatch, subLevelMatch].filter(Boolean).join('.');
}

```

## Key Results and Benefits

This AI-powered migration system was a huge success. It allowed me to:

*   **Dramatically improve accuracy:** The combination of embeddings and LLMs significantly outperformed any manual or rule-based approach I could have devised.
*   **Save enormous amounts of time:** What would have taken weeks or months of manual effort was completed in a fraction of the time.
*   **Ensure consistency:** The automated system applied the new taxonomy consistently across all deals.
*   **Handle complexity:** The system gracefully handled variations in product descriptions and ambiguities in the existing categories.
*   **Be adaptable:** I can easily fine-tune the system (e.g., adjust the similarity thresholds) or update it as the canonical category structure evolves.

This task is an example of how AI can be used to tackle complex, real-world data challenges. By combining different AI techniques and focusing on the nuances of the problem, I was able to build a solution that was both powerful and practical. The key was understanding the strengths of each approach – embeddings for efficient similarity matching, LLMs for contextual understanding, and careful preprocessing to clean up noisy data – and combining them in a resilient way.
