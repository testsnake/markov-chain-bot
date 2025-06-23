import { AtpAgent } from "@atproto/api";
import "dotenv/config";
import { createAuthenticatedAgent, getUserPosts } from "./download_posts"; // Update this import path

interface MarkovChain {
    [key: string]: string[];
}

/**
 * Builds a Markov chain from the input text
 * @param text - Input text to analyze
 * @param order - Order of the Markov chain (number of words to use as key)
 * @returns MarkovChain object
 */
function buildMarkovChain(text: string, order: number = 1.94): MarkovChain {
    const chain: MarkovChain = {};

    // Clean and tokenize the text
    const sentences = text.split("\n").filter((line) => line.trim().length > 0);

    for (const sentence of sentences) {
        // Clean the sentence - remove URLs, mentions, and excessive whitespace
        const cleanSentence = sentence
            .replace(/https?:\/\/[^\s]+/g, "") // Remove URLs
            .replace(/@[a-zA-Z0-9._-]+/g, "") // Remove mentions
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();

        if (cleanSentence.length < 10) continue; // Skip very short sentences

        const words = cleanSentence.split(" ").filter((word) => word.length > 0);

        if (words.length <= order) continue; // Skip sentences too short for the order

        // Build the chain
        for (let i = 0; i <= words.length - order - 1; i++) {
            const key = words.slice(i, i + order).join(" ");
            const nextWord = words[i + order];

            if (!chain[key]) {
                chain[key] = [];
            }

            chain[key].push(nextWord);
        }
    }

    return chain;
}

/**
 * Generates text using the Markov chain
 * @param chain - The Markov chain to use
 * @param maxLength - Maximum length of generated text
 * @param order - Order of the Markov chain
 * @returns Generated text
 */
function generateText(chain: MarkovChain, maxLength: number = 280, order: number = 2): string {
    const keys = Object.keys(chain);
    if (keys.length === 0) return "Not enough data to generate text";

    // Start with a random key that begins with a capital letter (likely sentence start)
    const sentenceStarters = keys.filter((key) => /^[A-Z]/.test(key));
    const startKey =
        sentenceStarters.length > 0
            ? sentenceStarters[Math.floor(Math.random() * sentenceStarters.length)]
            : keys[Math.floor(Math.random() * keys.length)];

    let result = startKey;
    let currentKey = startKey;

    while (result.length < maxLength) {
        const possibleNextWords = chain[currentKey];
        if (!possibleNextWords || possibleNextWords.length === 0) break;

        // Pick a random next word
        const nextWord = possibleNextWords[Math.floor(Math.random() * possibleNextWords.length)];
        result += " " + nextWord;

        // Update the key for next iteration
        const words = result.split(" ");
        if (words.length >= order) {
            currentKey = words.slice(-order).join(" ");
        } else {
            break;
        }

        // Stop at sentence end if we have enough text
        if (result.length > 50 && /[.!?]$/.test(nextWord)) {
            break;
        }
    }

    // Clean up the result
    result = result.trim();

    // If it doesn't end with punctuation, try to end at a reasonable point
    if (!/[.!?]$/.test(result) && result.length > 100) {
        const words = result.split(" ");
        // Try to find a good stopping point
        for (let i = words.length - 1; i >= Math.max(0, words.length - 10); i--) {
            if (/[.!?]$/.test(words[i])) {
                result = words.slice(0, i + 1).join(" ");
                break;
            }
        }
    }

    return result;
}

/**
 * Analyzes the text and provides some stats
 * @param text - Text to analyze
 * @returns Analysis object
 */
function analyzeText(text: string) {
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    const totalWords = text.split(/\s+/).length;
    const avgWordsPerPost = Math.round(totalWords / lines.length);

    return {
        totalPosts: lines.length,
        totalWords,
        avgWordsPerPost,
        totalCharacters: text.length,
    };
}

/**
 * Simple function to generate a single post for a user
 * @param username - Bluesky username (without @)
 * @param markovOrder - Order of the Markov chain (default: 2)
 * @returns Generated post as a string
 */
