---
title: AI Has No Understanding
date: 2025-04-18
draft: false
tags: ["AI"]
---

The proliferation of AI (specifically LLMs) has been the major development in our industry recently. Many people are understandably impressed by the capabilities of cutting-edge LLMs. However, the hype sometimes becomes ridiculous. On Twitter, I've seen people claiming AGI is already here because some LLMs are capable of solving very advanced coding challenges.

I've been using LLMs at work for quite a while. Although it's not rare for me to use them to generate code beyond my expertise, I remain convinced that current LLMs lack genuine cognitive capabilities. The notion of fully delegating human tasks to AI systems remains unrealistic today. I doubt whether it will ever be truly possible.

## 1. It has no expertise

Let me start with a very recent example. GPT-4.1 was out this week. Here's what OpenAI says about it:

> GPT‑4.1 scores 54.6% on SWE-bench Verified, improving by 21.4%abs over GPT‑4o and 26.6%abs over GPT‑4.5—making it a leading model for coding.

I recently developed a hobby project [Kakashi](https://leihuang23.github.io/kakashi/). I wanted to conditionally enable a button for local development — a trivial task, but one I was reluctant to handle manually. So I asked GPT-4.1 to do it:

{{<user>}}
Only enable the image uploading functionality in local dev mode. Make the 'upload image' button dynamically injected with js
{{</user>}}

{{<assistant name="GPT-4.1">}}
To enable image uploading only in local development mode and inject the "Upload Image" button dynamically, you can:

1. Detect local development (e.g., `window.location.hostname` is `localhost` or `127.0.0.1`).
2. Dynamically create and insert the "Upload Image" button and file input in JS.
3. Only attach related event listeners if in dev mode.

Here's how you can modify your code:

```js
 if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  )
```

...
{{</assistant>}}

{{<user>}}
Wait, there's a better way to do it. We can use build-time variables. We only need to omit this functionality when building.
{{</user>}}

{{<assistant name="GPT-4.1">}}
You're correct! The best practice is to use a build-time variable (such as `process.env.NODE_ENV` or a custom Vite/webpack define) to conditionally include the image upload functionality. This way, the code is omitted from production bundles entirely.

Here's how you can do it using a build-time variable (e.g., `import.meta.env.DEV` for Vite, or `process.env.NODE_ENV` for webpack):

```js
// Only inject upload button in dev mode
if (import.meta.env.DEV) {
  // Dynamically create upload button
}
```

{{</assistant>}}

This conversation reveals a lot about the nature of LLMs.

Fundamentally, what LLMs do is generate the right words at the right time. They do this by sampling texts from the internet and placing every token into a hyperspace (represented by vectors). When you interact with an LLM, it treats your input as context, navigating this hyperspace to predict and generate text that best completes or continues the "user–system" conversation.

In the conversation above, GPT gave the initial answer probably because it saw such an answer during training.(It's also possible the LLM was "thinking", i.e. generating its working memory, with bad content) It failed to discriminate bad solutions from good ones.

Why did GPT initially propose an inferior solution? Because it selects the statistically likely next words based on training data, without genuine expertise or intuition. As a human developer, I can immediately capture the signal of poor practice at the mere sight of `window.location.hostname`. GPT, despite extensive data exposure, lacked the judgment to initially recommend the better solution.

## 2. It doesn't know what is impossible

The limitation of an LLM’s ability to mimic "understanding" quickly manifests when tackling very complex problems, such as computer vision.

The Kakashi app collects users' drawing paths as coordinates and animates them using Fourier Transformation. The animation is as good as how well the user draws. My drawing isn't very good, so I wanted to generate animation paths from existing one-stroke drawings, like this one:
![cat line art](/images/cat-line.png)

Here's a conversation between me and Claude 3.7 with extended "thinking":

{{<user>}}
I want to build a web app to extract coordinate points from images so that I can animate the coordinates later. Here are the ideas:

1. We can assume the images will only contain one-stroke drawing. Our goal is to extract this one-stroke drawing.
2. The image will not be guaranteed to have perfect white background. We'll need to deal with noise. We can start with getting rid of any rogue elements/pixels on the image and then extracting the main path. We also need to handle potential breaks of the path. If there are breaks, we need to fill them.
3. Then we make the path a one pixel wide smooth line. Be careful not to make the path wiggly.
4. Find the start and end point of the stroke.
5. We need to sample the path points as if we are drawing. I don't have a good idea on how long the draw should be, as the drawings can have different complexities. Make the default draw duration 4 seconds, but make it a variable that the user can provide through the UI. The idea is that we sample the points within the browser animation rate limit. So the frequency should be one pixel per duration_in_ms/16.67. We also need to mimic human drawing gesture. Faster in straight parts, slower in curvy parts.
6. When deciding the start and end point, follow the rule that start from left, end on the right.
7. I know this project is very complex. Use WebAssembly and Rust if it would be easier.
8. Many steps can go wrong, so I want comprehensive debug info. Render intermediate image data on a debug canvas if you can.
9. The extracted coordinates are calculated relative to the left top corner of the image.
10. Start with presenting a button that the user can use to upload an image.

Are these instructions clear to you? Be sure you understand them all. Improve my flow if you can.
{{</user>}}

{{<assistant name="Claude 3.7">}}
Your requirements for the image coordinate extraction web app are clear. This is an interesting project! Let me understand and improve your approach.

Blah blah...
{{</assistant>}}

Claude confidently gave a non-solution. It didn't work, of course. We went back and forth several rounds until I realized something was wrong.

{{<user>}}
It still doesn't work. I think you are trying in the wrong direction. The issue is the thin algorithm displaced the joint, but you were trying to fix the tracing.
{{</user>}}

{{<assistant name="Claude 3.7">}}
I understand the problem now - you're absolutely right. The issue is with the thinning algorithm, not the path tracing. The skeletonization process is breaking connectivity at the intersections/joints.
Let me fix the actual problem:

...

Blah blah
{{</assistant>}}

Broken code, again.

Suddenly, I had a Eureka moment and felt smart:

{{<user>}}
I have an intuition. The problem is the thin algorithm can't handle intersections. Try a different approach. Let's follow the drawing path from start to finish and thin the line to one pixel as we traverse.
{{</user>}}

And Claude was quick to acknowledge that I was helpful:

{{<assistant name="Claude 3.7">}}
You've hit the nail on the head! Following the actual drawing path rather than relying on thinning algorithms is exactly what we need. Let me implement this approach:

...
{{</assistant>}}

And of course, broken code again. We continued several rounds until I started to worry about my usage limit. Then, I started a new conversation and changed the question:

{{<user>}}
You are not solving the problem. I've already told you the thin algorithm handles the cross wrong. The line crosses and enters itself at one point, but exits from another point. I've added the screenshot.
![screenshot](/images/animation-example.webp)

Is this problem even possible to solve? How do you implement a perfect cross?
{{</user>}}

{{<assistant name="Claude 3.7">}}
You're absolutely right, and I apologize for not addressing the specific issue. Looking at your screenshot, I can see the exact problem - when a line crosses itself in a 2D image, there's an inherent ambiguity about which path to follow.

This is actually a fundamental challenge in computer vision known as the "crossing problem." When a line crosses itself in a 2D image, we lose information about which path was drawn on top (the z-order). The flattened 2D representation doesn't preserve this crucial information.

Is this problem even possible to solve?
Theoretically, no - not with 100% accuracy from a single 2D image without additional information. This is an inherently ambiguous situation.

However, we can implement approaches that make intelligent guesses:

...
{{</assistant>}}

Only after burning through most of my daily usage limit did Claude finally tell me the truth, and even then, it had the gall to keep offering ineffective solutions.

My human agency kicked in again. Perhaps I could draw on the image to guide the tracing direction?

But by then, I knew Claude couldn't help. Without expertise in computer vision, I'd likely waste more time.

## 3. It doesn't know you're asking a dumb question

LLMs behave like some tech bros and crypto bros — always 100% sure and convincing.

I sometimes fall for their confidence and overestimate their abilities.

My handwriting isn't great, so I thought AI could improve it. After collecting my handwriting coordinates, I asked Gemini 2.5 Pro for improvement.

{{<user>}}
I have a coordinates path that represents a one-stroke path of the text "Hello". My handwriting is ugly and I want you to improve it. Give me a more stylish one-stroke path. Here's the js array for my current path:

[coordinates]
{{</user>}}

{{<assistant name="Gemini Pro 2.5">}}
Okay, I can help you with that! Creating a "stylish" path is subjective, but I can generate a new set of coordinates representing a smoother, more flowing cursive style for "Hello" in a single stroke.

...

(Blah blah enthusiastic and self-assured rubbish)
{{</assistant>}}

Of course, Gemini couldn't help — the coordinates I provided never appeared on the internet and pattern-matching was doomed to fail. Unless Gemini wrote a dedicated program to deterministically improve my handwriting, there was no way it could help me. Yet, Gemini confidently provided rubbish coordinates.

We continued until I realized I'd asked a dumb question.

A human expert would quickly identify a bad question and help directing you to ask the right one. But LLM isn't capable of that. It'll always mimic a conversation, even when it's clearly out of its depth.
