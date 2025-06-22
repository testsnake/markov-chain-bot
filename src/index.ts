import { users } from "../users.json";
import { generatePost } from "./markov";
import { createAuthenticatedAgent } from "./download_posts";

const markov_order = undefined;

async function main() {
    // choose random user

    const randomIndex = Math.floor(Math.random() * users.length);
    const randomUser = users[randomIndex];
    // generate post for random users
    const agent = await createAuthenticatedAgent(randomUser.handle, randomUser.password);
    const post = await generatePost(randomUser.target, markov_order, agent);
    // post it
    console.log(randomUser.target, post);

    await agent.post({text: post});
}

main();
