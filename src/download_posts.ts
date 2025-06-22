import { AtpAgent, AtpSessionEvent, AtpSessionData } from "@atproto/api";
import "dotenv/config";

import { promises as fsPromises } from "fs";
import { join } from "path";

async function asyncWriteFile(filename: string, data: any) {
    try {
        await fsPromises.writeFile(filename, data, {
            flag: "w",
        });

        console.log(`File written successfully: ${filename}`);
        return data;
    } catch (err) {
        console.log("Error writing file:", err);
        return "Something went wrong";
    }
}

async function asyncReadFile(filename: string): Promise<string | null> {
    try {
        const contents = await fsPromises.readFile(filename, "utf-8");
        return contents;
    } catch (err) {
        return null; // File doesn't exist
    }
}

async function ensureDirectoryExists(dirPath: string) {
    try {
        await fsPromises.mkdir(dirPath, { recursive: true });
    } catch (err) {
        // Directory might already exist, ignore error
    }
}

async function scrollPosts(agent: AtpAgent, user: string, limit: number = 100, cursor?: string): Promise<string> {
    let allPostTexts: string[] = [];
    let currentCursor = cursor;
    let totalPosts = 0;

    while (true) {
        try {
            console.log(`Fetching batch ${Math.floor(totalPosts / limit) + 1} for user: ${user}`);

            const response = await agent.getAuthorFeed({
                actor: user,
                limit: limit,
                cursor: currentCursor,
                // filter: 'posts_no_replies'
            });

            console.log(`Found ${response.data.feed.length} posts in this batch`);

            if (response.data.feed.length === 0) {
                console.log("No more posts found, stopping");
                break;
            }

            for (const post of response.data.feed) {
                // Only include posts with text content
                if (
                    post.post.author.handle == user &&
                    post.post.record.text &&
                    post.post.record.text.trim().length > 0
                ) {
                    // Replace newlines within the post with spaces, but keep the post text intact
                    const singleLineText = post.post.record.text.trim().replace(/\n/g, " ");
                    allPostTexts.push(singleLineText);
                }

                totalPosts++;
            }

            // Get next cursor for pagination
            currentCursor = response.data.cursor;

            // If no cursor, we've reached the end
            if (!currentCursor) {
                console.log("No more pages available, stopping");
                break;
            }

            // Add a small delay to be nice to the API
            await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
            console.error("Error fetching posts:", error);

            // Check if it's a user not found error
            if (error.status === 400) {
                console.log("User might not exist or handle is incorrect");
            } else if (error.status === 401) {
                console.log("Authentication failed");
            } else if (error.status === 404) {
                console.log("User not found");
            } else if (error.status === 502) {
                console.log("Server error - try again later or check if user exists");
            }

            throw error;
        }
    }

    console.log(`\nTotal posts processed: ${totalPosts}`);
    console.log(`Posts with text content: ${allPostTexts.length}`);

    // Join all post texts with newlines
    const massiveFuckingString = allPostTexts.join("\n");

    return massiveFuckingString;
}

/**
 * Gets posts for a user, either from cache or by downloading
 * @param agent - Authenticated AtpAgent
 * @param username - Username/handle to get posts for
 * @param limit - Posts per batch (default 100)
 * @returns Promise<string> - All post texts joined by newlines
 */
export async function getUserPosts(agent: AtpAgent, username: string, limit: number = 100): Promise<string> {
    const postsDir = "./posts";
    const filename = join(postsDir, `${username}.txt`);

    // Check if file already exists
    const existingData = await asyncReadFile(filename);
    if (existingData) {
        console.log(`Using cached posts for ${username} (${existingData.length} characters)`);
        return existingData;
    }

    // File doesn't exist, download posts
    console.log(`No cached posts found for ${username}, downloading...`);
    await ensureDirectoryExists(postsDir);

    const posts = await scrollPosts(agent, username, limit);

    // Save to file
    await asyncWriteFile(filename, posts);

    return posts;
}

/**
 * Creates and authenticates an AtpAgent
 * @returns Promise<AtpAgent> - Authenticated agent
 */
export async function createAuthenticatedAgent(
    accountUserName: string = undefined,
    accountPassword: string = undefined
): Promise<AtpAgent> {
    const username = accountUserName || process.env.EMAIL;
    const password = accountPassword || process.env.PW;

    if (!username || !password) {
        throw new Error("EMAIL and PW environment variables must be set");
    }

    const agent = new AtpAgent({
        service: "https://bsky.social",
    });

    console.log("Logging in...");
    await agent.login({
        identifier: username,
        password: password,
    });

    console.log("Logged in successfully");
    return agent;
}

// Main function that runs when this file is executed directly
async function main() {
    try {
        const agent = await createAuthenticatedAgent();

        const targetUser = "freeuse.toys";

        const posts = await getUserPosts(agent, targetUser, 100);

        console.log(`\nFinal string length: ${posts.length} characters`);
        console.log(`First 500 characters: ${posts.substring(0, 500)}...`);
    } catch (error) {
        console.error("Main error:", error);
        process.exit(1);
    }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