async function generatePost(username: string, markovOrder: number = 2, agent: AtpAgent = undefined): Promise<string> {
    try {
        // Create authenticated agent
        const userAgent = agent || (await createAuthenticatedAgent());

        // Get user's posts
        const userPosts = await getUserPosts(userAgent, username, 100);

        // Build Markov chain
        const markovChain = buildMarkovChain(userPosts, markovOrder);

        // Generate and return a single post
        const generatedPost = generateText(markovChain, 280, markovOrder);
        return generatedPost;
    } catch (error) {
        throw new Error(`Failed to generate post for @${username}: ${error.message}`);
    }
}

/**
 * Main function to generate posts for a given user
 * @param username - Bluesky username (without @)
 * @param numPosts - Number of posts to generate
 * @param markovOrder - Order of the Markov chain (1-3 recommended)
 */
async function generatePostsForUser(username: string, numPosts: number = 5, markovOrder: number = 2): Promise<void> {
    try {
        console.log(`🚀 Starting post generation for @${username}`);
        console.log(`📊 Settings: ${numPosts} posts, Markov order: ${markovOrder}`);
        console.log("─".repeat(50));

        // Create authenticated agent
        const agent = await createAuthenticatedAgent();

        // Get user's posts
        console.log(`📥 Downloading posts for @${username}...`);
        const userPosts = await getUserPosts(agent, username, 100);

        // Analyze the text
        const analysis = analyzeText(userPosts);
        console.log(`📈 Analysis:`);
        console.log(`   • Total posts: ${analysis.totalPosts}`);
        console.log(`   • Total words: ${analysis.totalWords}`);
        console.log(`   • Avg words per post: ${analysis.avgWordsPerPost}`);
        console.log(`   • Total characters: ${analysis.totalCharacters}`);
        console.log("─".repeat(50));

        // Build Markov chain
        console.log(`🔗 Building Markov chain (order ${markovOrder})...`);
        const markovChain = buildMarkovChain(userPosts, markovOrder);
        const chainSize = Object.keys(markovChain).length;
        console.log(`   • Chain size: ${chainSize} states`);

        if (chainSize < 10) {
            console.log(`⚠️  Warning: Small chain size. Consider downloading more posts or reducing Markov order.`);
        }

        console.log("─".repeat(50));
        console.log(`Posts in the style of @${username}:`);
        console.log("─".repeat(50));

        // Generate posts
        for (let i = 1; i <= numPosts; i++) {
            const generatedPost = generateText(markovChain, 280, markovOrder);
            console.log(`\n${i}. ${generatedPost}`);
            //   console.log(`   (${generatedPost.length} characters)`)
        }

        console.log("\n" + "─".repeat(50));
        console.log("Generation complete!");
    } catch (error) {
        console.error("❌ Error generating posts:", error);

        if (error.message?.includes("EMAIL and PW")) {
            console.log("\n💡 Make sure to set EMAIL and PW environment variables in your .env file");
        } else if (error.status === 404) {
            console.log(`\n💡 User @${username} not found. Check the username and try again.`);
        }
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log("Usage: node script.js <username> [num_posts] [markov_order]");
        console.log("Example: node script.js freeuse.toys 3 2");
        console.log("\nParameters:");
        console.log("  username     - Bluesky username (without @)");
        console.log("  num_posts    - Number of posts to generate (default: 5)");
        console.log("  markov_order - Markov chain order 1-3 (default: 2)");
        console.log("\nMarkov order explanation:");
        console.log("  1 - More random, less coherent");
        console.log("  2 - Good balance (recommended)");
        console.log("  3 - More coherent, less random");
        process.exit(1);
    }

    const username = args[0];
    const numPosts = parseInt(args[1]) || 5;
    const markovOrder = parseInt(args[2]) || 2;

    if (markovOrder < 1 || markovOrder > 3) {
        console.log("❌ Markov order must be between 1 and 3");
        process.exit(1);
    }

    if (numPosts < 1 || numPosts > 20) {
        console.log("❌ Number of posts must be between 1 and 20");
        process.exit(1);
    }

    await generatePostsForUser(username, numPosts, markovOrder);
}

// Export functions for use in other files
export { buildMarkovChain, generateText, analyzeText, generatePost, generatePostsForUser };

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
